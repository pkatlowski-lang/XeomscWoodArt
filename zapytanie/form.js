import {getOwnerConfig} from '../panel/config.js';
import {newMailbox} from '../panel/letter.js';
const form=document.querySelector('#request'),btn=form.querySelector('button'),status=form.querySelector('output');
const params=new URLSearchParams(location.search),title=(params.get('zapytanie')||'').slice(0,150),code=(params.get('kod')||'').slice(0,80);
if(title)form.elements.message.value='Dzień dobry, interesuje mnie projekt „'+title+'”'+(code?' ('+code+')':'')+'. ';
let pending=null;
async function submit(event){
  event.preventDefault();if(btn.disabled)return;
  btn.disabled=true;status.textContent='Wysyłanie zapytania…';
  const m = Object.fromEntries(new FormData(form));
  const lines = [m.message.trim()];
  if (m.dimensions?.trim()) lines.push('Przybliżony wymiar (cm): ' + m.dimensions.trim());
  if (m.quantity) lines.push('Liczba sztuk: ' + m.quantity);
  const message = lines.join('\n');
  if (message.length > 3500) {
    btn.disabled = false;
    status.textContent = 'Skróć wiadomość o ' + (message.length - 3500) + ' znaków, aby zmieścić dane wyceny.';
    return;
  }
  try{
    const [[{initializeApp},{getAuth,signInAnonymously},{getFirestore,doc,setDoc,serverTimestamp}],box]=await Promise.all([
      Promise.all(['app','auth','firestore'].map(name=>import('https://www.gstatic.com/firebasejs/11.6.1/firebase-'+name+'.js'))),
      pending ? Promise.resolve(pending) : newMailbox()
    ]);
    pending=box;
    const app=initializeApp(await getOwnerConfig(),"portfolio-customer"),auth=getAuth(app);await auth.authStateReady();
    if(!auth.currentUser)await signInAnonymously(auth);
    if(!m.name.trim()||!m.message.trim())throw Error('Uzupełnij imię i wiadomość.');
    await setDoc(doc(getFirestore(app),'portfolio_inquiries',box.id),{
      name:m.name.trim(),email:m.email.trim(),message,date:serverTimestamp(),status:'new',read:false,mailboxId:box.id,replyKey:box.publicKey
    });
    const link=document.createElement('a');link.href=box.link+'.'+Date.now();link.textContent='Otwórz prywatny link do odpowiedzi';
    status.replaceChildren('Zapytanie wysłane. ',link);location.replace(link.href);
  }catch{btn.disabled=false;status.textContent='Nie udało się wysłać zapytania. Spróbuj ponownie lub skorzystaj z kontaktu na stronie głównej.';}
}
form.onsubmit=submit;btn.disabled=false;status.textContent='';
