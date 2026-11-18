import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('./', import.meta.url));
const directory = process.env.DATA_DIR || path.join(root, 'data');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4180);
const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
const password = process.env.ADMIN_PASSWORD || (local ? 'admin' : '');
if (!local && password.length < 14) throw Error('Ustaw ADMIN_PASSWORD o długości minimum 14 znaków.');
const hash = value => createHash('sha256').update(value).digest();
const secret = () => randomBytes(32).toString('base64url');
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(path.join(directory, 'studio.sqlite'));
db.exec(`
  PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,title TEXT,category TEXT,description TEXT,material TEXT,published INTEGER,featured INTEGER,revision INTEGER,created INTEGER);
  CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,project TEXT REFERENCES projects(id) ON DELETE CASCADE,position INTEGER,alt TEXT,mime TEXT,bytes BLOB);
  CREATE INDEX IF NOT EXISTS photo_order ON photos(project,position);
  CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,token TEXT UNIQUE,name TEXT,email TEXT,subject TEXT,closed INTEGER DEFAULT 0,unread INTEGER DEFAULT 1,updated INTEGER);
  CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,thread TEXT REFERENCES threads(id) ON DELETE CASCADE,role TEXT,body TEXT,created INTEGER);
  CREATE INDEX IF NOT EXISTS thread_posts ON posts(thread,id);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
`);
const all = (sql,...args) => db.prepare(sql).all(...args);
const one = (sql,...args) => db.prepare(sql).get(...args);
const run = (sql,...args) => db.prepare(sql).run(...args);
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
if (!one("SELECT key FROM settings WHERE key='seed'")) transaction(() => {
  const samples = [
    ['baza','Baza do koszyka','Makrama','Okrągła baza z otworami do przeplatania sznurka. Wizualizacja projektu o średnicy 10 cm.','Sklejka 3 mm',['baza','baza-rysunek']],
    ['krazki','Krążki do personalizacji','Półfabrykaty','Okrągłe elementy do ozdabiania lub przygotowania własnego graweru. Wizualizacja zestawu o średnicy 5 cm.','Sklejka',['krazki','krazek']]
  ];
  for (const [id,title,cat,desc,material,files] of samples) {
    run('INSERT INTO projects VALUES(?,?,?,?,?,1,?,1,?)',id,title,cat,desc,material,Number(id==='baza'),Date.now());
    files.forEach((file,i) => run('INSERT INTO photos VALUES(?,?,?,?,?,?)',randomUUID(),id,i,title+' — wizualizacja '+(i+1),'image/jpeg',readFileSync(path.join(root,'public/images',file+'.jpg'))));
  }
  run("INSERT INTO settings VALUES('seed','1')");
});
function fail(status,message) { throw Object.assign(Error(message), {status}); }
function field(value,max,min=0) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400,'Sprawdź długość i zawartość pól.');
  return value.trim();
}
async function body(req, max=24000) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) fail(415,'Wymagany format JSON.');
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>max) fail(413,'Za duży rozmiar danych.'); chunks.push(chunk); }
  try { const value=JSON.parse(Buffer.concat(chunks)); if (!value || Array.isArray(value) || typeof value!=='object') throw Error(); return value; }
  catch { fail(400,'Niepoprawne dane formularza.'); }
}
const sessions = new Map(), limits = new Map();
function rate(key,max,ms) {
  const now=Date.now(); let bucket=limits.get(key);
  if(!bucket || bucket.until<=now) {bucket={count:0,until:now+ms}; limits.set(key,bucket);}
  if(++bucket.count>max) fail(429,'Za dużo prób. Spróbuj ponownie później.');
}
setInterval(()=>{for(const [key,b] of limits) if(b.until<Date.now()) limits.delete(key); for(const [key,end] of sessions) if(end<Date.now()) sessions.delete(key);},60000).unref();
function listing(admin) {
  const projects=all('SELECT * FROM projects '+(admin?'':'WHERE published=1 ')+'ORDER BY featured DESC,created DESC,id');
  const photos=all('SELECT h.id,h.project,h.alt FROM photos h JOIN projects p ON h.project=p.id '+(admin?'':'WHERE p.published=1 ')+'ORDER BY h.position');
  const byId=new Map(projects.map(p=>[p.id,{...p,photos:[]}]));
  for(const photo of photos) byId.get(photo.project).photos.push({id:photo.id,alt:photo.alt,url:'/media/'+photo.id});
  return [...byId.values()];
}
function decodePhoto(data) {
  const match=/^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+=*)$/.exec(data || '');
  if (!match) fail(400,'Obsługiwane zdjęcia to JPG, PNG i WebP.');
  const buf=Buffer.from(match[2],'base64'), magic=buf.subarray(0,12);
  const valid={jpeg:magic[0]===255&&magic[1]===216&&magic[2]===255,png:magic.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),webp:magic.toString('ascii',0,4)==='RIFF'&&magic.toString('ascii',8,12)==='WEBP'};
  if (!buf.length || buf.length>1024*1024 || !valid[match[1]]) fail(400,'Niepoprawny obraz lub zdjęcie przekracza 1 MB po kompresji.');
  return {mime:'image/'+match[1],buf};
}
function saveProject(input) {
  const id=input.id?field(input.id,60,1):randomUUID();
  const title=field(input.title,100,1), category=field(input.category,60,1);
  const desc=field(input.description,2200), material=field(input.material,100);
  if(!Array.isArray(input.photos)||input.photos.length<1||input.photos.length>12) fail(400,'Dodaj od 1 do 12 zdjęć.');
  return transaction(()=>{
    const old=one('SELECT revision FROM projects WHERE id=?',id);
    if(input.id && (!old || old.revision!==input.revision)) fail(409,'Projekt został zmieniony. Odśwież panel.');
    if(old) run('UPDATE projects SET title=?,category=?,description=?,material=?,published=?,featured=?,revision=revision+1 WHERE id=?',title,category,desc,material,+!!input.published,+!!input.featured,id);
    else run('INSERT INTO projects VALUES(?,?,?,?,?,?,?,1,?)',id,title,category,desc,material,+!!input.published,+!!input.featured,Date.now());
    const keep=new Set();
    input.photos.forEach((p,i)=>{
      const alt=field(p.alt||title,180); let picture=p.id;
      if(picture) {
        if(keep.has(picture)||!one('SELECT id FROM photos WHERE id=? AND project=?',picture,id)) fail(400,'Niepoprawny wybór zdjęcia.');
        run('UPDATE photos SET position=?,alt=? WHERE id=?',i,alt,picture);
      } else {
        const {mime,buf}=decodePhoto(p.data); picture=randomUUID();
        run('INSERT INTO photos VALUES(?,?,?,?,?,?)',picture,id,i,alt,mime,buf);
      }
      keep.add(picture);
    });
    for(const p of all('SELECT id FROM photos WHERE project=?',id)) if(!keep.has(p.id)) run('DELETE FROM photos WHERE id=?',p.id);
    return {id};
  });
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};
function threadView(thread) {
  return {subject:thread.subject,closed:!!thread.closed,posts:all('SELECT role,body,created FROM posts WHERE thread=? ORDER BY id',thread.id)};
}
function postTo(thread,role,text) {
  if(thread.closed) fail(409,'Ta rozmowa została zamknięta.');
  transaction(()=>{
    run('INSERT INTO posts(thread,role,body,created) VALUES(?,?,?,?)',thread.id,role,field(text,4000,1),Date.now());
    run('UPDATE threads SET unread=?,updated=? WHERE id=?',Number(role==='client'),Date.now(),thread.id);
  });
}
export async function handle(req,res) {
  const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const pathname=new URL(req.url,'http://localhost').pathname, method=req.method;
    if(local && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host||'')) fail(403,'Adres lokalny jest nieprawidłowy.');
    if(method!=='GET' && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) fail(403,'Nieprawidłowe źródło formularza.');
    const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)studio_session=([A-Za-z0-9_-]+)/)?.[1];
    const authenticated=(sessions.get(cookie)||0)>Date.now();
    const ip=req.socket.remoteAddress||'local';
    if(pathname==='/api/login' && method==='POST') {
      rate('login'+ip,20,600000);const input=await body(req);
      if(input.login!=='admin' || !timingSafeEqual(hash(String(input.password)),hash(password))) fail(401,'Niepoprawny login lub hasło.');
      const key=secret();sessions.set(key,Date.now()+8*3600000);
      res.setHeader('Set-Cookie','studio_session='+key+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(local?'':'; Secure'));return send({ok:true});
    }
    if(pathname==='/api/logout' && method==='POST') {sessions.delete(cookie);res.setHeader('Set-Cookie','studio_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');return send({ok:true});}
    if(pathname.startsWith('/api/admin/') && !authenticated) fail(401,'Zaloguj się do panelu.');
    if(pathname==='/api/projects' && method==='GET') return send(listing(false));
    if(pathname==='/api/admin/projects' && method==='GET') return send(listing(true));
    if(pathname==='/api/admin/projects' && method==='POST') return send(saveProject(await body(req,18*1024*1024)));
    if(pathname==='/api/admin/remove' && method==='POST') {
      const input=await body(req); const op=run('DELETE FROM projects WHERE id=? AND revision=?',input.id,input.revision);
      if(!op.changes) fail(409,'Odśwież listę projektów.');return send({ok:true});
    }
    if(pathname.startsWith('/media/') && method==='GET'){
      const p=one('SELECT h.bytes,h.mime FROM photos h JOIN projects p ON p.id=h.project WHERE h.id=? AND (p.published=1 OR ?=1)',pathname.slice(7),+authenticated);
      if(!p) fail(404,'Nie znaleziono zdjęcia.');res.writeHead(200,{'Content-Type':p.mime,'Cache-Control':'private, no-cache'});return res.end(p.bytes);
    }
    if(pathname==='/api/inquiry' && method==='POST') {
      rate('inquiry'+ip,20,3600000);const b=await body(req);
      const name=field(b.name,80,1),email=field(b.email,254,3),text=field(b.text,4000,5);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||b.website) fail(400,'Sprawdź dane kontaktowe.');
      const subject=b.project?one('SELECT title FROM projects WHERE id=? AND published=1',field(b.project,60,1))?.title:'Projekt indywidualny';
      if(!subject) fail(409,'Projekt nie jest już dostępny.');
      const token=secret(),id=randomUUID();
      transaction(()=>{run('INSERT INTO threads(id,token,name,email,subject,updated) VALUES(?,?,?,?,?,?)',id,hash(token).toString('hex'),name,email,subject,Date.now());
        run('INSERT INTO posts(thread,role,body,created) VALUES(?,?,?,?)',id,'client',text,Date.now());});
      return send({token},201);
    }
    if(['/api/thread','/api/thread/reply'].includes(pathname) && method==='POST'){
      const b=await body(req);const thread=one('SELECT * FROM threads WHERE token=?',hash(field(b.token,60,32)).toString('hex'));
      if(!thread) fail(404,'Nie znaleziono rozmowy. Sprawdź prywatny link.');
      if(pathname.endsWith('/reply')){rate('reply'+thread.id,30,3600000);postTo(thread,'client',b.text);}
      return send(threadView(thread));
    }
    if(pathname==='/api/admin/inbox' && method==='GET') return send(all('SELECT id,name,email,subject,closed,unread,updated FROM threads ORDER BY updated DESC'));
    if(pathname==='/api/admin/thread' && method==='POST') {
      const b=await body(req);let t=one('SELECT * FROM threads WHERE id=?',field(b.id,60,1));if(!t) fail(404,'Brak rozmowy.');
      if(b.action==='reply') postTo(t,'studio',b.text);
      if(b.action==='close'||b.action==='open') {t.closed=Number(b.action==='close');run('UPDATE threads SET closed=? WHERE id=?',t.closed,t.id);}
      run('UPDATE threads SET unread=0 WHERE id=?',t.id);return send(threadView(t));
    }
    const files={'/':'index.html','/admin':'admin.html','/rozmowa':'thread.html'};
    const file=files[pathname] || (/^\/(site|admin|thread|common|calculator)\.js$|^\/style\.css$|^\/images\/[a-z-]+\.jpg$/.test(pathname)?pathname.slice(1):null);
    if(method!=='GET'||!file||!existsSync(path.join(root,'public',file))) fail(404,'Nie znaleziono strony.');
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});res.end(readFileSync(path.join(root,'public',file)));
  } catch(error){if(!error.status) console.error(error.message); if(!res.headersSent) send({error:error.status?error.message:'Błąd serwera.'},error.status||500);else res.end();}
}
export function closeDatabase(){db.close();}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) http.createServer(handle).listen(port,host,()=>console.log('Xeomsc Laser: http://'+host+':'+server.address().port));
