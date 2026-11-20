import {deliverInquiry,newMailbox} from './dostarczenie.js';
const form=document.querySelector('#request'),btn=form.querySelector('button'),status=form.querySelector('output');
const params=new URLSearchParams(location.search),title=(params.get('zapytanie')||'').slice(0,150),code=(params.get('kod')||'').slice(0,80);
if(title)form.elements.message.value='Dzień dobry, interesuje mnie projekt „'+title+'”'+(code?' ('+code+')':'')+'. ';
let pending=null;
async function submit(event){
  event.preventDefault();if(btn.disabled)return;
  btn.disabled=true;status.textContent='Wysyłanie zapytania…';
  try{
    pending ||= await newMailbox();
    const data=Object.fromEntries(new FormData(form));
    const file=document.querySelector('#inquiry-photo').files[0];
    if(file) {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>24*1024*1024) throw Error('Wybierz zdjęcie JPG, PNG lub WebP do 24 MB.');
      const bitmap=await createImageBitmap(file);
      try {
        const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)), canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        data.attachment=canvas.toDataURL('image/jpeg',.7);
        if(data.attachment.length>880000)throw Error('Zdjęcie jest za duże. Wybierz mniejszy plik.');
      } finally {bitmap.close();}
    }
    const link=document.createElement('a');link.href=await deliverInquiry(pending,data);link.textContent='Otwórz prywatny link do odpowiedzi';
    status.replaceChildren('Zapytanie wysłane. ',link);location.replace(link.href);
  }catch(error){btn.disabled=false;status.textContent=error.message||'Nie udało się wysłać zapytania.';}
}
form.onsubmit=submit;btn.disabled=false;status.textContent='';
