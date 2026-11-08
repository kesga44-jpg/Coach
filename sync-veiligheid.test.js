// Patch 3 — veiligheidsrem voor alle gegevenscategorieën, twee apparaten, gelijktijdige wijzigingen,
// herstel, reset en seizoensarchief. Gesimuleerde PostgREST-server; geen echte Supabase.
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
const UID='11111111-2222-3333-4444-555555555555',PASS='geheim',KD='footballCoachKnowledgeV1';
const res=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const pgTime=ms=>new Date(ms).toISOString().replace('Z','+00:00');
function server(){
  const srv={row:null,calls:[],beforePatch:null};
  srv.fetch=async(url,opt={})=>{
    const method=opt.method||'GET';srv.calls.push({url,method});
    if(url.endsWith('/auth/v1/user'))return res({id:UID});
    if(method==='GET')return res(srv.row?[{...srv.row}]:[]);
    if(method==='POST'){if(srv.row)return res('dup',409);const b=JSON.parse(opt.body)[0];srv.row={payload:b.payload,updated_at:pgTime(Date.parse(b.updated_at))};return res([srv.row],201)}
    if(method==='PATCH'){
      if(srv.beforePatch){const f=srv.beforePatch;srv.beforePatch=null;await f()}
      const m=decodeURIComponent(url).match(/updated_at=eq\.([^&]+)/);
      if(!srv.row||!m||Date.parse(m[1])!==Date.parse(srv.row.updated_at))return res([]);
      const b=JSON.parse(opt.body);srv.row={payload:b.payload,updated_at:pgTime(Date.parse(b.updated_at))};return res([srv.row]);
    }
    return res('?',400);
  };
  return srv;
}
function device(srv,{store}={}){
  const a=createApp({store});a.sandbox.fetch=srv.fetch;
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:PASS});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:UID,email:'a@b.nl'}});
  return a;
}
const writes=srv=>srv.calls.filter(c=>c.method==='POST'||c.method==='PATCH').length;
const cloud=async(srv,a)=>a.t.decryptData(srv.row.payload,PASS);
async function synced(){const srv=server(),a=device(srv);await a.t.pushSync(false);return {srv,a}}

test('twee apparaten: A uploadt, B haalt op, B wijzigt (stil), A haalt op — alles komt over',async()=>{
  const {srv,a}=await synced(),b=device(srv);
  await b.t.pullSync(false);
  b.t.state.coachNotes.push({id:'n-b',teamId:b.t.state.teams[0].id,date:'2026-11-01',category:'Training',text:'van B'});
  await b.t.pushSync(true);
  assert.ok((await cloud(srv,a)).coachNotes.some(n=>n.id==='n-b'));
  await a.t.pullSync(false);
  assert.ok(a.t.state.coachNotes.some(n=>n.id==='n-b'));
});

test('gelijktijdige wijzigingen: tweede apparaat krijgt een conflict, niets gaat stil verloren',async()=>{
  const {srv,a}=await synced(),b=device(srv);await b.t.pullSync(false);
  a.t.state.team.name='Wijziging A';b.t.state.team.name='Wijziging B';
  await a.t.pushSync(true);
  const n=writes(srv);await b.t.pushSync(true);
  assert.strictEqual(writes(srv),n,'B uploadt niet stil');
  assert.strictEqual((await cloud(srv,a)).team.name,'Wijziging A');
  assert.strictEqual(b.t.state.team.name,'Wijziging B','lokale wijziging B behouden');
  assert.strictEqual(JSON.parse(b.ls.data[b.t.CLOUD_CONFLICT_KEY]).data.team.name,'Wijziging A','versie A bewaard op B');
  let asked=false;b.sandbox.confirm=()=>{asked=true;return true};
  await b.t.pushSync(false);                       // bewuste keuze van de trainer
  assert.ok(asked);assert.strictEqual((await cloud(srv,a)).team.name,'Wijziging B');
  a.t.state.team.name='A opnieuw';const m=writes(srv);await a.t.pushSync(true);
  assert.strictEqual(writes(srv),m,'A merkt dat de cloud intussen is gewijzigd');
});

