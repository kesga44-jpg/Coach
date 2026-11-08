// Regressietests 2.10: back-up en herstel inclusief Kennis & Ontwikkeling.
// Kern: teamgegevens worden zoals voorheen vervangen (met herstelpunt), kennis wordt alleen aangevuld.
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
const V2='footballCoachDataV2',KD='footballCoachKnowledgeV1',KDB='footballCoachKnowledgeBackupV1',REC='footballCoachRecoveryBackupV1';

const update=(title,items)=>({schema_version:'1.0',record_type:'football_knowledge_update',title,update_date:'2026-10-01',team_context:'Full Speed O23',summary:'Samenvatting',items});
const item=(t,doi)=>({title:t,source:`Tijdschrift https://doi.org/10.1000/${doi}`,key_findings:'Bevinding',practical_translation:'Doen'});
const file=obj=>{const txt=typeof obj==='string'?obj:JSON.stringify(obj);return {size:Buffer.byteLength(txt),text:async()=>txt}};
function appWithKennis(updates,opts={}){
  const a=createApp(opts);
  updates.forEach(u=>{const r=a.t.kd.kdImport(JSON.stringify(u));assert.ok(r.ok,JSON.stringify(r))});
  return a;
}
const kdItems=a=>JSON.parse(a.ls.data[KD]).items.map(i=>i.raw.title).sort();

test('back-up bevat teamgegevens, backupMeta en het kennisonderdeel; state zelf blijft schoon',()=>{
  const a=appWithKennis([update('U1',[item('Sprint','a1'),item('Rondo','a2')])]);
  const b=a.t.buildFullBackup();
  assert.strictEqual(b.backupMeta.format,a.t.BACKUP_FORMAT);
  assert.strictEqual(b.backupMeta.appVersion,a.t.APP_VERSION);
  assert.strictEqual(b.knowledgeModule.format,a.t.kd.KD_EXPORT_FORMAT);
  assert.strictEqual(b.knowledgeModule.updates[0].items.length,2);
  assert.strictEqual(b.players.length,a.t.state.players.length);
  assert.strictEqual(b.trainings.length,a.t.state.trainings.length);
  assert.ok(!('backupMeta' in a.t.state)&&!('knowledgeModule' in a.t.state));
  a.t.validateStateData(b); // blijft leesbaar voor de bestaande validatie (oudere app-versies)
});

test('herstel: teamgegevens vervangen met herstelpunt; kennis alleen aangevuld (unie, geen verwijdering, geen dubbelen)',async()=>{
  const src=appWithKennis([update('U1',[item('Sprint','a1'),item('Rondo','a2')])]);
  src.t.state.team.name='Uit back-up';const backup=src.t.buildFullBackup();
  const dst=appWithKennis([update('Eigen',[item('Rondo','a2'),item('Alleen hier','b9')])]);
  const before=dst.ls.data[V2];
  const r=await dst.t.importBackup(file(backup));
  assert.ok(r.ok);
  assert.strictEqual(dst.t.state.team.name,'Uit back-up');
  assert.strictEqual(JSON.parse(dst.ls.data[REC]).raw,before,'herstelpunt bevat vorige lokale versie');
  assert.deepStrictEqual(kdItems(dst),['Alleen hier','Rondo','Sprint']);
  assert.strictEqual(r.knowledge.added,1);assert.strictEqual(r.knowledge.duplicates,1);
  assert.ok(dst.ls.data[KDB],'kennis heeft eigen laatste-versie-kopie');
  // tweede keer herstellen: niets dubbel
  await dst.t.importBackup(file(backup));
  assert.deepStrictEqual(kdItems(dst),['Alleen hier','Rondo','Sprint']);
});

test('herstel van oude back-up (zonder kennisonderdeel) laat kennis byte-voor-byte ongemoeid',async()=>{
  const dst=appWithKennis([update('Eigen',[item('X','c1')])]),kdBefore=dst.ls.data[KD];
  const old=JSON.parse(createApp().ls.data[V2]);old.team.name='Oude back-up';
  const r=await dst.t.importBackup(file(old));
  assert.ok(r.ok);assert.strictEqual(r.knowledge,null);
  assert.strictEqual(dst.t.state.team.name,'Oude back-up');
  assert.strictEqual(dst.ls.data[KD],kdBefore);
});

test('herstel van minimale/zeer oude back-up wordt aangevuld door normalize',async()=>{
  const a=createApp();
  const r=await a.t.importBackup(file({players:[{id:'p1',name:'Jan de Vries'}],trainings:[{id:'t1',date:'2026-09-01',attendance:{p1:'Aanwezig'}}]}));
  assert.ok(r.ok);
  const p=a.t.state.players[0];
  assert.strictEqual(p.firstName,'Jan');assert.strictEqual(p.lastName,'de Vries');
  assert.ok(Array.isArray(p.teamIds)&&p.teamIds.length===1);
  assert.strictEqual(a.t.state.trainings[0].attendance.p1,'Aanwezig');
  assert.ok(Array.isArray(a.t.state.trainings[0].guestPlayers));
});

