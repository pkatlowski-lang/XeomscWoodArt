export const $ = selector => document.querySelector(selector);
export function node(tag, text = '', className = '') {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function button(text, action, className = 'outline') {
  const element = node('button', text, className);
  element.type = 'button';
  element.onclick = action;
  return element;
}
export function photo(p) {
  const image = node('img'); image.src = p.url; image.alt = p.alt || ''; return image;
}
export async function api(path, body) {
  const options = body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)};
  let response;
  try { response = await fetch('/api/' + path, {cache:'no-store', ...options}); }
  catch { throw Error('Brak połączenia. Sprawdź internet i spróbuj ponownie.'); }
  const data = await response.json();
  if (!response.ok) throw Object.assign(Error(data.error || 'Nie udało się wykonać operacji.'), {status:response.status});
  return data;
}
export function bindForm(form, action) {
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('button:not([type=button])'), out = form.querySelector('output');
    if (submit.disabled) return;
    submit.disabled = true; out.textContent = 'Chwileczkę…';
    try { out.textContent = await action(new FormData(form)) || ''; }
    catch (error) { out.textContent = error.message; }
    finally { submit.disabled = false; }
  };
}
export function messages(container, posts, attachmentFor) {
  container.replaceChildren();
  for(const post of posts) {
    const item=node('article','','bubble '+post.role);
    item.append(node('small',(post.role==='studio'?'Pracownia':'Klient')+' · '+new Date(post.created).toLocaleString('pl-PL')),node('p',post.body));
    const file = attachmentFor?.(post);
    if (file) item.append(file);
    container.append(item);
  }
}
export function dialogControls() {
  document.querySelectorAll('dialog .x').forEach(close=>close.onclick=()=>close.closest('dialog').close());
}