test('race: cloud wijzigt tussen ophalen en schrijven → PATCH raakt niets, conflict bewaard',async()=>{
  const {srv,a}=await synced(),b=device(srv);await b.t.pullSync(false);
  b.t.state.team.name='Tussendoor';
  a.t.state.team.name='Bijna geschreven';
  srv.beforePatch=async()=>{await b.t.pushSync(true)};
  await a.t.pushSync(true);
  assert.strictEqual((await cloud(srv,a)).team.name,'Tussendoor');
  assert.strictEqual(a.t.state.team.name,'Bijna geschreven');
  assert.strictEqual(JSON.parse(a.ls.data[a.t.CLOUD_CONFLICT_KEY]).data.team.name,'Tussendoor');
});

const CASES=[
  ['coachnotities',s=>{s.coachNotes=[]},s=>{for(let i=0;i<5;i++)s.coachNotes.push({id:'n'+i,teamId:s.teams[0].id,date:'2026-10-0'+(i+1),category:'Training',text:'x'})}],
  ['teams',s=>{s.teams=s.teams.slice(0,1)},s=>{s.teams.push({id:'team-2',name:'Tweede',shortName:'2'})}],
  ['aanwezigheidsregistraties',s=>{s.trainings.forEach(t=>{t.attendance={}})}],
  ['opstellingsplaatsen',s=>{s.matches.forEach(m=>{m.lineup={}})},s=>{s.matches.forEach(m=>{['GK','LB','LCB','RCB','RB'].forEach((k,i)=>{m.lineup[k]=s.players[i].id})})}],
  ['wedstrijdstatistieken',s=>{s.matches.forEach(m=>{m.playerStats={}})},s=>{s.matches.forEach(m=>{s.players.slice(0,3).forEach(p=>{m.playerStats[p.id]={minutes:90}})})}],
  ['trainingsonderdelen',s=>{s.trainings.forEach(t=>{t.planItems=[];t.exerciseIds=[]})},s=>{s.trainings.slice(0,4).forEach(t=>{t.planItems=[{id:'pi-'+t.id,exerciseId:s.exercises[0].id,duration:10}]})}],
  ['spelprincipes',s=>{s.gameModel.principles=[]}],
  ['trainingssjablonen',s=>{s.templates.trainings=[]},s=>{for(let i=0;i<3;i++)s.templates.trainings.push({id:'tpl'+i,name:'T'+i,planItems:[]})}],
  ['kennisbankkoppelingen',s=>{s.knowledgeFiles={}},s=>{s.knowledgeFiles={a:{name:'a.pdf'},b:{name:'b.pdf'},c:{name:'c.pdf'}}}],
  ['ontwikkeldoelen',s=>{s.players.forEach(p=>{p.idp.goals=[]})},s=>{s.players.slice(0,4).forEach((p,i)=>{p.idp.goals.push({id:'g'+i,title:'Doel'})})}],
  ['oefeningen',s=>{s.exercises=s.exercises.slice(0,5)}],
  ['club (onderdeel leeg)',s=>{s.club={}},s=>{s.club={name:'D.S.V. Full Speed'}}],
  ['spelers vervangen door anderen (zelfde aantal)',s=>{s.players.forEach((p,i)=>{p.id='nieuw-'+i})}],
];
for(const [naam,mutate,prepare] of CASES){
  test(`veiligheidsrem: ${naam} — geen stille upload, wel vraag bij handmatig uploaden`,async()=>{
    const srv=server(),a=device(srv);
    if(prepare){prepare(a.t.state);a.t.normalize()}
    await a.t.pushSync(false);const n=writes(srv),before=JSON.stringify(await cloud(srv,a));
    mutate(a.t.state);
    await a.t.pushSync(true);
    assert.strictEqual(writes(srv),n,'geen stille upload');
    assert.strictEqual(JSON.stringify(await cloud(srv,a)),before,'cloud ongewijzigd');
    let msg='';a.sandbox.confirm=m=>{msg=m;return false};
    await a.t.pushSync(false);
    assert.ok(/minder gegevens|weg|leeg/.test(msg),'melding noemt het verlies: '+msg.slice(0,120));
    assert.strictEqual(writes(srv),n);
  });
}

