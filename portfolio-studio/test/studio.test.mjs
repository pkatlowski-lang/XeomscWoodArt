import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';


import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {estimate} from '../public/calculator.js';

test('Galeria, projekt, prywatna rozmowa i wycena',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'xeomsc-test-'));
  let app, cookie;
  const base='http://127.0.0.1';
  async function start(){
    Object.assign(process.env,{HOST:'127.0.0.1',ADMIN_PASSWORD:'admin',DATA_DIR:dir});
    app=await import('../server.mjs?test='+Math.random());
  }
  async function stop(){app.closeDatabase();app=null;}
  async function fetch(url,options={}){
    const req=Readable.from(options.body?[Buffer.from(options.body)]:[]);
    req.url=new URL(url).pathname;req.method=options.method||'GET';req.socket={remoteAddress:'127.0.0.1'};
    req.headers={host:'127.0.0.1',...Object.fromEntries(new Headers(options.headers))};
    const headers=new Headers();let status=200,content;
    const res={setHeader:(name,value)=>headers.set(name,value),
      writeHead(code,values){status=code;for(const [k,v] of Object.entries(values))headers.set(k,v);},
      end(data){content=data;}};
    await app.handle(req,res);return new Response(content,{status,headers});
  }
  async function api(route,body,admin=false){
    const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(admin?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return [response.status,await response.json(),response.headers];
  }
  try{
    await start();
    const publicRoutes=['/','/admin','/rozmowa','/site.js','/common.js','/style.css','/admin.js','/thread.js','/calculator.js'];
    for(const url of publicRoutes)assert.equal((await fetch(base+url)).status,200,url);
    assert.equal((await api('/api/admin/inbox'))[0],401);
    assert.equal((await api('/api/login',{login:'admin',password:'inny'}))[0],401);
    const login=await api('/api/login',{login:'admin',password:'admin'});assert.equal(login[0],200);cookie=login[2].get('set-cookie').split(';')[0];
    const bytes=await readFile(new URL('../public/images/baza.jpg',import.meta.url));
    const data='data:image/jpeg;base64,'+bytes.toString('base64');
    const draft={title:'Test',description:'Opis',material:'Sklejka',category:'Test',published:false,photos:[{data,alt:'A'},{data,alt:'B'}]};
    const saved=await api('/api/admin/projects',draft,true);assert.equal(saved[0],200);
    let row=(await api('/api/admin/projects',undefined,true))[1].find(p=>p.id===saved[1].id);
    assert.equal((await fetch(base+row.photos[0].url)).status,404);
    assert.ok(!(await api('/api/projects'))[1].some(p=>p.id===row.id));
    const published={...row,published:true,photos:row.photos.toReversed()};
    assert.equal((await api('/api/admin/projects',published,true))[0],200);
    assert.equal((await api('/api/admin/projects',published,true))[0],409);
    row=(await api('/api/projects'))[1].find(p=>p.id===saved[1].id);assert.equal(row.photos[0].alt,'B');
    assert.equal((await fetch(base+row.photos[0].url)).status,200);
    const q=await api('/api/inquiry',{name:'Test',email:'test@example.org',text:'Pytanie o projekt',project:row.id});
    assert.equal(q[0],201);const token=q[1].token;
    assert.equal((await api('/api/thread',{token:'x'.repeat(43)}))[0],404);
    const [thread]=(await api('/api/admin/inbox',undefined,true))[1];assert.equal(thread.subject,'Test');
    await api('/api/admin/thread',{id:thread.id,action:'reply',text:'Odpowiedź pracowni'},true);
    assert.equal((await api('/api/thread',{token}))[1].posts.at(-1).body,'Odpowiedź pracowni');
    assert.equal((await api('/api/thread/reply',{token,text:'Dziękuję'}))[0],200);
    await api('/api/admin/thread',{id:thread.id,action:'close'},true);
    assert.equal((await api('/api/thread/reply',{token,text:'Jeszcze raz'}))[0],409);
    const quote=estimate(new Map(Object.entries({width:38,height:38,qty:2,sheetCost:18,sheetW:76,sheetH:76,minutes:20,rate:1.2,extras:5})));
    assert.equal(quote.total,38);assert.equal(quote.unit,19);
    await stop();await start();assert.equal((await api('/api/thread',{token}))[1].posts.length,3);
    assert.equal((await api('/api/admin/projects',undefined,true))[0],401);
  }finally{if(app)await stop();await rm(dir,{recursive:true,force:true});}
});
