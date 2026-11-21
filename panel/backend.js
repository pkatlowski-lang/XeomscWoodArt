import {priceDocument, parsePrice, categoryKey} from '../realizacje/ceny.js';
import {homeDocument, homeChanges} from './homepage.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {initializeAuth,browserLocalPersistence,indexedDBLocalPersistence,browserSessionPersistence,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {getFirestore,collection,doc,getDocFromServer,getDocsFromServer,query,where,documentId,limit,runTransaction,updateDoc,writeBatch} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {getOwnerConfig} from './config.js';
import {samples,liveProjects} from '../portfolio-catalog.js';
import {mergeProjects} from './photos.js';
import {seal} from './letter.js';

const owners=initializeApp(await getOwnerConfig(),'portfolio-owner');
const auth = initializeAuth(owners, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence]
});
const db = getFirestore(owners);
const record=id=>doc(db,'app_config',id);
const manifest=record('pf-catalog-v1');
let verified=null, original=null;
const denied=()=>Object.assign(Error('Zaloguj się kontem administratora pracowni.'),{status:401});
export async function resetPassword(email){
  if(!email.trim().includes('@'))throw Error('Wpisz e-mail konta administratora.');
  await sendPasswordResetEmail(auth,email.trim());
}
export async function requireOwner(){
  await auth.authStateReady();
  const user=auth.currentUser;
  if(!user || !user.email)throw denied();
  if(verified!==user.uid){
    // Server-side list permission is reserved for the owner by the existing rules.
    await getDocsFromServer(query(collection(db,'app_config'),where(documentId(),'==','pf-catalog-v1'),limit(1)));
    verified=user.uid;
  }
}
async function baseProjects(){
  if(!original){
    const legacy=await liveProjects();
    original=(legacy.length?legacy:samples).map(p=>({...p,published:true,revision:0}));
  }
  return original;
}
function entries(snapshot){return JSON.parse(snapshot.data()?.entries||'[]');}
async function changeProject(input,remove){
  const id=input.id||crypto.randomUUID(), revision=(input.revision||0)+1;
  const assets=[];
  const photos=remove?[]:input.photos.map(p=>{
    if(p.data){
      if(!p.data.startsWith('data:image/webp;base64,')||p.data.length>750000)throw Error('Zdjęcie jest zbyt duże. Wybierz mniejsze zdjęcie.');
      const asset=crypto.randomUUID();assets.push({asset,data:p.data});return {asset,alt:p.alt||input.title};
    }
    if(!p.asset && !p.url)throw Error('Brakuje pliku zdjęcia.');
    return p.asset?{asset:p.asset,alt:p.alt||input.title}:{url:p.url,alt:p.alt||input.title};
  });
  const next=remove?{id,revision,removed:true}:{id,revision,published:true,featured:!!input.featured,title:input.title.trim(),category:input.category.trim(),description:input.description.trim(),material:input.material.trim(),photos};
  if(!remove && (!next.title||!next.category||!photos.length||photos.length>12))throw Error('Wpisz nazwę, kategorię i dodaj od 1 do 12 zdjęć.');
  await runTransaction(db,async tx=>{
    const old=entries(await tx.get(manifest)),prev=old.find(p=>p.id===id);
    if((prev?.revision||0)!==(input.revision||0))throw Error('Ten projekt zmieniono w innym oknie. Odśwież panel.');
    // Older panel entries only have manifest order. Preserve it on the first save.
    let sequence = old.reduce((highest, item) => Math.max(highest, item.addedOrder || 0), 0);
    for (const item of [...old].reverse()) {
      if (!item.addedOrder && /^[0-9a-f-]{36}$/i.test(item.id)) item.addedOrder = ++sequence;
    }
    if (!remove) {
      const amount = input.actualPrice === undefined ? prev?.actualGrosze : parsePrice(input.actualPrice);
      if (amount != null) next.actualGrosze = amount;
    }
    if (prev?.addedOrder) next.addedOrder = prev.addedOrder;
    else if (!input.id) next.addedOrder = ++sequence;
    const replacement=JSON.stringify([next,...old.filter(p=>p.id!==id)]);
    if(new TextEncoder().encode(replacement).length>850000)throw Error('Brak miejsca w indeksie galerii. Skróć opisy lub usuń nieużywane realizacje.');
    for(const item of assets)tx.set(record('pf-img-'+item.asset),{data:item.data});
    for(const prior of prev?.photos||[])if(prior.asset&&!photos.some(p=>p.asset===prior.asset))tx.delete(record('pf-img-'+prior.asset));
    tx.set(manifest,{entries:replacement});
  });
  return {id};
}
const inquiries=collection(db,'portfolio_inquiries');
const messagesFor = (ref, key) => collection(ref, 'dialogs', key, 'messages');

