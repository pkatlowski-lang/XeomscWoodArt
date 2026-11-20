import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {publicWorkshop} from '../../panel/catalog-data.mjs';

const apply = process.argv.includes('--apply');
function database(projectId) {
  const app=initializeApp({projectId,credential:applicationDefault()},projectId);
  return getFirestore(app);
}
const source=database('xeomsc-a8edd'), target=database('xeomsc-licencje');
const base='artifacts/xeomsc-fusionart/public/data';
const snap=await source.doc(base+'/siteConfig/main').get();
if (!snap.exists || !snap.data().categories) throw Error('Brak katalogu źródłowego.');
const original=snap.data();
const catalog=Object.fromEntries(['categories','galleries','textContent','heroItems','customOrders'].filter(k=>original[k]!==undefined).map(k=>[k,original[k]]));
const serialized=JSON.stringify(catalog), published=JSON.stringify(publicWorkshop(catalog));
const fingerprint=createHash('sha256').update(serialized).digest('hex');
if (Math.max(Buffer.byteLength(serialized),Buffer.byteLength(published))>1000000) throw Error('Katalog wymaga podziału przed migracją.');
const privateRef=target.doc('portfolio_catalog/main'), publicRef=target.doc('app_config/pf-workshop-v1');
await target.runTransaction(async tx=>{
  const [priv,pub]=await Promise.all([tx.get(privateRef),tx.get(publicRef)]);
  if(priv.exists || pub.exists){
    if(!priv.exists || !pub.exists || priv.get('sourceHash')!==fingerprint) throw Error('Docelowy katalog już istnieje lub źródło uległo zmianie. Sprawdź wersje przed dalszym przenoszeniem.');
    const projected=publicWorkshop(JSON.parse(priv.get('catalog')));
    assert.deepEqual(JSON.parse(pub.get('catalog')),projected);
  } else if(apply) {
    tx.create(privateRef,{catalog:serialized,revision:1,sourceHash:fingerprint});
    tx.create(publicRef,{catalog:published,revision:1});
  }
});
if(apply) {
  const priv=await privateRef.get(),pub=await publicRef.get();
  assert.deepEqual(JSON.parse(pub.get('catalog')),publicWorkshop(JSON.parse(priv.get('catalog'))));
}
let count=0;
for await (const msg of source.collection(base+'/messages').stream()){
  const raw=msg.data();
  const date=raw.date?.toDate?.() || new Date(raw.date);
  const ref=target.doc('portfolio_inquiries/legacy-'+msg.id);
  const record={...raw,date:Number.isFinite(date.valueOf())?Timestamp.fromDate(date):msg.createTime,sourceVersion:msg.updateTime.toDate().toISOString()};
  // Previous conversations use email replies and never receive a public mailbox.
  delete record.mailboxId; delete record.replyKey;
  await target.runTransaction(async tx=>{
    const existing=await tx.get(ref);
    if(existing.exists){
      if(existing.get('sourceVersion')!==record.sourceVersion) throw Error('Rozmowa źródłowa zmieniła się po skopiowaniu. Wymaga uzgodnienia wersji.');
    } else if(apply) tx.create(ref,record);
  });
  if(apply) assert.equal((await ref.get()).get('sourceVersion'),record.sourceVersion);
  count++;
}
console.log(`${apply?'Zweryfikowano przeniesienie':'Sprawdzono dane do przeniesienia'}. Kategorie: ${Object.keys(catalog.categories).length}, rozmowy: ${count}.`);
