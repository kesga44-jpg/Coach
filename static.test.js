// Statische controles en offline-gedrag van de service worker (zonder browser, zonder dependencies).
const test=require('node:test'),assert=require('node:assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');

test('versies in index.html, service worker en app.js lopen gelijk; alle CORE-bestanden bestaan',()=>{
  const html=read('index.html'),sw=read('sw.js'),app=read('app.js');
  const appV=app.match(/const APP_VERSION='([^']+)'/)[1];
  assert.ok(html.includes(`app.js?v=${appV}`)&&html.includes(`style.css?v=${appV}`),'index.html verwijst naar huidige versie');
  assert.ok(sw.includes(`football-coach-v${appV}`),'cachenaam bevat appversie');
  const core=JSON.parse(sw.match(/const CORE=(\[[^\]]+\])/)[1].replace(/'/g,'"'));
  for(const ref of [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g)].map(m=>'./'+m[1]))assert.ok(core.includes(ref),`${ref} staat in CORE`);
  for(const f of core.filter(x=>x!=='./').map(x=>x.replace(/^\.\//,'').replace(/\?.*$/,'')))assert.ok(fs.existsSync(path.join(__dirname,f)),f+' bestaat');
  JSON.parse(read('manifest.json'));
});

test('geen geheime sleutels in de broncode (alleen de publishable key is toegestaan)',()=>{
  const files=['app.js','kennis.js','index.html','sw.js','harness.js',...fs.readdirSync(__dirname).filter(f=>/\.(md|sql|json|ya?ml|example)$/.test(f))];
  const bad=[/sb_secret_[A-Za-z0-9_-]{10,}/,/service_role["']?\s*[:=]\s*["']ey/i,/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,/sk-[A-Za-z0-9]{32,}/,/-----BEGIN (RSA )?PRIVATE KEY-----/];
  for(const f of files){if(!fs.existsSync(path.join(__dirname,f)))continue;const s=read(f);for(const re of bad)assert.ok(!re.test(s),`${f}: ${re}`)}
  const keys=[...read('app.js').matchAll(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g)].map(m=>m[1]);
  assert.ok(keys.every(k=>k==='publishable'));
});

test('externe scripts zijn exact gepind (geen @latest of ongeversioneerde CDN-urls)',()=>{
  const urls=[...read('app.js').matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/([^'"`\s]+)/g)].map(m=>m[1]);
  assert.ok(urls.length>0);
  for(const u of urls)assert.match(u,/^[a-z0-9.-]+@\d+\.\d+\.\d+\//,u);
  assert.ok(read('app.js').includes('isEvalSupported:false'),'pdf.js zonder eval (CVE-2024-4367, interim)');
});

function loadSw(){
  const handlers={},store=new Map(),cacheNames=new Set();let online=true;const net={};
  const mkCache=name=>({addAll:async urls=>{for(const u of urls){const r=await self.fetchImpl(new URL(u,'https://kees.example/Coach/').href);store.set(name+'|'+new URL(u,'https://kees.example/Coach/').href,r)}},put:async(req,res)=>{store.set(name+'|'+(req.url||req),res)}});
  const self={addEventListener:(t,f)=>handlers[t]=f,skipWaiting:()=>{},clients:{claim:()=>{}},
    fetchImpl:async url=>{if(!online)throw new TypeError('Failed to fetch');net[url]=(net[url]||0)+1;return {url,body:'net:'+url,clone(){return this}}}};
  const caches={open:async n=>{cacheNames.add(n);return mkCache(n)},keys:async()=>[...cacheNames],delete:async n=>{cacheNames.delete(n);for(const k of [...store.keys()])if(k.startsWith(n+'|'))store.delete(k);return true},
    match:async req=>{const url=req.url||req;for(const [k,v] of store)if(k.endsWith('|'+url))return v;return undefined}};
  const ctx=vm.createContext({self,caches,URL,location:{origin:'https://kees.example'},fetch:u=>self.fetchImpl(u.url||u),Promise,console});
  vm.runInContext(read('sw.js'),ctx);
  const run=async(type,ev)=>{let p;ev.waitUntil=x=>p=x;ev.respondWith=x=>p=x;handlers[type](ev);return p};
  return {run,setOnline:v=>online=v,store,cacheNames,net};
}
test('service worker: installeert alle kernbestanden en werkt offline; oude caches worden opgeruimd',async()=>{
  const core=JSON.parse(read('sw.js').match(/const CORE=(\[[^\]]+\])/)[1].replace(/'/g,'"'));
  const sw=loadSw();
  sw.cacheNames.add('football-coach-v2.9.1-kd1');
  await sw.run('install',{});
  await sw.run('activate',{});
  assert.deepStrictEqual([...sw.cacheNames].filter(n=>n.startsWith('football-coach')).length,1);
  sw.setOnline(false);
  for(const p of ['index.html',...core.filter(x=>/\?v=/.test(x)).map(x=>x.slice(2)),'']){
    const url='https://kees.example/Coach/'+p;
    const res=await sw.run('fetch',{request:{method:'GET',url}});
    assert.ok(res&&res.body,'offline beschikbaar: '+(p||'./'));
  }
  const post=await sw.run('fetch',{request:{method:'POST',url:'https://kees.example/Coach/x'}});
  assert.strictEqual(post,undefined,'POST wordt niet onderschept');
});
