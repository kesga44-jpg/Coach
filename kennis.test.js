// Regressietests Kennis & Ontwikkeling: bestaande Coach-gegevens moeten aantoonbaar intact blijven.
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
const V2='footballCoachDataV2',KD='footballCoachKnowledgeV1';

// Twee afzonderlijke teams, spelers per team, wedstrijden, trainingen en bibliotheek.
function fixture(){
  const a=createApp(),s=a.t.state;
  s.teams=[{id:'team-a',name:'Full Speed O23',shortName:'O23',active:true,formation:'4-3-3',notes:''},{id:'team-b',name:'Full Speed 2',shortName:'2',active:true,formation:'4-4-2',notes:''}];
  s.players=[
    {id:'pa1',firstName:'Anna',lastName:'Alpha',name:'Anna Alpha',primaryTeamId:'team-a',teamIds:['team-a']},
    {id:'pa2',firstName:'Bob',lastName:'Alpha',name:'Bob Alpha',primaryTeamId:'team-a',teamIds:['team-a']},
    {id:'pb1',firstName:'Cor',lastName:'Beta',name:'Cor Beta',primaryTeamId:'team-b',teamIds:['team-b']},
    {id:'pb2',firstName:'Dirk',lastName:'Beta',name:'Dirk Beta',primaryTeamId:'team-b',teamIds:['team-b','team-a']},
    {id:'pb3',firstName:'Eef',lastName:'Beta',name:'Eef Beta',primaryTeamId:'team-b',teamIds:['team-b']}];
  s.matches=[{id:'ma',teamId:'team-a',date:'2026-09-12',opponent:'Tegenstander A',goalsFor:'3',goalsAgainst:'1'},{id:'mb',teamId:'team-b',date:'2026-09-13',opponent:'Tegenstander B',goalsFor:'0',goalsAgainst:'2'}];
  s.trainings=[{id:'ta',teamId:'team-a',date:'2026-09-08',title:'Training A',focus:'Opbouw'},{id:'tb',teamId:'team-b',date:'2026-09-09',title:'Training B',focus:'Druk zetten'}];
  s.exercises=[{id:'ex1',name:'Rondo 4v2',category:'Positiespel'},{id:'ex2',name:'Sprintreeks',category:'Conditie'},{id:'ex3',name:'Afwerkvorm',category:'Afwerken'}];
  s.documents=[{id:'doc1',name:'Bron.pdf'}];
  assert.notStrictEqual(a.t.save({render:false,sync:false}),false);
  return a;
}
const reload=a=>createApp({store:a.ls.data});
const core=st=>JSON.stringify({teams:st.teams,players:st.players,matches:st.matches,trainings:st.trainings,exercises:st.exercises,documents:st.documents,team:st.team,knowledgeFiles:st.knowledgeFiles,gameModel:st.gameModel,templates:st.templates,meta:{...st.meta,updatedAt:0,activityLog:0}});
const update=(o={})=>({schema_version:'1.0',record_type:'football_knowledge_update',title:'Weekupdate 1',update_date:'2026-10-01',team_context:'Full Speed O23',summary:'Samenvatting',weekly_team_advice:'Train 2x snelheid',next_training_action:'Rondo 4v2 met druk',no_update_note:'',toekomstig_veld:{x:1},
  items:[{title:'Sprinttraining bij amateurs',source:'Journal of Sports Science https://doi.org/10.1000/abc123',publication_date:'2026-09-01',research_method:'RCT',key_findings:['Sneller na 6 weken'],novelty:'Nieuw',evidence_quality:'Hoog',relevance_full_speed_o23:'Hoog',practical_translation:'Korte sprints',training_form:'3x30m sprint',recommendation:'Doen',tags:['sprint','snelheid'],extra_onbekend:{a:[1,2]}}],...o});
const json=o=>JSON.stringify(update(o));

