import {$,api,bindForm,messages} from './common.js';
const token=location.hash.slice(1);
function show(t) {
  $('#subject').textContent=t.subject;messages($('#posts'),t.posts);
  $('#reply').hidden=t.closed;$('#status').textContent=t.closed?'Rozmowa zamknięta.':'Wiadomości w tej rozmowie odświeżają się automatycznie.';
}
async function refresh(){try{show(await api('thread',{token}));}catch(e){$('#status').textContent=e.message;}}
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('#copy').textContent='Skopiowano link';}catch{const input=$('#manual');input.hidden=false;input.value=location.href;input.select();}};
bindForm($('#reply'),async f=>{show(await api('thread/reply',{token,text:f.get('text')}));$('#reply').reset();return 'Wysłano.';});
await refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);
