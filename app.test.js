const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
const V2='footballCoachDataV2',V1='footballCoachDataV1';
const starter=()=>JSON.parse(createApp().ls.data[V2]);

test('lokale opslag slaagt en schrijft V2',()=>{
  const a=createApp();a.t.state.team.name='Testteam';
  assert.notStrictEqual(a.t.save({render:false,sync:false}),false);
  assert.strictEqual(JSON.parse(a.ls.data[V2]).team.name,'Testteam');
});
test('mislukte lokale opslag geeft false + melding en laat oude opslag intact',()=>{
  const a=createApp(),before=a.ls.data[V2];
  a.ls.failWrites=true;a.t.state.team.name='Nieuw';
  assert.strictEqual(a.t.save({render:false,sync:false}),false);
  assert.strictEqual(a.ls.data[V2],before);
  assert.ok(a.toasts.some(m=>/Opslaan mislukt/.test(m)));
});
test('bestaande V2-data wordt geladen',()=>{
  const d=starter();d.team.name='Bestaand';
  const a=createApp({store:{[V2]:JSON.stringify(d)}});
  assert.strictEqual(a.t.state.team.name,'Bestaand');assert.strictEqual(a.t.storageLoadError,null);
});
test('V1-data wordt herkend en gekopieerd naar V2, V1 blijft staan',()=>{
  const d=starter();d.team.name='Oud V1';const raw=JSON.stringify(d);
  const a=createApp({store:{[V1]:raw}});
  assert.strictEqual(a.t.state.team.name,'Oud V1');
  assert.strictEqual(JSON.parse(a.ls.data[V2]).team.name,'Oud V1');
  assert.strictEqual(a.ls.data[V1],raw);
});
test('ongeldige opslag wordt niet overschreven en blokkeert opslaan',()=>{
  const a=createApp({store:{[V2]:'{kapot'}});
  assert.ok(a.t.storageLoadError);
  assert.strictEqual(a.t.save({render:false,sync:false}),false);
  assert.strictEqual(a.ls.data[V2],'{kapot');
});
test('validatie weigert dubbele id\'s en ongeldige structuur',()=>{
  const d=starter();d.players.push({...d.players[0]});
  assert.throws(()=>createApp().t.validateStateData(d),/Dubbel ID/);
  assert.throws(()=>createApp().t.validateStateData([]),/JSON-object/);
});
test('herstelpunt wordt bewaard bij overnemen van clouddata; falende opslag wijzigt state niet',()=>{
  const a=createApp(),remote=starter();remote.team.name='Cloud';
  a.t.persistRemoteCopy(remote);
  assert.strictEqual(a.t.state.team.name,'Cloud');
  assert.ok(JSON.parse(a.ls.data[a.t.RECOVERY_BACKUP_KEY]).raw);
  const b=createApp(),name=b.t.state.team.name;b.ls.failWrites=true;
  assert.throws(()=>b.t.persistRemoteCopy(remote));
  assert.strictEqual(b.t.state.team.name,name);
});
test('spelers met meerdere teams en aanwezigheid/selectie zijn gescheiden velden',()=>{
  const a=createApp(),p=a.t.state.players[0];
  assert.ok(Array.isArray(p.teamIds)&&p.teamIds.includes(p.primaryTeamId));
  a.t.state.matches.forEach(m=>{assert.ok(m.attendance&&typeof m.attendance==='object');assert.ok(Array.isArray(m.benchIds));assert.ok(m.lineup&&typeof m.lineup==='object')});
});

