import {publicRecord} from '../panel/photos.js';
import {unseal} from '../panel/letter.js';
const [id,secret]=location.hash.slice(1).split('.');
const status=document.querySelector('#status');
async function refresh(){
  if(!/^[a-f0-9-]{36}$/.test(id)||!secret){status.textContent='Otwórz pełny link otrzymany po wysłaniu zapytania.';return;}
  try{
    const fields=await publicRecord('pf-reply-'+id);
    const records=JSON.parse(fields?.letters?.stringValue||'[]');
    const letters=await Promise.all(records.map(async r=>{
      const box=document.createElement('article'),p=document.createElement('p'),date=document.createElement('small');
      box.className='bubble studio';date.textContent=new Date(r.created).toLocaleString('pl-PL');
      p.textContent=await unseal(secret,r);box.append(date,p);return box;
    }));
    document.querySelector('#letters').replaceChildren(...letters);
    status.textContent=letters.length?'Wiadomości od pracowni':'Zapytanie dotarło do pracowni. Tutaj pojawi się odpowiedź.';
  }catch{status.textContent='Nie udało się odczytać odpowiedzi. Sprawdź połączenie i otwórz pełny prywatny link.';}
}
document.querySelector('#reload').onclick=refresh;
document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);status.textContent='Skopiowano prywatny link.';}catch{status.textContent='Skopiuj cały adres z paska przeglądarki.';}};
refresh();
