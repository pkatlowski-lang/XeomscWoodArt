const algorithm = {name:'ECDH',namedCurve:'P-256'};
const encode = bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode = str=>Uint8Array.from(atob(str.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const importPublic = raw=>crypto.subtle.importKey('raw',decode(raw),algorithm,false,[]);
async function shared(privateKey,rawPublic){
  return crypto.subtle.deriveKey({name:'ECDH',public:await importPublic(rawPublic)},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function newMailbox(){
  const pair=await crypto.subtle.generateKey(algorithm,true,['deriveKey']);
  const id=crypto.randomUUID();
  const privateKey=encode(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
  const publicKey=encode(await crypto.subtle.exportKey('raw',pair.publicKey));
  return {id,publicKey,link:'/odpowiedz/#'+id+'.'+privateKey};
}
export async function seal(publicKey,body){
  const pair=await crypto.subtle.generateKey(algorithm,true,['deriveKey']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await shared(pair.privateKey,publicKey);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(body));
  return {sender:encode(await crypto.subtle.exportKey('raw',pair.publicKey)),iv:encode(iv),cipher:encode(cipher),created:new Date().toISOString()};
}
export async function unseal(privateKey,record){
  const secret=await crypto.subtle.importKey('pkcs8',decode(privateKey),algorithm,false,['deriveKey']);
  const key=await shared(secret,record.sender);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv)},key,decode(record.cipher));
  return new TextDecoder().decode(plain);
}