// Sync met gemockte fetch (Supabase Auth + coach_data_auth)
const S={url:'https://example.invalid',key:'k',pass:'geheim'};
const UID='11111111-2222-3333-4444-555555555555';
const SESSION={access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:UID,email:'a@b.nl'}};
const res=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
function login(a,session=SESSION){a.ls.data[a.t.AUTH_KEY]=JSON.stringify(session)}
function mockFetch(a,handler){const calls=[];a.sandbox.fetch=async(url,opt={})=>{const c={url,method:opt.method||'GET',headers:opt.headers||{},body:opt.body};calls.push(c);return handler(c)};return calls}
const isUser=c=>c.url.endsWith('/auth/v1/user');
test('sync: cloud ontbreekt -> POST met user_id uit sessie, geen PATCH, nooit coach_data',async()=>{
  const a=createApp(),calls=mockFetch(a,c=>res([{id:'x'}],201));
  const ok=await a.t.writeCloudCopy(S,SESSION,a.t.normalizedStateCopy(a.t.state),null);
  assert.strictEqual(ok,true);assert.deepStrictEqual(calls.map(c=>c.method),['POST']);
  assert.ok(calls[0].url.endsWith('/rest/v1/coach_data_auth'));
  const row=JSON.parse(calls[0].body)[0];assert.strictEqual(row.user_id,UID);assert.strictEqual(row.id,a.t.SYNC_ROW_ID);
  assert.strictEqual(calls[0].headers.Authorization,['Bearer','tok'].join(' '));
});
test('sync: POST 409 (rij bestaat al) = conflict, cloudversie bewaard',async()=>{
  const a=createApp(),remote=a.t.normalizedStateCopy(a.t.state);remote.team.name='Andere';
  const payload=await a.t.encryptData(remote,S.pass);
  mockFetch(a,c=>c.method==='POST'?res('dup',409):res([{payload,updated_at:'2026-01-01T00:00:00.000Z'}]));
  assert.strictEqual(await a.t.writeCloudCopy(S,SESSION,a.t.normalizedStateCopy(a.t.state),null),false);
  assert.strictEqual(JSON.parse(a.ls.data[a.t.CLOUD_CONFLICT_KEY]).data.team.name,'Andere');
});
test('sync: GET filtert op user_id en id (samengestelde sleutel)',async()=>{
  const a=createApp(),calls=mockFetch(a,()=>res([]));
  assert.strictEqual(await a.t.fetchCloudCopy(S,SESSION),null);
  assert.ok(calls[0].url.includes('coach_data_auth?user_id=eq.'+UID+'&id=eq.'+a.t.SYNC_ROW_ID));
  assert.ok(!/coach_data\?/.test(calls[0].url));
});
test('sync: PATCH zonder treffer (cloud intussen gewijzigd) = conflict, cloudversie bewaard',async()=>{
  const a=createApp(),remote=a.t.normalizedStateCopy(a.t.state);remote.team.name='Andere';
  const payload=await a.t.encryptData(remote,S.pass);let patch;
  mockFetch(a,c=>{if(c.method==='PATCH'){patch=c;return res([])}return res([{payload,updated_at:'2026-01-01T00:00:00.000Z'}])});
  const cloud=await a.t.fetchCloudCopy(S,SESSION);
  const ok=await a.t.writeCloudCopy(S,SESSION,a.t.normalizedStateCopy(a.t.state),cloud);
  assert.strictEqual(ok,false);
  assert.ok(patch.url.includes('user_id=eq.'+UID)&&patch.url.includes('updated_at=eq.'));
  assert.strictEqual(JSON.parse(a.ls.data[a.t.CLOUD_CONFLICT_KEY]).data.team.name,'Andere');
});
test('sync: verschillende cloudversie wordt bewaard en niet overschreven zonder bevestiging',async()=>{
  const a=createApp({confirmAnswer:false}),remote=a.t.normalizedStateCopy(a.t.state);remote.team.name='Cloudnaam';
  const payload=await a.t.encryptData(remote,S.pass);
  const calls=mockFetch(a,c=>isUser(c)?res({id:UID}):res([{payload,updated_at:'2026-01-01T00:00:00.000Z'}]));
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:S.pass});login(a);
  await a.t.pushSync(false);
  assert.ok(!calls.some(c=>c.method==='PATCH'||c.method==='POST'&&!c.url.includes('/auth/')));
  assert.ok(a.ls.data[a.t.CLOUD_CONFLICT_KEY]);
});
test('sessie: niet ingelogd -> geen netwerkverkeer en duidelijke melding',async()=>{
  const a=createApp(),calls=mockFetch(a,()=>res([]));
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:S.pass});
  await a.t.pushSync(false);
  assert.strictEqual(calls.length,0);
  assert.ok(a.toasts.some(t=>/ingelogd/.test(t)));
  await assert.rejects(()=>a.t.ensureSession(),/Niet ingelogd/);
});
test('sessie: inloggen bewaart sessie; user_id komt uit Auth-antwoord',async()=>{
  const a=createApp(),calls=mockFetch(a,()=>res({access_token:'t',refresh_token:'r',expires_in:3600,user:{id:UID,email:'a@b.nl'}}));
  const s=await a.t.authSignIn('a@b.nl','wachtwoord');
  assert.strictEqual(s.user.id,UID);assert.ok(calls[0].url.includes('/auth/v1/token?grant_type=password'));
  assert.strictEqual(JSON.parse(a.ls.data[a.t.AUTH_KEY]).access_token,'t');
});
test('sessie: foute inlog geeft melding en bewaart niets',async()=>{
  const a=createApp();mockFetch(a,()=>res({error_description:'Invalid login credentials'},400));
  await assert.rejects(()=>a.t.authSignIn('a@b.nl','x'),/Invalid login credentials/);
  assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);
});
test('sessie: registratie zonder directe sessie (e-mailbevestiging) geeft null',async()=>{
  const a=createApp();mockFetch(a,()=>res({id:UID,email:'a@b.nl'}));
  assert.strictEqual(await a.t.authSignUp('a@b.nl','wachtwoord'),null);assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);
});
test('sessie: verlopen token wordt ververst',async()=>{
  const a=createApp();login(a,{...SESSION,expires_at:Date.now()-1000});
  const calls=mockFetch(a,c=>c.url.includes('refresh_token')?res({access_token:'nieuw',refresh_token:'r2',expires_in:3600,user:{id:UID}}):res({id:UID}));
  const s=await a.t.ensureSession();
  assert.strictEqual(s.access_token,'nieuw');assert.ok(calls[0].url.includes('grant_type=refresh_token'));
});
test('sessie: verversen mislukt -> sessie gewist, melding "verlopen"; lokale data blijft',async()=>{
  const a=createApp();login(a,{...SESSION,expires_at:Date.now()-1000});
  mockFetch(a,()=>res({error_description:'bad'},400));
  const before=JSON.stringify(a.t.state);
  await assert.rejects(()=>a.t.ensureSession(),/verlopen/);
  assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);assert.strictEqual(JSON.stringify(a.t.state),before);
});
test('sessie: netwerkfout bij verversen behoudt sessie',async()=>{
  const a=createApp();login(a,{...SESSION,expires_at:Date.now()-1000});
  a.sandbox.fetch=async()=>{throw new TypeError('offline')};
  await assert.rejects(()=>a.t.ensureSession(),/Geen verbinding/);
  assert.ok(a.ls.data[a.t.AUTH_KEY]);
});
test('sessie: user-verificatie met andere id wist sessie',async()=>{
  const a=createApp();login(a);mockFetch(a,()=>res({id:'99999999-2222-3333-4444-555555555555'}));
  await assert.rejects(()=>a.t.ensureSession(),/komt niet overeen/);assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);
});
test('sessie: uitloggen wist sessie ook bij netwerkfout en laat lokale data intact',async()=>{
  const a=createApp();login(a);a.sandbox.fetch=async()=>{throw new TypeError('offline')};
  const before=JSON.stringify(a.t.state);await a.t.authSignOut();
  assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);assert.strictEqual(JSON.stringify(a.t.state),before);
});
test('sessie: ongeldige opgeslagen sessie (geen UUID) wordt genegeerd',()=>{
  const a=createApp();login(a,{...SESSION,user:{id:'zelf-gekozen'}});assert.strictEqual(a.t.getAuthSession(),null);
});
test('fouten: 401 wist sessie; 403 en netwerkfout geven begrijpelijke melding',async()=>{
  let a=createApp();login(a);mockFetch(a,()=>res('jwt expired',401));
  await assert.rejects(()=>a.t.fetchCloudCopy(S,SESSION),/sessie is verlopen/);assert.strictEqual(a.ls.data[a.t.AUTH_KEY],undefined);
  a=createApp();mockFetch(a,()=>res('x',403));await assert.rejects(()=>a.t.fetchCloudCopy(S,SESSION),/Geen toegang/);
  a=createApp();a.sandbox.fetch=async()=>{throw new TypeError('x')};await assert.rejects(()=>a.t.fetchCloudCopy(S,SESSION),/Geen verbinding/);
});
test('fouten: verkeerde versleutelingssleutel geeft melding en niets wordt overschreven',async()=>{
  const a=createApp(),payload=await a.t.encryptData(a.t.normalizedStateCopy(a.t.state),'andere');
  const calls=mockFetch(a,()=>res([{payload,updated_at:'2026-01-01T00:00:00.000Z'}]));
  await assert.rejects(()=>a.t.fetchCloudCopy(S,SESSION),/ontsleuteld/);
  assert.ok(calls.every(c=>c.method==='GET'));
});
test('encryptie round-trip en verkeerde sleutel faalt',async()=>{
  const a=createApp(),p=await a.t.encryptData({a:1},'x');
  assert.deepStrictEqual(await a.t.decryptData(p,'x'),{a:1});
  await assert.rejects(()=>a.t.decryptData(p,'y'));
});

