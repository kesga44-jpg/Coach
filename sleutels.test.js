// Patch 2 — sleutelcontrole: welke Supabase-sleutel staat in de clientcode, en wat is de “Secret key” in de app?
// Faalt zodra er een service_role-/secret key of een niet-anon JWT in browsercode komt.
const test=require('node:test'),assert=require('node:assert');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createApp}=require('./harness.js');
const CLIENT=['app.js','kennis.js','index.html','sw.js','manifest.json'];

function scanClientCode(text){
  const found=[];
  for(const m of text.matchAll(/sb_(publishable|secret)_[A-Za-z0-9_-]{8,}/g))if(m[1]!=='publishable')found.push('Supabase secret key (sb_secret_)');
  for(const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)){
    let role='onleesbaar';try{role=JSON.parse(Buffer.from(m[1],'base64url').toString()).role||'geen rol'}catch{}
    if(role!=='anon')found.push(`JWT met rol "${role}"`);
  }
  if(/service_role/i.test(text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'')))found.push('tekst "service_role" in code');
  return found;
}

test('clientcode bevat alleen de publishable key; geen secret/service_role-key of niet-anon JWT',()=>{
  for(const f of CLIENT){const p=path.join(__dirname,f);if(fs.existsSync(p))assert.deepStrictEqual(scanClientCode(fs.readFileSync(p,'utf8')),[],f)}
  const key=fs.readFileSync(path.join(__dirname,'app.js'),'utf8').match(/const SYNC_PUBLIC_KEY='([^']+)'/)[1];
  assert.match(key,/^sb_publishable_/,'SYNC_PUBLIC_KEY is een publishable key');
});

test('zelftest scanner: herkent secret key, service_role-JWT en tekst service_role (zonder echte sleutels)',()=>{
  const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const fakeJwt=r=>`${b({alg:'HS256',typ:'JWT'})}.${b({role:r,iss:'supabase'})}.${'x'.repeat(20)}`;
  assert.ok(scanClientCode(`const k='sb_${'secret'}_${'A'.repeat(20)}'`).length===1);
  assert.ok(scanClientCode(`const k='${fakeJwt('service_role')}'`).some(x=>/service_role/.test(x)));
  assert.strictEqual(scanClientCode(`const k='${fakeJwt('anon')}'`).length,0,'anon-JWT is toegestaan');
  assert.ok(scanClientCode(`headers:{role:'service_role'}`).length===1);
});

test('de “Secret key” van de app is een eigen wachtwoordzin voor versleuteling en wordt nooit verstuurd',async()=>{
  const a=createApp(),PASS='Mijn-Eigen-Zin-2026',UID='11111111-2222-3333-4444-555555555555';
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:PASS});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:UID,email:''}});
  const calls=[];a.sandbox.fetch=async(url,opt={})=>{calls.push(JSON.stringify([url,opt.headers,typeof opt.body==='string'?opt.body:opt.body&&typeof opt.body.text==='function'?Buffer.from(await opt.body.arrayBuffer()).toString('latin1'):'']));return {ok:true,status:url.includes('/rest/v1/')&&opt.method==='POST'?201:200,json:async()=>url.endsWith('/auth/v1/user')?{id:UID}:url.includes('/rest/v1/')&&opt.method==='POST'?[{updated_at:new Date().toISOString()}]:[],text:async()=>'',arrayBuffer:async()=>new ArrayBuffer(0)}};
  await a.t.pushSync(false);
  const file=new File(['%PDF-1.4 test'],'pvb1.pdf',{type:'application/pdf'});
  await a.sandbox.uploadKnowledgeFile('pvb1',file,{saveAfter:false});
  assert.ok(calls.length>=3,'netwerkverkeer gesimuleerd');
  for(const c of calls)assert.ok(!c.includes(PASS),'Secret key gelekt in '+c.slice(0,80));
  for(const c of calls)assert.ok(!/sb_secret_|service_role/.test(c));
});

test('BEVINDING S17 (huidig gedrag, gedocumenteerd): mapnaam in coach-knowledge = ongezouten SHA-256 van de Secret key',async()=>{
  const a=createApp(),PASS='zwak';
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:PASS});
  const p=await a.sandbox.knowledgeObjectPath('pvb1');
  const expected=crypto.createHash('sha256').update('football-coach-v2:'+PASS).digest('hex');
  assert.strictEqual(p,`${expected}/pvb1.fckb`);
  // Gevolg: wie de objectnamen kan oplijsten (anon SELECT), kan een zwakke Secret key offline raden zonder de PBKDF2-vertraging.
  // Oplossing hoort bij PR-10 (map = auth.uid()). Pas deze test aan zodra die wijziging er is.
});
