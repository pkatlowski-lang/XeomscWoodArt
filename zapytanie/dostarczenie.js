import {getOwnerConfig} from '../panel/config.js';
import {newMailbox} from '../panel/letter.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {getAuth, signInAnonymously} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {getFirestore,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
export {newMailbox};
export async function deliverInquiry(box, input) {
  const app = initializeApp(await getOwnerConfig(),'portfolio-customer');
  const auth = getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  const data = {name:input.name.trim(),email:input.email.trim(),message:input.message.trim(),date:serverTimestamp(),status:'new',read:false,mailboxId:box.id,replyKey:box.publicKey};
  if (!data.name || !data.message || data.name.length>90 || data.email.length>180 || data.message.length>3500) throw Error('Sprawdź imię, adres i długość wiadomości.');
  for (const key of ['attachment','vizImg','svgFile']) if(input[key]) data[key]=input[key];
  await setDoc(doc(getFirestore(app),'portfolio_inquiries',box.id),data);
  return box.link+'.'+Date.now();
}