test('kennisbank: niet-doorzoekbare PDF wordt niet als doorzoekbaar behandeld en geeft geen treffers',()=>{
  const a=createApp(),idx=a.t.vc2Index();
  idx['scan.pdf']={fileName:'scan.pdf',indexedAt:'2026-01-01',pages:['',''],searchable:false};
  idx['tekst.pdf']={fileName:'tekst.pdf',indexedAt:'2026-01-01',pages:['Hoog drukzetten begint bij een pressing trigger na een slechte steunpass.']};
  assert.strictEqual(a.t.vc2IsSearchable(idx['scan.pdf']),false);
  assert.strictEqual(a.t.vc2IsSearchable(idx['tekst.pdf']),true);
  const hits=a.t.vc2Passages('drukzetten trigger');
  assert.ok(hits.length&&hits.every(h=>h.name==='tekst.pdf'&&h.page===1));
});
test('spelprincipe met nieuwe velden blijft valide en wordt bewaard',()=>{
  const a=createApp();a.t.state.gameModel.principles.push({id:'p1',name:'Hoog drukzetten',recognizableSituations:'x',commonMistakes:['te ver uit elkaar']});
  a.t.save({render:false,sync:false});
  const p=JSON.parse(a.ls.data['footballCoachDataV2']).gameModel.principles.find(x=>x.id==='p1');
  assert.deepStrictEqual(p.commonMistakes,['te ver uit elkaar']);
});
const UID2='22222222-2222-4222-8222-222222222222';
function syncSetup(a,{cloudRows=[],user=UID}={}){
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:S.pass});login(a);
  const sess=JSON.parse(a.ls.data[a.t.AUTH_KEY]);sess.user={id:user,email:'x@y.nl'};login(a,sess);
  return mockFetch(a,c=>isUser(c)?res({id:user}):c.method==='POST'?res([{id:'x'}],201):res(cloudRows));
}
const posts=calls=>calls.filter(c=>c.method==='POST'&&c.url.includes('/rest/v1/'));
test('accountwissel: stille autosave uploadt niet naar nieuw account zonder cloudrij',async()=>{
  const a=createApp();a.sandbox.confirm=()=>{throw new Error('geen prompt bij stille sync')};
  a.ls.data[a.t.SYNC_ACCOUNT_KEY]=JSON.stringify({userId:UID});
  const calls=syncSetup(a,{user:UID2});const before=JSON.stringify(a.t.state);
  await a.t.pushSync(true);
  assert.strictEqual(posts(calls).length,0);assert.strictEqual(JSON.stringify(a.t.state),before);
});
test('accountwissel: annuleren uploadt niets en toont account in de vraag',async()=>{
  const a=createApp();let msg='';a.sandbox.confirm=m=>{msg=m;return false};
  const calls=syncSetup(a,{user:UID2});const before=JSON.stringify(a.t.state);
  await a.t.pushSync(false);
  assert.ok(msg.includes('x@y.nl')&&/geüpload/.test(msg));
  assert.strictEqual(posts(calls).length,0);assert.strictEqual(JSON.stringify(a.t.state),before);
  assert.ok(!a.ls.data[a.t.SYNC_ACCOUNT_KEY]);
});
test('accountwissel: bevestigen uploadt en onthoudt keuze (geen herhaalde vraag)',async()=>{
  const a=createApp();let asked=0;a.sandbox.confirm=()=>{asked++;return true};
  const calls=syncSetup(a,{user:UID2});
  await a.t.pushSync(false);
  assert.strictEqual(posts(calls).length,1);assert.strictEqual(JSON.parse(posts(calls)[0].body)[0].user_id,UID2);
  assert.strictEqual(JSON.parse(a.ls.data[a.t.SYNC_ACCOUNT_KEY]).userId,UID2);
  await a.t.pushSync(true);assert.strictEqual(asked,1);
});
test('accountwissel: freshInstall/initialSync uploadt niet automatisch',async()=>{
  const a=createApp(),calls=syncSetup(a,{user:UID2});
  await a.t.initialSync();assert.strictEqual(posts(calls).length,0);
});
test('secret key: afwijkende herhaling wordt geweigerd, niets opgeslagen of geüpload',async()=>{
  const a=createApp(),calls=mockFetch(a,()=>res([]));
  const r=await a.t.checkNewSyncPass('nieuw1','nieuw2');
  assert.strictEqual(r.ok,false);assert.ok(/komen niet overeen/.test(r.message));
  assert.strictEqual(calls.length,0);assert.ok(!a.ls.data['footballCoachSyncV1']);
});
test('secret key: nieuwe sleutel zonder herhaling geweigerd; gelijke herhaling en bestaande sleutel ok',async()=>{
  const a=createApp();mockFetch(a,()=>res([]));
  assert.strictEqual((await a.t.checkNewSyncPass('nieuw1','')).ok,false);
  assert.strictEqual((await a.t.checkNewSyncPass('nieuw1','nieuw1')).ok,true);
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:'nieuw1'});
  assert.strictEqual((await a.t.checkNewSyncPass('nieuw1','')).ok,true);
});
test('secret key: bestaande cloudrij die ontsleutelt vereist geen herhaling; verkeerde sleutel wel',async()=>{
  const a=createApp(),remote=a.t.normalizedStateCopy(a.t.state);
  const payload=await a.t.encryptData(remote,'juist');
  login(a);mockFetch(a,c=>isUser(c)?res({id:UID}):res([{payload,updated_at:'2026-01-01T00:00:00.000Z'}]));
  assert.strictEqual((await a.t.checkNewSyncPass('juist','')).ok,true);
  assert.strictEqual((await a.t.checkNewSyncPass('fout','')).ok,false);
});