test('kennisbankkoppelingen (knowledgeFiles) blijven behouden; nieuwste uploadedAt wint',()=>{
  const a=createApp();
  const merged=a.t.mergeKnowledgeFiles({k1:{name:'nieuw.pdf',uploadedAt:'2026-10-02T00:00:00Z'},k3:{name:'alleen-lokaal.pdf',uploadedAt:'2026-01-01T00:00:00Z'}},{k1:{name:'oud.pdf',uploadedAt:'2026-09-01T00:00:00Z'},k2:{name:'uit-backup.pdf',uploadedAt:'2026-09-01T00:00:00Z'}});
  assert.deepStrictEqual(Object.keys(merged).sort(),['k1','k2','k3']);
  assert.strictEqual(merged.k1.name,'nieuw.pdf');
});

test('ongeldige invoer: geen JSON, Kennis-export, ongeldige structuur en annuleren wijzigen niets',async()=>{
  const a=appWithKennis([update('Eigen',[item('X','c1')])]),v2=a.ls.data[V2],kd=a.ls.data[KD];
  for(const f of [file('{kapot'),file({format:a.t.kd.KD_EXPORT_FORMAT,version:1,updates:[]}),file({players:'geen lijst'}),file([])]){
    const r=await a.t.importBackup(f);assert.strictEqual(r.ok,false);
  }
  assert.ok(a.toasts.some(m=>/Kennis-export/.test(m)));
  const b=createApp({confirmAnswer:false});const bv2=b.ls.data[V2];
  const r=await b.t.importBackup(file(a.t.buildFullBackup()));
  assert.ok(r.cancelled);assert.strictEqual(b.ls.data[V2],bv2);
  assert.strictEqual(a.ls.data[V2],v2);assert.strictEqual(a.ls.data[KD],kd);
});

test('ongeldig kennisonderdeel: teamgegevens worden hersteld, kennis blijft ongemoeid en er is een waarschuwing',async()=>{
  const a=appWithKennis([update('Eigen',[item('X','c1')])]),kd=a.ls.data[KD];
  const backup=a.t.buildFullBackup();backup.knowledgeModule={format:'iets anders'};backup.team.name='Hersteld';
  let msg='';a.sandbox.confirm=m=>{msg=m;return true};
  const r=await a.t.importBackup(file(backup));
  assert.ok(r.ok);assert.strictEqual(a.t.state.team.name,'Hersteld');assert.strictEqual(a.ls.data[KD],kd);
  assert.ok(/ongeldig/.test(msg));
});

test('onleesbare lokale kennisopslag wordt nooit overschreven bij herstel',async()=>{
  const src=appWithKennis([update('U1',[item('Sprint','a1')])]),backup=src.t.buildFullBackup();
  const a=createApp({store:{[KD]:'{kapot'}});
  const r=await a.t.importBackup(file(backup));
  assert.ok(r.ok);assert.strictEqual(a.ls.data[KD],'{kapot');
});

test('mislukte lokale opslag tijdens herstel: oude state blijft, kennis niet aangevuld',async()=>{
  const src=appWithKennis([update('U1',[item('Sprint','a1')])]),backup=src.t.buildFullBackup();backup.team.name='Nieuw';
  const a=createApp(),name=a.t.state.team.name;a.ls.failWrites=true;
  const r=await a.t.importBackup(file(backup));
  assert.strictEqual(r.ok,false);assert.strictEqual(a.t.state.team.name,name);assert.ok(!a.ls.data[KD]);
});

test('bevestigingstekst noemt aantallen en dat kennis alleen wordt aangevuld',()=>{
  const a=appWithKennis([update('U1',[item('Sprint','a1')])]);
  const plan=a.t.backupRestorePlan(a.t.buildFullBackup(),a.t.state,{items:[],updates:[]});
  const txt=a.t.backupConfirmText(plan);
  assert.ok(/spelers/.test(txt)&&/trainingen/.test(txt)&&/AANGEVULD/.test(txt)&&/nooit overschreven/.test(txt));
  assert.strictEqual(plan.knowledgeSummary.newItems,1);
});

test('back-up van de echte startdata: alle trainingen, aanwezigheid en wedstrijden komen identiek terug',async()=>{
  const a=createApp(),orig=JSON.parse(JSON.stringify(a.t.state));
  const b=createApp();
  const r=await b.t.importBackup(file(a.t.buildFullBackup()));assert.ok(r.ok);
  assert.strictEqual(b.t.state.trainings.length,orig.trainings.length);
  assert.deepStrictEqual(b.t.state.trainings.map(t=>t.attendance),orig.trainings.map(t=>t.attendance));
  assert.deepStrictEqual(b.t.state.matches.map(m=>[m.id,m.lineup,m.benchIds]),orig.matches.map(m=>[m.id,m.lineup,m.benchIds]));
  assert.deepStrictEqual(b.t.state.players.map(p=>[p.id,p.name,p.teamIds]),orig.players.map(p=>[p.id,p.name,p.teamIds]));
});

test('back-up bevat geen Secret key, sessietokens of syncgegevens',()=>{
  const a=appWithKennis([update('U1',[item('Sprint','a1')])]);
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:'Zeer-Geheim-123'});
  a.ls.data['footballCoachAuthV1']=JSON.stringify({access_token:'acc-tok-xyz',refresh_token:'ref-tok-xyz',user:{id:'11111111-2222-3333-4444-555555555555'}});
  const txt=JSON.stringify(a.t.buildFullBackup());
  for(const s of ['Zeer-Geheim-123','acc-tok-xyz','ref-tok-xyz','sb_publishable'])assert.ok(!txt.includes(s),s);
});