test('regressie: nieuwe kennisimport laat V2-opslag byte-voor-byte ongewijzigd en slaat apart op',()=>{
  const a=fixture(),before=a.ls.data[V2],stateBefore=core(a.t.state);
  const r=a.t.kd.kdImport(json());
  assert.strictEqual(r.ok,true);assert.strictEqual(r.added,1);
  assert.strictEqual(a.ls.data[V2],before);
  assert.strictEqual(core(a.t.state),stateBefore);
  assert.ok(!('knowledgeUpdates' in a.t.state)&&!('kennis' in a.t.state));
  assert.ok(a.ls.data[KD]);
});
test('regressie: volledig herladen - teams, spelers, wedstrijden, trainingen, bibliotheek en kennis blijven bestaan',()=>{
  const a=fixture(),stateBefore=core(reload(a).t.state);
  a.t.kd.kdImport(json());
  const b=reload(a),s=b.t.state;
  assert.strictEqual(b.t.storageLoadError,null);
  assert.deepStrictEqual(s.teams.map(t=>t.id),['team-a','team-b']);
  assert.strictEqual(s.teams.length,2);
  assert.deepStrictEqual(s.players.filter(p=>p.primaryTeamId==='team-a').map(p=>p.id),['pa1','pa2']);
  assert.deepStrictEqual(s.players.filter(p=>p.primaryTeamId==='team-b').map(p=>p.id),['pb1','pb2','pb3']);
  assert.deepStrictEqual(s.players.find(p=>p.id==='pb2').teamIds,['team-b','team-a']);
  assert.deepStrictEqual(s.matches.map(m=>[m.id,m.teamId]),[['ma','team-a'],['mb','team-b']]);
  assert.deepStrictEqual(s.trainings.map(t=>[t.id,t.teamId]),[['ta','team-a'],['tb','team-b']]);
  assert.deepStrictEqual(s.exercises.map(e=>e.id),['ex1','ex2','ex3']);
  assert.strictEqual(core(s),stateBefore);
  const k=b.t.kd.kdRead();assert.strictEqual(k.error,null);assert.strictEqual(k.store.items.length,1);assert.strictEqual(k.store.updates.length,1);
});
test('regressie: opslaan van de gewone app na import wijzigt kennis niet en kennis wijzigt de app niet',()=>{
  const a=fixture();a.t.kd.kdImport(json());const kd=a.ls.data[KD];
  a.t.state.teams[1].name='Hernoemd';a.t.save({render:false,sync:false});
  assert.strictEqual(a.ls.data[KD],kd);
  const b=reload(a);assert.strictEqual(b.t.state.teams[1].name,'Hernoemd');assert.strictEqual(b.t.state.teams.length,2);
});
test('formaat: alle velden en onbekende extra velden blijven behouden (root en item)',()=>{
  const a=fixture();a.t.kd.kdImport(json());
  const {store}=a.t.kd.kdRead(),root=store.updates[0].root,raw=store.items[0].raw;
  ['schema_version','record_type','title','update_date','team_context','summary','weekly_team_advice','next_training_action','no_update_note','toekomstig_veld'].forEach(k=>assert.ok(k in root,k));
  assert.deepStrictEqual(root.toekomstig_veld,{x:1});
  assert.deepStrictEqual(raw.extra_onbekend,{a:[1,2]});
  assert.strictEqual(raw.research_method,'RCT');
  assert.strictEqual(a.t.kd.kdGet(raw,'method'),'RCT');
  assert.strictEqual(store.items[0].category,'Fysiek & belasting');
});
test('validatie: ongeldige JSON, ontbrekende verplichte velden en foute items slaan niets op',()=>{
  const a=fixture(),b0=a.ls.data[V2];
  const bad=['{kapot','[]','',json({title:undefined}),json({items:'x'}),json({record_type:'iets_anders'}),json({update_date:'morgen'}),json({items:[]}),json({items:[{source:'x'}]}),json({items:[{title:'ok',source:'x'},{source:'zonder titel'}]})];
  bad.forEach(t=>{const r=a.t.kd.kdImport(t);assert.strictEqual(r.ok,false,t);assert.ok(r.errors.length)});
  ['schema_version','record_type','title','update_date','team_context','summary','items'].forEach(k=>{const o=update();delete o[k];assert.strictEqual(a.t.kd.kdImport(JSON.stringify(o)).ok,false,k)});
  assert.strictEqual(a.ls.data[KD],undefined);assert.strictEqual(a.ls.data[V2],b0);
});
test('validatie: lege items met no_update_note is toegestaan',()=>{
  const a=fixture(),r=a.t.kd.kdImport(json({items:[],no_update_note:'Geen nieuwe studies'}));
  assert.strictEqual(r.ok,true);assert.strictEqual(r.added,0);assert.strictEqual(a.t.kd.kdRead().store.updates.length,1);
});
test('dubbelen: dezelfde update twee keer en hetzelfde artikel in andere update worden voorkomen',()=>{
  const a=fixture();assert.ok(a.t.kd.kdImport(json()).ok);
  const again=a.t.kd.kdImport(json());assert.strictEqual(again.ok,false);assert.match(again.errors.join(' '),/al eerder/);
  const other=a.t.kd.kdImport(json({title:'Weekupdate 2',update_date:'2026-10-08',items:[{title:'Heel andere titel',source:'Journal of Sports Science https://doi.org/10.1000/ABC123'},{title:'Nieuw artikel',source:'Bron X'}]}));
  assert.strictEqual(other.ok,true);assert.strictEqual(other.added,1);assert.strictEqual(other.duplicates,1);
  assert.strictEqual(a.t.kd.kdRead().store.items.length,2);
  const intern=a.t.kd.kdImport(json({title:'U3',update_date:'2026-10-09',items:[{title:'Zelfde',source:'S'},{title:'ZELFDE ',source:'s'}]}));
  assert.strictEqual(intern.added,1);assert.strictEqual(intern.duplicates,1);
});
test('mislukte opslag: geen gedeeltelijke kennis, bestaande kennis en V2 intact',()=>{
  const a=fixture();a.t.kd.kdImport(json());const kd=a.ls.data[KD],v2=a.ls.data[V2];
  a.ls.failWrites=true;
  const r=a.t.kd.kdImport(json({title:'U2',update_date:'2026-10-08',items:[{title:'Ander',source:'S'}]}));
  assert.strictEqual(r.ok,false);assert.match(r.errors[0],/Opslaan mislukt/);
  a.ls.failWrites=false;assert.strictEqual(a.ls.data[KD],kd);assert.strictEqual(a.ls.data[V2],v2);
});
test('beschadigde kennisopslag wordt nooit overschreven; app blijft normaal werken',()=>{
  const a=fixture();a.ls.data[KD]='{kapot';
  const r=a.t.kd.kdImport(json());assert.strictEqual(r.ok,false);assert.strictEqual(a.ls.data[KD],'{kapot');
  assert.match(a.t.kd.renderKennis(),/onleesbaar/);
  const b=reload(a);assert.strictEqual(b.t.storageLoadError,null);assert.strictEqual(b.t.state.teams.length,2);
});
test('aanpassen: wijzigt alleen dit artikel, behoudt onbekende velden, voorkomt dubbel; verwijderen raakt niets anders',()=>{
  const a=fixture();a.t.kd.kdImport(json());
  a.t.kd.kdImport(json({title:'U2',update_date:'2026-10-08',items:[{title:'Tweede',source:'S2'}]}));
  const [i1,i2]=a.t.kd.kdRead().store.items,v2=a.ls.data[V2];
  assert.strictEqual(a.t.kd.kdUpdateItem(i1.id,{title:'Nieuwe titel',tags:'a, b',category:'Mentaal & motivatie'}).ok,true);
  let it=a.t.kd.kdRead().store.items.find(i=>i.id===i1.id);
  assert.strictEqual(it.raw.title,'Nieuwe titel');assert.deepStrictEqual(it.raw.tags,['a','b']);assert.deepStrictEqual(it.raw.extra_onbekend,{a:[1,2]});assert.deepStrictEqual(it.raw.key_findings,['Sneller na 6 weken']);assert.strictEqual(it.category,'Mentaal & motivatie');
  assert.strictEqual(a.t.kd.kdUpdateItem(i1.id,{title:''}).ok,false);
  assert.strictEqual(a.t.kd.kdUpdateItem(i1.id,{title:'Tweede',source:'S2'}).ok,false);
  assert.strictEqual(a.t.kd.kdDeleteItem(i2.id).ok,true);
  assert.strictEqual(a.t.kd.kdRead().store.items.length,1);assert.strictEqual(a.ls.data[V2],v2);
  assert.strictEqual(a.t.kd.kdDeleteUpdate(a.t.kd.kdRead().store.updates[0].id).ok,true);
  assert.strictEqual(a.t.kd.kdRead().store.items.length,0);assert.strictEqual(a.ls.data[V2],v2);
});
test('zoeken en categoriseren; weergave rendert en escapet HTML',()=>{
  const a=fixture();a.t.kd.kdImport(json({items:[{title:'Sprint <b>x</b>',source:'S',tags:['sprint']},{title:'Mentale weerbaarheid bij jeugd',source:'T',tags:['mentaal']}]}));
  const {store}=a.t.kd.kdRead();
  assert.strictEqual(a.t.kd.kdSearch(store,'weerbaarheid').length,1);
  assert.strictEqual(a.t.kd.kdSearch(store,'').length,2);
  assert.strictEqual(a.t.kd.kdSearch(store,'',store.items[1].category).length,1);
  const html=a.t.kd.renderKennis();assert.ok(!html.includes('<b>x</b>'));assert.match(html,/Sprint &lt;b&gt;/);
  a.t.kd.kdUi().tab='advies';assert.match(a.t.kd.renderKennis(),/Rondo 4v2 met druk/);
});
test('Meer-menu bevat Kennis & Ontwikkeling en bestaande onderdelen blijven aanwezig',()=>{
  const fs=require('fs'),src=fs.readFileSync(__dirname+'/app.js','utf8');
  ['Coachkompas','Trainingen','Aanwezigheid','Wedstrijden','Oefeningen','Tactiekbord','Spelmodel','Seizoen','Statistieken','Coachnotities','Kennisbank','Bronnen','Coachassistent','Instellingen','Kennis & Ontwikkeling'].forEach(l=>assert.ok(src.includes(`,'${l}']`),l));
  const a=fixture();a.t.state.knowledgeUpdates;a.t.kd.kdUi().tab='artikelen';assert.ok(a.t.kd.renderKennis().length>100);
});