// ---- Fase 2 ----
const stdPrinciples=a=>a.t.state.gameModel.principles.filter(p=>p.standardKey);
test('standaardprincipes: 5 stuks, idempotent, geen koppelingen, bij herladen geen duplicaten',()=>{
  const a=createApp();assert.strictEqual(stdPrinciples(a).length,5);
  a.t.seedStandardPrinciples();a.t.seedStandardPrinciples();
  assert.strictEqual(stdPrinciples(a).length,5);
  assert.ok(stdPrinciples(a).every(p=>p.isStandardProposal&&!p.exerciseIds.length&&!p.trainingIds.length&&/standaardvoorstel/i.test(p.observation)));
  const b=createApp({store:{[V2]:a.ls.data[V2]}});assert.strictEqual(stdPrinciples(b).length,5);
});
test('standaardprincipes: bestaande principes blijven, bewerken/verwijderen blijft bewaard (geen herseed)',()=>{
  const d=starter();delete d.gameModel.standardPrinciplesVersion;d.gameModel.principles=[{id:'mijn',name:'Restverdediging',description:'eigen tekst'}];
  const a=createApp({store:{[V2]:JSON.stringify(d)}}),ps=a.t.state.gameModel.principles;
  assert.strictEqual(ps.filter(p=>p.name==='Restverdediging').length,1);
  assert.strictEqual(ps.find(p=>p.id==='mijn').description,'eigen tekst');
  assert.strictEqual(ps.length,5);
  const s=stdPrinciples(a)[0];s.name='Aangepast';a.t.state.gameModel.principles=ps.filter(p=>p.id!==stdPrinciples(a)[1].id);
  a.t.save({render:false,sync:false});
  const b=createApp({store:{[V2]:a.ls.data[V2]}});
  assert.strictEqual(b.t.state.gameModel.principles.length,4);assert.ok(b.t.state.gameModel.principles.some(p=>p.name==='Aangepast'));
});
const fixtureIndex=()=>({
  'a.pdf':{fileName:'Origineel A.pdf',fileType:'pdf',indexedAt:'2026-01-01',searchable:true,pages:['Intro tekst','Hoog druk zetten met looplijn en afschermen van de passlijn']},
  'b.fckb':{fileName:'B.fckb',fileType:'fckb',indexedAt:'2026-01-01',searchable:true,pages:['Hoog druk zetten bij terugspeelbal']},
  'scan.pdf':{fileName:'Scan.pdf',fileType:'pdf',indexedAt:'2026-01-01',searchable:false,pages:['','']}
});
test('zoeken met filters en bronverwijzing: paginanummer alleen bij PDF, niet-doorzoekbaar nooit in resultaten',()=>{
  const a=createApp();Object.assign(a.t.vc2Index(),fixtureIndex());
  const all=a.t.vc2Passages('druk looplijn',10);
  assert.ok(all.some(h=>h.name==='Origineel A.pdf'&&h.page===2&&h.type==='pdf'));
  assert.ok(all.some(h=>h.name==='B.fckb'&&h.page===null));
  assert.ok(!all.some(h=>h.name==='Scan.pdf'));
  assert.ok(a.t.vc2Passages('druk',10,{type:'fckb'}).every(h=>h.type==='fckb'));
  assert.ok(a.t.vc2Passages('druk',10,{type:'pdf'}).every(h=>h.type==='pdf'));
  assert.strictEqual(a.t.vc2Passages('druk',10,{searchable:'no'}).length,0);
});
test('niet-doorzoekbare documenten: filter en label',()=>{
  const a=createApp(),idx=fixtureIndex();
  assert.strictEqual(a.t.vc2IsSearchable(idx['scan.pdf']),false);
  assert.strictEqual(a.t.vc2FileMatches('scan.pdf',idx['scan.pdf'],{searchable:'yes'}),false);
  assert.strictEqual(a.t.vc2FileMatches('scan.pdf',idx['scan.pdf'],{searchable:'no'}),true);
  assert.strictEqual(a.t.vc2FileMatches('b.fckb',idx['b.fckb'],{type:'pdf'}),false);
});
const src={type:'vc2',file:'a.pdf',fileName:'Origineel A.pdf',page:2,excerpt:'Hoog druk zetten'};
test('oefening aan training toevoegen met bronverwijzing; dubbele toevoeging voorkomen',()=>{
  const a=createApp(),t=a.t.state.trainings[0],n=a.t.state.exercises.length,before=t.planItems.length;
  const r=a.t.addExerciseToTraining(t.id,{name:'Druk zetten',duration:12,description:'tekst',source:src});
  assert.ok(r.ok);assert.strictEqual(a.t.state.exercises.length,n+1);assert.strictEqual(t.planItems.length,before+1);
  assert.deepStrictEqual(r.exercise.source,src);assert.ok(t.exerciseIds.includes(r.exercise.id));
  const r2=a.t.addExerciseToTraining(t.id,{name:'Druk zetten',source:src});
  assert.ok(!r2.ok&&r2.duplicate);assert.strictEqual(a.t.state.exercises.length,n+1);assert.strictEqual(t.planItems.length,before+1);
  assert.ok(!a.t.addExerciseToTraining(t.id,{name:'  '}).ok);
  assert.ok(JSON.parse(a.ls.data[V2]).exercises.some(e=>e.source&&e.source.file==='a.pdf'));
});
test('mislukte opslag bij toevoegen: duidelijke fout en state teruggedraaid',()=>{
  const a=createApp(),t=a.t.state.trainings[0],n=a.t.state.exercises.length,before=t.planItems.length;
  a.ls.failWrites=true;
  const r=a.t.addExerciseToTraining(t.id,{name:'X',source:src});
  assert.ok(!r.ok&&/mislukt/.test(r.error));
  assert.strictEqual(a.t.state.exercises.length,n);assert.strictEqual(t.planItems.length,before);
  assert.ok(a.toasts.some(m=>/Opslaan mislukt/.test(m)));
});

test('Meer → Trainingen: trainingspagina rendert zonder fout (trainingTemplateMeta bestaat)',()=>{
  const vm=require('vm'),a=createApp();
  assert.strictEqual(typeof vm.runInContext('trainingTemplateMeta',a.sandbox),'function');
  const html=vm.runInContext("ui.page='trainings';renderTrainings()",a.sandbox);
  assert.ok(html.includes('Trainingen')||html.length>0);
  assert.ok(vm.runInContext('renderMore()',a.sandbox).includes('data-go="trainings"'));
  assert.ok(vm.runInContext("trainingTemplateMeta({templateKey:'onbekend',templateName:'X'}).name",a.sandbox)==='X');
});

test('trainingssjablonen: presetDraft/customTemplateDraft/trainingTemplateInfo/trainingForm werken',()=>{
  const vm=require('vm'),a=createApp(),r=c=>vm.runInContext(c,a.sandbox);
  assert.ok(r("trainingForm(presetDraft('vc2'))").length>0);
  assert.ok(r("trainingTemplateInfo({templateKey:'free'})").includes('Vrije training'));
  assert.strictEqual(r("customTemplateDraft('bestaat-niet').templateKey"),'free');
  assert.strictEqual(r("typeof openTrainingTemplateChooser+typeof saveTrainingAsTemplate+typeof deleteTrainingTemplate"),'functionfunctionfunction');
});

