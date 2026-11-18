import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {getFirestore,collection,doc,getDocFromServer,getDocsFromServer,query,where,documentId,limit,runTransaction,updateDoc} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {getOwnerConfig} from './config.js';
import {samples,liveProjects} from '../portfolio-catalog.js';
import {mergeProjects} from './photos.js';
import {seal} from './letter.js';

const owners=initializeApp(await getOwnerConfig(),'portfolio-owner');
const auth=getAuth(owners),db=getFirestore(owners);
const record=id=>doc(db,'app_config',id);
const manifest=record('pf-catalog-v1');
let verified=null, original=null;
const denied=()=>Object.assign(Error('Zaloguj się kontem administratora pracowni.'),{status:401});
export async function resetPassword(email){
  if(!email.trim().includes('@'))throw Error('Wpisz e-mail konta administratora.');
  await sendPasswordResetEmail(auth,email.trim());
}
async function requireOwner(){
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
    const replacement=JSON.stringify([next,...old.filter(p=>p.id!==id)]);
    if(new TextEncoder().encode(replacement).length>850000)throw Error('Brak miejsca w indeksie galerii. Skróć opisy lub usuń nieużywane realizacje.');
    for(const item of assets)tx.set(record('pf-img-'+item.asset),{data:item.data});
    for(const prior of prev?.photos||[])if(prior.asset&&!photos.some(p=>p.asset===prior.asset))tx.delete(record('pf-img-'+prior.asset));
    tx.set(manifest,{entries:replacement});
  });
  return {id};
}
const inquiries=collection(db,'portfolio_inquiries');
function thread(snap){
  const m=snap.data();return {id:snap.id,name:m.name||'Klient',email:m.email||'',subject:(m.message||'Zapytanie').slice(0,75),unread:!m.read,closed:m.status==='closed',date:m.date?.toDate().toISOString()||''};
}
async function conversation(input){
  const ref=doc(inquiries,input.id);
  const snap=await getDocFromServer(ref);
  if(!snap.exists())throw Error('Brak tej rozmowy.');
  const m=snap.data(),addressable=typeof m.replyKey==='string' && /^[0-9a-f-]{36}$/.test(m.mailboxId||'');
  let closed=m.status==='closed';
  if(input.action==='close'||input.action==='open'){
    closed=input.action==='close';await updateDoc(ref,{status:closed?'closed':'read',read:true});
  }
  if(addressable){
    const mailbox=record('pf-reply-'+m.mailboxId);
    if(input.action==='reply'){
      if(closed||!input.text?.trim())throw Error('Otwórz rozmowę i wpisz odpowiedź.');
      const envelope=await seal(m.replyKey,input.text.trim());
      await runTransaction(db,async tx=>{
        const latest=(await tx.get(ref)).data();
        if(!latest || latest.status==='closed')throw Error('Rozmowa jest zamknięta.');
        const previous=JSON.parse((await tx.get(mailbox)).data()?.letters||'[]');
        const serialized=JSON.stringify([...previous,envelope]);
        if(serialized.length>850000)throw Error('Ta rozmowa jest pełna. Odpowiedz e-mailem.');
        tx.set(mailbox,{letters:serialized});
        tx.update(ref,{status:'replied',read:true,sent:[...(latest.sent||[]),{body:input.text.trim(),created:envelope.created}]});
      });
      m.sent=[...(m.sent||[]),{body:input.text.trim(),created:envelope.created}];
    }
  }
  if(!m.read && input.action==='view')await updateDoc(ref,{read:true});
  return {closed,addressable,attachment:m.attachment,posts:[{role:'client',body:m.message||'',created:m.date?.toDate().toISOString()},...(m.sent||[]).map(l=>({role:'studio',body:l.body,created:l.created}))]};
}
export async function api(path,body){
  if(path==='login'){
    try{await signInWithEmailAndPassword(auth,body.login.trim(),body.password);await requireOwner();}
    catch{await signOut(auth);throw Error('Sprawdź e-mail i hasło konta administratora. Możesz też ustawić nowe hasło przez e-mail.');}
    return;
  }
  if(path==='logout'){verified=null;await signOut(auth);return;}
  await requireOwner();
  if(path==='admin/projects' && !body){
    const current=entries(await getDocFromServer(manifest));
    let base=[];
    try{base=await baseProjects();}catch{document.querySelector('#feedback').textContent='Poprzedni katalog jest chwilowo niedostępny.';}
    return mergeProjects(base,current);
  }
  if(path==='admin/projects'||path==='admin/remove')return changeProject(body,path==='admin/remove');
  if(path==='admin/inbox')return (await getDocsFromServer(inquiries)).docs.map(thread).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(path==='admin/thread')return conversation(body);
  throw Error('Nieznana operacja.');
}