// Synchronisatie en accountwissels: kennis staat buiten het sync-payload en wordt niet geraakt.
const S={url:'https://example.invalid',key:'k',pass:'geheim'},UID='11111111-2222-3333-4444-555555555555',UID2='22222222-2222-4222-8222-222222222222';
const res=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
function mockFetch(a,h){const calls=[];a.sandbox.fetch=async(url,opt={})=>{const c={url,method:opt.method||'GET',headers:opt.headers||{},body:opt.body};calls.push(c);return h(c)};return calls}
function syncSetup(a,{cloudRows=[],user=UID}={}){
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:S.pass});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:user,email:'x@y.nl'}});
  return mockFetch(a,c=>c.url.endsWith('/auth/v1/user')?res({id:user}):c.method==='POST'?res([{id:'x'}],201):res(cloudRows));
}
test('sync: upload bevat beide teams en geen kennisgegevens; kennis en state blijven ongewijzigd',async()=>{
  const a=fixture();a.t.kd.kdImport(json());const kd=a.ls.data[KD],v2=a.ls.data[V2];
  a.sandbox.confirm=()=>true;const calls=syncSetup(a,{user:UID2});
  await a.t.pushSync(false);
  const post=calls.find(c=>c.method==='POST'&&c.url.includes('/rest/v1/'));assert.ok(post);
  const sent=await a.t.decryptData(JSON.parse(post.body)[0].payload,S.pass);
  assert.strictEqual(sent.teams.length,2);assert.strictEqual(sent.players.length,5);assert.ok(!JSON.stringify(sent).includes('Sprinttraining'));
  assert.strictEqual(a.ls.data[KD],kd);assert.strictEqual(a.ls.data[V2],v2);
});
test('sync: clouddata overnemen vervangt kennis niet en wist geen teams van de cloudkopie',async()=>{
  const a=fixture();a.t.kd.kdImport(json());const kd=a.ls.data[KD];
  const remote=JSON.parse(a.ls.data[V2]);remote.teams.push({id:'team-c',name:'Derde',shortName:'3',active:true,formation:'4-3-3',notes:''});
  a.t.persistRemoteCopy(remote);
  assert.strictEqual(a.t.state.teams.length,3);assert.strictEqual(a.ls.data[KD],kd);
  assert.strictEqual(a.t.kd.kdRead().store.items.length,1);
});
test('accountwissel: annuleren, uitloggen en inloggen als ander account laten teams, spelers en kennis intact',async()=>{
  const a=fixture();a.t.kd.kdImport(json());const kd=a.ls.data[KD],v2=a.ls.data[V2];
  a.sandbox.confirm=()=>false;const calls=syncSetup(a,{user:UID2});
  await a.t.pushSync(true);await a.t.pushSync(false);
  assert.strictEqual(calls.filter(c=>c.method==='POST'&&c.url.includes('/rest/v1/')).length,0);
  await a.t.authSignOut();assert.strictEqual(a.t.getAuthSession(),null);
  await a.t.initialSync();
  assert.strictEqual(a.ls.data[KD],kd);assert.strictEqual(a.ls.data[V2],v2);
  const b=reload(a);assert.strictEqual(b.t.state.teams.length,2);assert.strictEqual(b.t.kd.kdRead().store.items.length,1);
});
test('index.html laadt kennis.js vóór app.js (app.js verwijst bij de eerste render naar renderKennis)',()=>{
  const h=require('fs').readFileSync(__dirname+'/index.html','utf8');
  assert.ok(h.indexOf('kennis.js')>0&&h.indexOf('kennis.js')<h.indexOf('app.js'));
  assert.ok(h.includes('id="kdFile"'));
});
