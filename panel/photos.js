import {workshopProjects} from '../assets/realizacje/projekty.js';

const documents = 'https://firestore.googleapis.com/v1/projects/xeomsc-licencje/databases/(default)/documents/app_config/';
const cache = new Map();
export async function publicRecord(id) {
  const response = await fetch(documents + encodeURIComponent(id), {cache:'no-store',referrerPolicy:'no-referrer'});
  if (response.status === 404) return null;
  if (!response.ok) throw Error('Nie udało się pobrać danych pracowni.');
  return (await response.json()).fields || {};
}
function imageData(id) {
  if (!cache.has(id)) cache.set(id, publicRecord('pf-img-'+id).then(fields=>{
    const data = fields?.data?.stringValue;
    if (!data?.startsWith('data:image/webp;base64,')) throw Error('Zdjęcie niedostępne.');
    return data;
  }).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}
export function setPhoto(img,p) {
  const mark=Symbol();img._request=mark;img.alt=p?.alt||'Zdjęcie realizacji';
  if (!p?.asset) {if(p?.url || p?.data) img.src=p.url||p.data;return;}
  img.removeAttribute('src');
  imageData(p.asset).then(url=>{if(img._request===mark)img.src=url;}).catch(()=>{if(img._request===mark)img.alt='Zdjęcie chwilowo niedostępne';});
}
export function studioPhoto(p){const img=document.createElement('img');setPhoto(img,p);return img;}
export function mergeProjects(base,changes) {
  const overlays=new Map(changes.map(p=>[p.id,p]));
  const originals=[...workshopProjects,...base].filter(p=>!overlays.has(p.id));
  return [...changes.filter(p=>!p.removed),...originals].sort((a,b)=>Number(!!b.featured)-Number(!!a.featured));
}
export async function publishedChanges() {
  const fields=await publicRecord('pf-catalog-v1');return JSON.parse(fields?.entries?.stringValue||'[]');
}