async function enableDialog(snap) {
  const data = snap.data();
  if (data.dialogKey || !data.replyKey || data.mailboxId !== snap.id) return data.dialogKey;
  const key = crypto.randomUUID();
  const envelope = await seal(data.replyKey, key);
  return runTransaction(db, async tx => {
    const latest = (await tx.get(snap.ref)).data();
    if (!latest || latest.deleting || latest.dialogKey) return latest?.dialogKey;
    tx.update(snap.ref, {dialogKey:key});
    tx.set(record('pf-reply-' + snap.id), {dialog:JSON.stringify(envelope), closed:latest.status === 'closed'}, {merge:true});
    return key;
  });
}

async function loadInbox() {
  const snapshots = await getDocsFromServer(inquiries);
  for (const snap of snapshots.docs) {
    const data = snap.data();
    if (data.sent?.length && !data.dialogKey) await enableDialog(snap);
  }
  return snapshots.docs.map(thread).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

async function deleteThread(id) {
  const ref = doc(inquiries,id);
  const data = await runTransaction(db, async tx => {
    const thread = (await tx.get(ref)).data();
    if (!thread) return null;
    // Keep the thread available for a retry until all its files and messages are gone.
    tx.update(ref,{status:'closed',deleting:true});
    if (thread.dialogKey) tx.set(record('pf-reply-' + id),{closed:true},{merge:true});
    return thread;
  });
  if (!data) return;
  if (data.dialogKey) {
    const messages = messagesFor(ref,data.dialogKey);
    for (;;) {
      const page = await getDocsFromServer(query(messages,limit(100)));
      if (page.empty) break;
      const batch = writeBatch(db);
      for (const post of page.docs) {
        if (post.data().fileName) batch.delete(doc(post.ref,'files','reference'));
        batch.delete(post.ref);
      }
      await batch.commit();
    }
  }
  const batch = writeBatch(db);
  if (data.hasAttachment) batch.delete(doc(ref,'files','reference'));
  if (data.mailboxId === id) batch.delete(record('pf-reply-' + id));
  batch.delete(ref);
  await batch.commit();
}
function thread(snap){
  const m=snap.data();return {id:snap.id,name:m.name||'Klient',email:m.email||'',subject:(m.message||'Zapytanie').slice(0,75),unread:!m.read,closed:m.status==='closed',date:(m.lastClientAt || m.date)?.toDate().toISOString()||''};
}
export function signedReply(text) {
  const message = text.trim();
  if (!message) throw Error('Wpisz treść odpowiedzi.');
  const body = message.replace(/(?:^|\n)\s*Pozdrawiam[ ,!.\t]*(?:\s+Xeomsc Laser[.!]?)?\s*$/iu, '').trimEnd();
  return (body ? body + '\n\n' : '') + 'Pozdrawiam,\nXeomsc Laser';
}
async function conversation(input){
  const ref=doc(inquiries,input.id);
  const snap=await getDocFromServer(ref);
  if(!snap.exists())throw Error('Brak tej rozmowy.');
  const m=snap.data(),addressable=typeof m.replyKey==='string' && /^[0-9a-f-]{36}$/.test(m.mailboxId||'');
  let attachment = m.attachment;
  if (m.hasAttachment) {
    const file = await getDocFromServer(doc(ref, 'files', 'reference'));
    if (file.exists()) {
      const data = file.data();
      attachment = data.jpeg ? 'data:image/jpeg;base64,' + data.jpeg.toBase64() : data;
    }
  }
  const key = m.dialogKey || (addressable && (m.sent?.length || input.action === 'reply') ? await enableDialog(snap) : null);
  let closed=m.status==='closed';
  if(input.action==='close'||input.action==='open'){
    closed=input.action==='close';
    await runTransaction(db, async tx => {
      if ((await tx.get(ref)).data()?.deleting) throw Error('Trwa usuwanie rozmowy.');
      tx.update(ref,{status:closed?'closed':'read',read:true});
      if (key) tx.set(record('pf-reply-'+m.mailboxId),{closed},{merge:true});
    });
  }
  if(addressable){
    const mailbox=record('pf-reply-'+m.mailboxId);
    if(input.action==='reply'){
      if(closed||!input.text?.trim())throw Error('Otwórz rozmowę i wpisz odpowiedź.');
      const body=signedReply(input.text);
      const envelope=await seal(m.replyKey,body);
      let sent=[];
      await runTransaction(db,async tx=>{
        const latest=(await tx.get(ref)).data();
        sent=latest?.sent||[];
        if(input.requestId && sent.some(post=>post.requestId===input.requestId))return;
        if(!latest || latest.status==='closed')throw Error('Rozmowa jest zamknięta.');
        const previous=JSON.parse((await tx.get(mailbox)).data()?.letters||'[]');
        const serialized=JSON.stringify([...previous,envelope]);
        if(serialized.length>850000)throw Error('Ta rozmowa jest pełna. Odpowiedz e-mailem.');
        tx.set(mailbox,{letters:serialized},{merge:true});
        const post={body,created:envelope.created};
        if(input.requestId)post.requestId=input.requestId;
        sent=[...sent,post];
        tx.update(ref,{status:'replied',read:true,sent});
      });
      m.sent=sent;
    }
  }
  if(!m.read && input.action==='view')await updateDoc(ref,{read:true});
  const posts = [{role:'client',body:m.message||'',created:m.date?.toDate().toISOString()},...(m.sent||[]).map(l=>({role:'studio',body:l.body,created:l.created}))];
  if (key) {
    try {
      const replies = await getDocsFromServer(messagesFor(ref,key));
      for (const post of replies.docs) {
        const data = post.data();
        posts.push({role:'client', body:data.body, created:data.created.toDate().toISOString(),
          fileName:data.fileName, loadFile:async () => (await getDocFromServer(doc(post.ref,'files','reference'))).data()});
      }
    } catch (error) {
      if (error.code !== 'permission-denied') throw error;
      return {closed,addressable,attachment,posts, rulesPending:true};
    }
  }
  posts.sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  return {closed,addressable,attachment,posts};
}
export async function api(path,body){
  if(path==='login'){
    try {
      await signInWithEmailAndPassword(auth,body.login.trim(),body.password);
    } catch (error) {
      if (error.code === 'auth/network-request-failed') throw Error('Brak połączenia z Firebase. Spróbuj ponownie.');
      throw Error('Sprawdź e-mail i hasło konta administratora.');
    }
    await requireOwner();
    return;
  }
  if(path==='logout'){verified=null;await signOut(auth);return;}
  await requireOwner();
  if (path === 'admin/prices') {
    const ref = record(priceDocument);
    const readRates = snapshot => JSON.parse(snapshot.data()?.rates || '[]');
    if (!body) return readRates(await getDocFromServer(ref));
    const category = body.category.trim(), variant = body.variant.trim();
    if (!category || category.length > 100 || variant.length > 140) throw Error('Sprawdź nazwę kategorii i opis wariantu.');
    const amount = parsePrice(body.amount);
    return runTransaction(db, async tx => {
      const rates = readRates(await tx.get(ref));
      const matches = row => categoryKey(row.category) === categoryKey(category);
      const previous = rates.find(matches) || null;
      if (JSON.stringify(previous) !== JSON.stringify(body.previous)) throw Error('Cennik zmieniono w innej karcie. Odśwież panel.');
      const updated = rates.filter(row => !matches(row));
      if (amount !== null) updated.push({category,amount,variant});
      updated.sort((a,b) => a.category.localeCompare(b.category,'pl'));
      tx.set(ref,{rates:JSON.stringify(updated)});
      return updated;
    });
  }
  if (path === 'admin/homepage') {
    const ref = record(homeDocument);
    if (!body) return (await getDocFromServer(ref)).data() || {};
    const changes = homeChanges(body);
    return runTransaction(db, async tx => {
      const current = (await tx.get(ref)).data();
      const revision = current?.revision || 0;
      if (revision !== body.revision) throw Error('Inna karta zapisała zmiany. Skopiuj swój tekst i odśwież panel.');
      tx.set(ref, {...changes, revision: revision + 1}, {merge:true});
      return revision + 1;
    });
  }
  if(path==='admin/projects' && !body){
    const current=entries(await getDocFromServer(manifest));
    let base=[];
    try{base=await baseProjects();}catch{document.querySelector('#feedback').textContent='Poprzedni katalog jest chwilowo niedostępny.';}
    return mergeProjects(base,current);
  }
  if(path==='admin/projects'||path==='admin/remove')return changeProject(body,path==='admin/remove');
  if(path==='admin/inbox')return loadInbox();
  if(path==='admin/delete-thread')return deleteThread(body.id);
  if(path==='admin/thread')return conversation(body);
  throw Error('Nieznana operacja.');
}
