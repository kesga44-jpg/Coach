// Patch 1 — startdata bevat alleen fictieve personen; bestaande installaties houden hun eigen gegevens.
// Deze tests falen als er weer echte (niet door de generator gemaakte) spelers in app.js of de testdataset komen.
const test=require('node:test'),assert=require('node:assert');
const fs=require('fs'),path=require('path');
const {createApp}=require('./harness.js');
const {genereer,VOORNAMEN,ACHTERNAMEN}=require('./tools/maak-fictieve-startdata.js');
const V2='footballCoachDataV2',V1='footballCoachDataV1';
const embedded=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'app.js'),'utf8').split('\n')[1].replace(/^window\.STARTER_DATA=/,'').replace(/;\s*$/,''));
const plain=v=>JSON.parse(JSON.stringify(v));

test('startdata in app.js is exact de uitvoer van de fictieve generator (spelers, trainingen, wedstrijden)',()=>{
  const sd=embedded(),g=genereer(sd.exercises.map(e=>e.id));
  assert.deepStrictEqual(sd.players,plain(g.players));
  assert.deepStrictEqual(sd.trainings,plain(g.trainings));
  assert.deepStrictEqual(sd.matches,plain(g.matches));
  assert.strictEqual(sd.meta.fictional,true);
  assert.ok(!/xlsm|Aanwezigheid spelers/i.test(JSON.stringify(sd.meta)),'geen verwijzing naar de echte bron');
  assert.strictEqual((sd.coachNotes||[]).length,0);assert.strictEqual((sd.documents||[]).length,0);
});

test('alle namen komen uit de fictieve namenlijst en alle spelers-id\'s in de startdata zijn fictief',()=>{
  const sd=embedded(),allowed=new Set(VOORNAMEN.map((v,i)=>`${v} ${ACHTERNAMEN[i]}`));
  sd.players.forEach(p=>assert.ok(allowed.has(p.name),p.name));
  const ids=new Set(sd.players.map(p=>p.id));
  ids.forEach(id=>assert.match(id,/^p-fictief-\d{2}$/));
  const refs=JSON.stringify([sd.trainings,sd.matches,sd.tactics,sd.teams]).match(/"p-[a-z0-9-]+"/g)||[];
  refs.forEach(r=>assert.ok(ids.has(r.slice(1,-1)),'onbekende spelersverwijzing '+r));
  const line=fs.readFileSync(path.join(__dirname,'app.js'),'utf8').split('\n')[1];
  assert.ok(!/"p-(?!fictief-)[a-z]/.test(line),'geen andere spelers-id\'s in de startdata');
});

test('testdataset voor de rekenregels is ook fictief',()=>{
  const ds=JSON.parse(fs.readFileSync(path.join(__dirname,'tests/fixtures/rekenregels-dataset.json'),'utf8'));
  const g=genereer(ds.exercises.map(e=>e.id));
  assert.deepStrictEqual(ds.players,plain(g.players));assert.strictEqual(ds.meta.fictional,true);
});

test('bestaande installatie (V2) houdt haar gegevens; er wordt niets opnieuw opgeslagen of gereset',()=>{
  const eigen=JSON.parse(createApp().ls.data[V2]);
  eigen.players=[{id:'p-eigen-1',firstName:'Eigen',lastName:'Speler',name:'Eigen Speler',primaryTeamId:eigen.teams[0].id,teamIds:[eigen.teams[0].id],active:true}];
  eigen.trainings=[{id:'t-eigen',teamId:eigen.teams[0].id,date:'2026-10-01',attendance:{'p-eigen-1':'Aanwezig'}}];
  const raw=JSON.stringify(eigen);
  for(let i=0;i<2;i++){                         // twee keer opstarten = "na een update"
    const a=createApp({store:{[V2]:raw}});
    assert.strictEqual(a.ls.data[V2],raw,'opslag byte-voor-byte ongewijzigd');
    assert.deepStrictEqual(a.t.state.players.map(p=>p.id),['p-eigen-1']);
    assert.ok(!a.t.state.players.some(p=>p.id.startsWith('p-fictief-')),'geen fictieve spelers bijgemengd');
  }
});

test('alleen V1-gegevens: worden naar V2 gekopieerd, V1 blijft, geen fictieve startdata',()=>{
  const eigen=JSON.parse(createApp().ls.data[V2]);eigen.players=[{id:'p-oud',name:'Oude Speler'}];eigen.trainings=[];eigen.matches=[];
  const a=createApp({store:{[V1]:JSON.stringify(eigen)}});
  assert.deepStrictEqual(a.t.state.players.map(p=>p.id),['p-oud']);
  assert.strictEqual(a.ls.data[V1],JSON.stringify(eigen));
});

test('nieuwe installatie krijgt fictieve voorbeelddata; clouddata vervangt die bij eerste sync',async()=>{
  const a=createApp();
  assert.ok(a.t.state.players.length>0&&a.t.state.players.every(p=>p.id.startsWith('p-fictief-')));
  const cloud=a.t.normalizedStateCopy(a.t.state);cloud.players=[{id:'p-cloud',name:'Cloud Speler',firstName:'Cloud',lastName:'Speler',primaryTeamId:cloud.teams[0].id,teamIds:[cloud.teams[0].id]}];
  const payload=await a.t.encryptData(cloud,'geheim'),UID='11111111-2222-3333-4444-555555555555';
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:'geheim'});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Date.now()+3600000,user:{id:UID,email:''}});
  a.sandbox.fetch=async url=>({ok:true,status:200,json:async()=>url.endsWith('/auth/v1/user')?{id:UID}:[{payload,updated_at:'2026-11-01T10:00:00+00:00'}],text:async()=>''});
  await a.t.initialSync();
  assert.deepStrictEqual(a.t.state.players.map(p=>p.id),['p-cloud']);
});