test('normale bewerkingen gaan wél stil mee (geen valse blokkade)',async()=>{
  const {srv,a}=await synced();const s=a.t.state;let n=writes(srv);
  const steps=[
    ()=>{s.trainings.push({id:'tr-nieuw',teamId:s.teams[0].id,date:'2026-11-20',attendance:{},planItems:[]})},
    ()=>{s.trainings=s.trainings.filter(t=>t.id!==s.trainings[0].id)},          // 1 training verwijderen
    ()=>{const t=s.trainings[1];Object.keys(t.attendance).slice(0,2).forEach(k=>{t.attendance[k]='Afwezig'})},
    ()=>{s.players[0].firstName='Hernoemd';s.players[0].name='Hernoemd X'},
    ()=>{s.matches[0].lineup.GK=s.players[0].id},
    ()=>{delete s.matches[0].lineup.GK},
    ()=>{s.players[1].active=false},
  ];
  for(const st of steps){st();await a.t.pushSync(true);assert.strictEqual(writes(srv),++n,'stap '+st.toString().slice(0,60))}
});

test('Kennis & Ontwikkeling wordt door uploaden en ophalen nooit aangeraakt',async()=>{
  const {srv,a}=await synced();
  const kd=JSON.stringify({version:1,updates:[],items:[{id:'i1',raw:{title:'Lokaal artikel'},category:'Overig'}]});
  a.ls.data[KD]=kd;
  a.t.state.team.name='X';await a.t.pushSync(true);
  const b=device(srv);b.ls.data[KD]='{"version":1,"updates":[],"items":[]}';
  await b.t.pullSync(false);await a.t.pullSync(false);
  assert.strictEqual(a.ls.data[KD],kd);assert.strictEqual(b.ls.data[KD],'{"version":1,"updates":[],"items":[]}');
  assert.ok(!JSON.stringify(await cloud(srv,a)).includes('Lokaal artikel'));
});

test('ophalen uit de cloud noemt vooraf wat lokaal verdwijnt; annuleren wijzigt niets',async()=>{
  const {srv,a}=await synced(),b=device(srv);await b.t.pullSync(false);
  for(let i=0;i<4;i++)b.t.state.coachNotes.push({id:'lokaal-'+i,teamId:b.t.state.teams[0].id,date:'2026-11-01',category:'Training',text:'alleen lokaal'});
  const before=JSON.stringify(b.t.state);let msg='';b.sandbox.confirm=m=>{msg=m;return false};
  await b.t.pullSync(false);
  assert.ok(/coachnotities: 4 van 4 weg/.test(msg),msg);
  assert.strictEqual(JSON.stringify(b.t.state),before);
});

function clickButton(a,attr){a.t.handleClick({target:{closest:()=>({hasAttribute:k=>k===attr,dataset:{}})}})}
test('terug naar startdata: sync-basis gewist, niets stil naar de cloud',async()=>{
  const {srv,a}=await synced();const n=writes(srv);
  a.t.state.team.name='voor reset';
  clickButton(a,'data-reset');
  assert.strictEqual(a.t.readSyncBase(),null);
  await a.t.pushSync(true);assert.strictEqual(writes(srv),n);
});
test('seizoen archiveren: sync-basis gewist, lege trainingslijst niet stil geüpload',async()=>{
  const {srv,a}=await synced();const n=writes(srv);
  a.sandbox.prompt=()=>'2027/2028';
  clickButton(a,'data-archive-season');
  assert.strictEqual(a.t.state.trainings.length,0,'archiveren uitgevoerd');
  assert.strictEqual(a.t.readSyncBase(),null);
  await a.t.pushSync(true);assert.strictEqual(writes(srv),n);
  assert.ok((await cloud(srv,a)).trainings.length>0,'cloud behoudt het seizoen');
});
test('herstel van back-up: sync-basis gewist, eerst handmatig bevestigen',async()=>{
  const {srv,a}=await synced();const n=writes(srv);
  const txt=JSON.stringify(a.t.buildFullBackup());
  await a.t.importBackup({size:txt.length,text:async()=>txt});
  await a.t.pushSync(true);assert.strictEqual(writes(srv),n);
});