test('template opslaan: training blijft ongewijzigd, eigen template onderscheiden van standaard, annuleren/leeg doet niets',()=>{
  const vm=require('vm'),a=createApp(),r=c=>vm.runInContext(c,a.sandbox);
  const t=a.t.state.trainings[0],snap=JSON.stringify(a.t.state.trainings),n=a.t.state.trainings.length;
  r("prompt=()=>null");r(`saveTrainingAsTemplate('${t.id}')`);
  r("prompt=()=>'   '");r(`saveTrainingAsTemplate('${t.id}')`);
  assert.strictEqual(r('state.templates.trainings.length'),0);
  r("prompt=()=>' Mijn sjabloon '");r(`saveTrainingAsTemplate('${t.id}')`);
  assert.strictEqual(r('state.templates.trainings.length'),1);
  const tpl=r('state.templates.trainings[0]');
  assert.strictEqual(tpl.name,'Mijn sjabloon');assert.strictEqual(tpl.templateKey,'custom');
  assert.notStrictEqual(tpl.id,t.id);assert.ok(!('date' in tpl)&&!('attendance' in tpl));
  assert.strictEqual(JSON.stringify(a.t.state.trainings),snap);
  const d=r(`customTemplateDraft('${tpl.id}')`);
  assert.strictEqual(d.templateKey,'custom');assert.strictEqual(d.templateName,'Mijn sjabloon');
  assert.strictEqual(r("presetDraft('onbekend').templateKey"),'free');
  assert.strictEqual(r("trainingTemplateMeta({templateKey:'toString'}).name"),'Vrije training');
  r(`deleteTrainingTemplate('${tpl.id}')`);
  assert.strictEqual(r('state.templates.trainings.length'),0);
  assert.strictEqual(a.t.state.trainings.length,n);assert.strictEqual(JSON.stringify(a.t.state.trainings),snap);
});
test('template opslaan/verwijderen: opslagfout draait state terug',()=>{
  const vm=require('vm'),a=createApp(),r=c=>vm.runInContext(c,a.sandbox);
  const t=a.t.state.trainings[0];r("prompt=()=>'X'");
  a.ls.failWrites=true;r(`saveTrainingAsTemplate('${t.id}')`);
  assert.strictEqual(r('state.templates.trainings.length'),0);
  a.ls.failWrites=false;r(`saveTrainingAsTemplate('${t.id}')`);
  const id=r('state.templates.trainings[0].id');
  a.ls.failWrites=true;r(`deleteTrainingTemplate('${id}')`);
  assert.strictEqual(r('state.templates.trainings.length'),1);
});

test('activiteitengroep: standaardselectie komt overeen met spelers die bij het team horen',()=>{
  const vm=require('vm'),a=createApp(),r=code=>vm.runInContext(code,a.sandbox);
  const t=a.t.state.trainings[0],player=a.t.state.players[0],primary=player.primaryTeamId,teamIds=[...player.teamIds];
  const other='team-other';
  a.t.state.teams.push({id:other,name:'Ander team'});
  player.primaryTeamId=other;
  player.teamIds=[other,t.teamId];
  const form=r(`squadForm(trainingById('${t.id}'))`);
  assert.ok(r(`eventSquad(trainingById('${t.id}')).some(p=>p.id==='${player.id}')`));
  assert.match(form,new RegExp(`name="squadPlayer" value="${player.id}" checked`));
  assert.ok(form.includes('Spelers die bij dit team horen'));
  player.primaryTeamId=primary;player.teamIds=teamIds;
});

test('legacy spelersnaam wordt opgesplitst en alle bestaande spelergegevens blijven behouden',()=>{
  const d=starter(),p=d.players[0],id=p.id,number=p.number,teamIds=[...p.teamIds];
  p.name='Jan de Vries';delete p.firstName;delete p.lastName;delete p.startDate;
  const a=createApp({store:{[V2]:JSON.stringify(d)}}),migrated=a.t.state.players.find(x=>x.id===id);
  assert.strictEqual(migrated.firstName,'Jan');assert.strictEqual(migrated.lastName,'de Vries');
  assert.strictEqual(a.t.playerFullName(migrated),'Jan de Vries');assert.strictEqual(migrated.name,'Jan de Vries');
  assert.strictEqual(migrated.number,number);assert.deepStrictEqual(Array.from(migrated.teamIds),teamIds);
  assert.strictEqual(migrated.startDate,'');
});
test('spelersformulier heeft aparte naamvelden en sorteert op achternaam',()=>{
  const a=createApp(),p={id:'p',firstName:'Zoe',lastName:'Bakker',name:'Zoe Bakker'};
  const form=a.t.playerForm(p);
  assert.match(form,/id="fFirstName"/);assert.match(form,/id="fLastName"/);assert.match(form,/id="fStartDate"/);
  assert.match(a.t.playerForm({}),/<input id="fName" type="hidden" value="">/);
  a.t.state.players=[{id:'b',firstName:'Zoe',lastName:'Bakker',name:'Zoe Bakker',active:true,primaryTeamId:'t',teamIds:['t']},{id:'a',firstName:'Adam',lastName:'Jansen',name:'Adam Jansen',active:true,primaryTeamId:'t',teamIds:['t']}];
  assert.deepStrictEqual(Array.from(a.t.playersForTeam('t').map(x=>x.id)),['b','a']);
});
test('trainingspercentage sluit sessies voor startdatum uit en telt relevante sessies mee',()=>{
  const a=createApp(),teamId=a.t.state.teams[0].id;
  a.t.state.players=[{id:'joiner',name:'Sam de Jong',firstName:'Sam',lastName:'de Jong',primaryTeamId:teamId,teamIds:[teamId],active:true,startDate:'2026-02-01'}];
  a.t.state.trainings=[
    {id:'old',teamId,date:'2026-01-20',attendance:{joiner:'Afwezig'}},
    {id:'present',teamId,date:'2026-02-03',attendance:{joiner:'Aanwezig'}},
    {id:'absent',teamId,date:'2026-02-10',attendance:{},guestPlayers:[{id:'g1',name:'Gast',teamName:'O23-2'}]}
  ];
  a.t.normalize();
  assert.strictEqual(a.t.attendancePct('joiner',teamId),50);
  const stats=a.t.attendanceStatsForTrainings('joiner',a.t.state.trainings);
  assert.strictEqual(stats.pct,50);assert.strictEqual(stats.filled,1);assert.strictEqual(stats.relevant,2);
  a.t.state.players[0].startDate='2026-02-04';
  assert.strictEqual(a.t.attendancePct('joiner',teamId),0);
  const counts=a.t.eventAttendanceCounts(a.t.state.trainings[2]);
  assert.strictEqual(counts.total,a.t.eventPlayerIds(a.t.state.trainings[2]).length+1);
});
test('wedstrijdstatus is per wedstrijd, tijdelijke nummers overschrijven het profielnummer niet',()=>{
  const a=createApp(),p={id:'p',name:'Sam de Jong',firstName:'Sam',lastName:'de Jong',number:'9',primaryTeamId:'t',teamIds:['t'],active:true};
  a.t.state.players=[p];
  const m={id:'m',teamId:'t',availability:{p:{status:'Geblesseerd',reason:'Knie'}},playerNumbers:{p:'17'},lineup:{},benchIds:[],formation:'4-3-3'};
  a.t.state.matches=[m];a.t.normalize();
  assert.strictEqual(a.t.matchPlayerAvailable(m,'p'),false);
  assert.strictEqual(a.t.matchPlayerNumber(m,p),'17');assert.strictEqual(p.number,'9');
  assert.strictEqual(a.t.matchPlayerAvailable(a.t.state.matches[0],'p'),false);
  assert.strictEqual(a.t.matchPlayerAvailable({availability:{}},'p'),true);
});
test('dubbele rugnummers in basis en bank worden herkend',()=>{
  const a=createApp(),p1={id:'p1',name:'A',firstName:'A',lastName:'',number:'7'},p2={id:'p2',name:'B',firstName:'B',lastName:'',number:'8'};
  a.t.state.players=[p1,p2];
  const m={id:'m',lineup:{GK:'p1'},benchIds:['p2'],playerNumbers:{p2:'07'},availability:{}};
  assert.strictEqual(a.t.duplicateMatchNumbers(m).length,1);
  assert.ok(a.t.selectionWarnings(m).some(x=>x.includes('Dubbel rugnummer')));
});
test('trainingsweergave scheidt vaste spelers en meetrainers',()=>{
  const a=createApp(),teamId=a.t.state.teams[0].id;
  a.t.state.trainings=[{id:'tr',teamId,date:'2026-02-01',attendance:{'guest:g1':'Aanwezig'},guestPlayers:[{id:'g1',name:'Gastspeler',teamName:'O23-2'}]}];
  a.t.normalize();
  const html=a.t.renderAttendance();
  assert.ok(html.includes('Vaste '));assert.ok(html.includes('Meetrainers (1)'));
  assert.ok(html.includes('Gastspeler'));assert.ok(html.includes('guest:g1'));
});
test('wedstrijdscherm toont status en wedstrijdnummer zonder standaardnummer te wijzigen',()=>{
  const a=createApp(),m=a.t.state.matches[0],p=a.t.state.players[0];
  a.t.state.matches=[m];
  m.availability[p.id]={status:'Beschikbaar',reason:''};
  m.playerNumbers[p.id]='23';m.lineup.GK=p.id;
  const lineup=a.t.renderLineupBoard(m),sheetPlayers=a.t.matchSheetSelectedPlayers(m);
  assert.ok(lineup.includes('#23'));assert.ok(sheetPlayers.some(x=>x.id===p.id&&x.name.includes('#23')));
  m.availability[p.id]={status:'Geblesseerd',reason:'Knieblessure'};
  const html=a.t.renderMatches();
  assert.ok(html.includes('Beschikbaarheid & rugnummers'));assert.ok(html.includes('Knieblessure'));
  assert.ok(!a.t.renderLineupBoard(m).includes('#23'));assert.ok(!a.t.matchSheetSelectedPlayers(m).some(x=>x.id===p.id));
  assert.notStrictEqual(p.number,'23');
});

/* ===== 2.9.0: wedstrijdblad, instroomdatum, meetrainers en trainingsgroepen ===== */
const sheetFixture=()=>{
  const a=createApp(),team=a.t.state.teams[0].id;
  const mk=(id,first,last,number,primary=team)=>({id,firstName:first,lastName:last,name:`${first} ${last}`,number,primaryTeamId:primary,teamIds:[primary],active:true});
  a.t.state.players=[mk('gk','Piet','Keeper','1'),mk('v1','Jan','van der Berg','4'),mk('v2','Kees','Ouwehand','5'),mk('guest','Lars','Visser','17','other-team'),mk('inj','Tom','Gewond','8'),mk('abs','Ben','Weg','9'),mk('p1','Eric','Eerste','10'),mk('p2','Sven','Tweede','11')];
  const m={id:'m',teamId:team,date:'2026-11-07',opponent:'FC Test',competition:'Competitie',homeAway:'Thuis',startTime:'14:30',gatherTime:'13:30',venue:'Sportpark Delft',lineup:{GK:'gk',LB:'v1'},benchIds:['v2','guest'],formation:'4-3-3',
    squadPlayerIds:['gk','v1','v2','guest','inj','abs','p1','p2'],promotedFirstIds:['p1'],promotedO232Ids:['p2'],availability:{inj:{status:'Geblesseerd',reason:'Enkel'},abs:{status:'Afwezig – andere reden',reason:'Werk'},p1:{status:'Geblesseerd',reason:'dubbel?'}},playerNumbers:{},sheetRemarks:{},checklist:{}};
  a.t.state.matches=[m];return {a,m,team};
};
test('wedstrijdblad: rugnummer en naam gescheiden, selectievolgorde en spelers van ander team',()=>{
  const {a,m}=sheetFixture(),md=a.t.matchSheetModel(m);
  assert.deepStrictEqual(Array.from(md.rows.map(r=>r.name)),['Piet Keeper','Jan van der Berg','Kees Ouwehand','Lars Visser']);
  assert.deepStrictEqual(Array.from(md.rows.map(r=>r.number)),['1','4','5','17']);
  assert.ok(md.rows[3].fromTeam);assert.strictEqual(md.rows[0].fromTeam,'');
  const html=a.t.buildMatchSheetHtml(m);
  assert.ok(html.includes('<span class="number">#17</span>'));assert.ok(html.includes('DSV Full Speed'));assert.ok(html.includes('FC Test'));
});
test('wedstrijdblad: categorieën behouden bestaande spelers en blijven leeg invulbaar',()=>{
  const {a,m}=sheetFixture(),md=a.t.matchSheetModel(m),all=[...md.rows.map(r=>r.id),...md.promotedFirst,...md.promotedOther,...md.injured,...md.absent].map(x=>x.id||x);
  assert.strictEqual(new Set(all).size,all.length);
  assert.deepStrictEqual(Array.from(md.promotedFirst.map(x=>x.id)),['p1']);assert.deepStrictEqual(Array.from(md.promotedOther.map(x=>x.id)),['p2']);
  assert.deepStrictEqual(Array.from(md.injured.map(x=>x.id)),['inj']);assert.strictEqual(md.injured[0].note,'Enkel');
  assert.deepStrictEqual(Array.from(md.absent.map(x=>x.id)),['abs']);assert.strictEqual(md.absent[0].note,'Werk');
  const html=a.t.buildMatchSheetHtml(m);
  assert.ok(html.includes('Doorgeschoven naar 1e'));assert.ok(html.includes('Doorgeschoven naar O23-2'));
  assert.ok(html.includes('Blessures')&&html.includes('Afwezig')&&html.includes('Opmerkingen wedstrijddag'));
  assert.ok(html.includes('Tenue')&&html.includes('Kleedkamer')&&html.includes('Bijzonderheden'));
  m.kit='Groen';m.lockerRoom='3';m.sheetNote='Pressen';
  const full=a.t.buildMatchSheetHtml(m);assert.ok(full.includes('Tenue')&&full.includes('Kleedkamer')&&full.includes('Pressen'));
  m.promotedFirstIds=[];m.promotedO232Ids=[];m.availability={};
  const empty=a.t.buildMatchSheetHtml(m);assert.ok(empty.includes('Doorgeschoven naar 1e')&&empty.includes('Doorgeschoven naar O23-2'));
  assert.ok(empty.includes('Blessures')&&empty.includes('Afwezig')&&empty.includes('Opmerkingen wedstrijddag'));
});
test('wedstrijdblad: gewenste A4-opmaak toont wedstrijdvelden en geen fictieve selectie',()=>{
  const {a,m}=sheetFixture();m.lineup={};m.benchIds=[];m.squadPlayerIds=[];
  const html=a.t.buildMatchSheetHtml(m);
  ['MEER DAN VOETBAL','WEDSTRIJDDAG DOCUMENT','Datum','Locatie','Trainers','Thuis / uit','Tegenstander','Wedstrijdtype','Aanvang','Verzamelen','Naam','Opmerking','DSV FULL SPEED · DELFT'].forEach(text=>assert.ok(html.includes(text),text));
  assert.ok(html.includes('class="info-card"')&&html.includes('grid-template-columns:1fr 1fr'));
  assert.ok(html.includes('<th>Naam</th><th>Opmerking</th>'));
  assert.strictEqual((html.match(/class="blank-row"/g)||[]).length,18);
  assert.ok(!html.includes('<td class="name">Piet Keeper</td>'));
  assert.ok(html.includes('class="write-line"')&&html.includes('class="practical-grid"'));
});
test('wedstrijdblad: grote selectie en alle extra informatie blijven op één A4-pagina',()=>{
  const {a,m,team}=sheetFixture();
  const many=Array.from({length:30},(_,i)=>({id:'x'+i,firstName:'Speler',lastName:'N'+i,name:'Speler N'+i,number:String(20+i),primaryTeamId:team,teamIds:[team],active:true}));
  a.t.state.players.push(...many);m.lineup={};m.benchIds=many.map(p=>p.id);
  const pages=a.t.matchSheetPages(a.t.matchSheetModel(m));
  assert.strictEqual(pages.length,1);assert.strictEqual(pages[0].rows.length,30);assert.strictEqual(pages[0].extras,true);
  const html=a.t.buildMatchSheetHtml(m);
  assert.strictEqual((html.match(/<main class="sheet">/g)||[]).length,1);
  assert.ok(html.includes('class="sheet-content"'));assert.ok(html.includes('--sheet-fit'));
  assert.ok(html.includes('content.scrollHeight'));assert.ok(html.includes('copy.clientHeight'));
  m.opponent='Nieuwe Tegenstander';assert.ok(a.t.buildMatchSheetHtml(m).includes('Nieuwe Tegenstander'));
  m.benchIds=[];m.lineup={GK:'gk'};assert.strictEqual(a.t.matchSheetPages(a.t.matchSheetModel(m)).length,1);
});
test('WhatsApp-afbeelding tekent nummers, namen, verzameltijd en afwezigen in 4:5',()=>{
  const {a,m}=sheetFixture(),texts=[],ctx=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*10})):k==='fillText'?((s)=>texts.push(String(s))):(typeof t[k]==='undefined'?(()=>{}):t[k]),set:(t,k,v)=>{t[k]=v;return true}});
  const end=a.t.drawMatchImage(ctx,a.t.matchSheetModel(m),1080,1350,null);
  assert.ok(end<1350);
  ['Piet','KEEPER','Lars','VISSER','FC TEST','13:30','AFWEZIG','GEBLESSEERD','Ben Weg – Werk'].forEach(x=>assert.ok(texts.some(t=>t.includes(x)),x));
  assert.ok(texts.includes('17')&&texts.includes('1'));
});
test('PDF- en afbeeldingsexport lezen de actuele wedstrijd bij het klikken',()=>{
  const {a,m}=sheetFixture(),opened=[];a.sandbox.window.open=()=>({document:{open(){},write:h=>opened.push(h),close(){}},focus(){}});
  m.opponent='Alfa United';a.t.runSheetExport('pdf','m');m.opponent='Omega City';a.t.runSheetExport('pdf','m');
  assert.ok(opened[0].includes('Alfa United')&&!opened[0].includes('Omega City'));assert.ok(opened[1].includes('Omega City'));
  assert.ok(opened[1].includes('FC_PDF_FIXED_PAGES=true'));
});
test('instroomdatum: halverwege het seizoen telt alleen vanaf aanmelding (10 trainingen, 8 aanwezig = 80%)',()=>{
  const a=createApp(),team=a.t.state.teams[0].id,att={};
  const trainings=[];
  for(let i=0;i<40;i++){const d=new Date(Date.UTC(2025,7,1+i*3)).toISOString().slice(0,10);trainings.push({id:'t'+i,teamId:team,date:d,attendance:{}})}
  const since=trainings.slice(30);
  a.t.state.players=[{id:'new',name:'Nieuw Lid',firstName:'Nieuw',lastName:'Lid',primaryTeamId:team,teamIds:[team],active:true,startDate:since[0].date},{id:'full',name:'Vol Seizoen',firstName:'Vol',lastName:'Seizoen',primaryTeamId:team,teamIds:[team],active:true,startDate:''}];
  trainings.forEach((t,i)=>{t.attendance.full=i%4===0?'Afwezig':'Aanwezig';if(i>=30)t.attendance.new=i<38?'Aanwezig':'Afwezig'});
  a.t.state.trainings=trainings;a.t.normalize();
  const stats=a.t.attendanceStatsForTrainings('new',trainings);
  assert.strictEqual(stats.relevant,10);assert.strictEqual(stats.present,8);assert.strictEqual(stats.pct,80);
  const full=a.t.attendanceStatsForTrainings('full',trainings);
  assert.strictEqual(full.relevant,40);assert.strictEqual(full.present,30);assert.strictEqual(full.pct,75);
  a.t.state.players[1].startDate='';assert.strictEqual(a.t.attendanceStatsForTrainings('full',trainings).pct,75);
});
test('instroomdatum: spelers die van team wisselen tellen alleen trainingen van hun huidige team',()=>{
  const a=createApp(),team=a.t.state.teams[0].id;
  a.t.state.players=[{id:'w',name:'Wis Selaar',firstName:'Wis',lastName:'Selaar',primaryTeamId:team,teamIds:[team],active:true,startDate:'2026-03-01'}];
  a.t.state.trainings=[{id:'o',teamId:'ander',date:'2026-02-01',attendance:{w:'Afwezig'}},{id:'b',teamId:team,date:'2026-02-15',attendance:{w:'Afwezig'}},{id:'n',teamId:team,date:'2026-03-02',attendance:{w:'Aanwezig'}}];
  assert.strictEqual(a.t.attendanceStatsForTrainings('w',a.t.state.trainings).pct,100);
});
const trainingFixture=()=>{
  const a=createApp(),team=a.t.state.teams[0].id;
  const mk=(id,first,last,primary)=>({id,firstName:first,lastName:last,name:`${first} ${last}`,primaryTeamId:primary,teamIds:[primary],active:true});
  a.t.state.players=[mk('own','Eigen','Speler',team),mk('o19','Jelle','Jong','o19'),mk('o232','Maas','Tweede','o232')];
  a.t.state.teams.push({id:'o19',name:'Full Speed O19',shortName:'O19'},{id:'o232',name:'Full Speed O23-2',shortName:'O23-2'});
  a.t.state.trainings=[{id:'t1',teamId:team,date:'2099-02-08',attendance:{},squadPlayerIds:[]},{id:'t2',teamId:team,date:'2026-02-01',attendance:{}}];
  a.t.state.trainings[0].squadPlayerIds=['own'];a.t.normalize();return {a,team};
};
const runModal=(a,fn)=>{let save;a.t.setModal((title,body,s)=>{save=s;a.body=body});fn();return save};
test('meetrainers: zoeken toont team, meerdere spelers tegelijk, geen duplicaten en eigen opkomst onveranderd',()=>{
  const {a}=trainingFixture();
  const save=runModal(a,()=>a.t.addTrainingGuest('t1'));
  assert.ok(a.body.includes('Jelle Jong')&&a.body.includes('Full Speed O19'));assert.ok(!a.body.includes('Eigen Speler'));
  a.domMap['input[name=guestPlayer]:checked']=[{value:'o19'},{value:'o232'},{value:'o19'}];
  assert.strictEqual(save(),true);
  const t=a.t.state.trainings[0];assert.strictEqual(t.guestPlayers.length,2);
  assert.ok(t.guestPlayers.every(g=>g.playerId&&g.teamName));
  assert.strictEqual(a.t.state.players.length,3);assert.strictEqual(a.t.state.players.find(p=>p.id==='o19').primaryTeamId,'o19');
  runModal(a,()=>a.t.addTrainingGuest('t1'));assert.ok(!a.body.includes('Jelle Jong'));
  t.attendance['guest:'+t.guestPlayers[0].id]='Aanwezig';
  assert.strictEqual(a.t.attendanceStatsForTrainings('o19',a.t.state.trainings).pct,null);
  assert.strictEqual(a.t.eventAttendanceCounts(t).total,3);
  const html=a.t.renderAttendance();assert.ok(html.includes('Meetrainers (2)'));
});
test('meetrainer kan aan meerdere trainingen worden toegevoegd en weer verwijderd zonder profiel of andere trainingen te raken',()=>{
  const {a}=trainingFixture();
  a.domMap['input[name=guestPlayer]:checked']=[{value:'o19'}];
  ['t1','t2'].forEach(id=>assert.strictEqual(runModal(a,()=>a.t.addTrainingGuest(id))(),true));
  const [t1,t2]=a.t.state.trainings,g1=t1.guestPlayers[0].id;
  t1.attendance['guest:'+g1]='Aanwezig';t2.attendance['guest:'+t2.guestPlayers[0].id]='Afwezig';
  a.t.setConfirm(()=>true);a.t.removeTrainingGuest(g1);
  assert.strictEqual(t1.guestPlayers.length,0);assert.strictEqual(t2.guestPlayers.length,1);
  assert.strictEqual(t2.attendance['guest:'+t2.guestPlayers[0].id],'Afwezig');
  assert.ok(a.t.state.players.some(p=>p.id==='o19'));
});
test('trainingsgroepen: indelen, verplaatsen en meetrainer in groep; groep verwijderen',()=>{
  const {a}=trainingFixture(),t=a.t.state.trainings[0];
  a.domMap['input[name=guestPlayer]:checked']=[{value:'o19'}];
  runModal(a,()=>a.t.addTrainingGuest('t1'))();
  const gkey='guest:'+t.guestPlayers[0].id;
  let save=runModal(a,()=>a.t.editTrainingGroups('t1'));
  a.domMap['[data-group-new]']=[{value:'Groep A'},{value:'Groep B'}];save();
  assert.strictEqual(t.groups.length,2);const [ga,gb]=t.groups;
  save=runModal(a,()=>a.t.editTrainingGroups('t1'));
  a.domMap['[data-group-member]']=[{value:ga.id,dataset:{groupMember:'own'}},{value:ga.id,dataset:{groupMember:gkey}}];
  a.domMap[`[data-group-name="${ga.id}"]`]={value:'Groep A'};a.domMap[`[data-group-name="${gb.id}"]`]={value:'Groep B'};a.domMap['[data-group-new]']=[{value:''}];
  save();assert.strictEqual(t.groupAssign.own,ga.id);assert.strictEqual(t.groupAssign[gkey],ga.id);
  save=runModal(a,()=>a.t.editTrainingGroups('t1'));
  a.domMap['[data-group-member]']=[{value:gb.id,dataset:{groupMember:'own'}},{value:ga.id,dataset:{groupMember:gkey}}];save();
  assert.strictEqual(t.groupAssign.own,gb.id);
  assert.ok(a.t.renderTrainingDay().includes('Groep B'));
  assert.ok(a.t.trainingMembers(t).find(x=>x.key===gkey).guest);
  a.domMap[`[data-group-name="${gb.id}"]`]={value:''};
  save=runModal(a,()=>a.t.editTrainingGroups('t1'));a.domMap['[data-group-member]']=[];a.domMap['[data-group-new]']=[];save();
  assert.strictEqual(t.groups.length,1);assert.ok(!t.groupAssign.own);
  a.t.removeTrainingGuest(t.guestPlayers[0].id);assert.ok(!t.groupAssign[gkey]);
});
