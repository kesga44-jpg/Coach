// Regressietests 2.10: synchronisatie met basisversie (fast-forward) tegen een gesimuleerde PostgREST-server.
// Geen echte Supabase: fetch is gemockt. Dit bewijst de clientlogica, niet de productieconfiguratie.
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
const UID='11111111-2222-3333-4444-555555555555',UID2='99999999-2222-3333-4444-555555555555';
const PASS='geheim';
const res=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const pgTime=ms=>new Date(ms).toISOString().replace('Z','+00:00'); // PostgREST-notatie

function server(){
  const srv={row:null,calls:[],clock:Date.parse('2026-11-01T10:00:00Z')};
  srv.fetch=async(url,opt={})=>{
    const method=opt.method||'GET';srv.calls.push({url,method,body:opt.body});
    if(url.endsWith('/auth/v1/user'))return res({id:srv.user||UID});
    if(!url.includes('/rest/v1/coach_data_auth'))return res('onbekend',404);
    if(method==='GET')return res(srv.row?[{payload:srv.row.payload,updated_at:srv.row.updated_at}]:[]);
    if(method==='POST'){if(srv.row)return res('dup',409);const b=JSON.parse(opt.body)[0];srv.row={payload:b.payload,updated_at:pgTime(Date.parse(b.updated_at))};return res([srv.row],201)}
    if(method==='PATCH'){
      const m=decodeURIComponent(url).match(/updated_at=eq\.([^&]+)/);
      if(!srv.row||!m||Date.parse(m[1])!==Date.parse(srv.row.updated_at))return res([]);
      const b=JSON.parse(opt.body);srv.row={payload:b.payload,updated_at:pgTime(Date.parse(b.updated_at))};return res([srv.row]);
    }
    return res('?',400);
  };
  return srv;
}
function device(srv,{user=UID,confirmAnswer=true}={}){
  const a=createApp({confirmAnswer});
  a.sandbox.fetch=srv.fetch;
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:PASS});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:user,email:'a@b.nl'}});
  return a;
}
const writes=srv=>srv.calls.filter(c=>c.method==='POST'||c.method==='PATCH');
async function cloudTeamName(srv,a){return (await a.t.decryptData(srv.row.payload,PASS)).team.name}

test('na eerste (bevestigde) upload gaat een lokale wijziging stil mee (fast-forward), zonder conflict',async()=>{
  const srv=server(),a=device(srv);
  await a.t.pushSync(false);                       // eerste upload met bevestiging
  assert.strictEqual(writes(srv).length,1);
  assert.ok(a.t.readSyncBase());
  a.t.state.team.name='Gewijzigd';
  await a.t.pushSync(true);                        // stille autosync
  assert.strictEqual(writes(srv).length,2);
  assert.strictEqual(await cloudTeamName(srv,a),'Gewijzigd');
  assert.ok(!a.ls.data[a.t.CLOUD_CONFLICT_KEY],'geen conflict bewaard');
});

test('cloud gewijzigd door ander apparaat: stille sync overschrijft niets en bewaart de cloudversie',async()=>{
  const srv=server(),a=device(srv),b=device(srv);
  await a.t.pushSync(false);
  await b.t.pullSync(false);                       // b haalt op en krijgt basis
  b.t.state.team.name='Van B';await b.t.pushSync(true);
  assert.strictEqual(await cloudTeamName(srv,a),'Van B');
  a.t.state.team.name='Van A';await a.t.pushSync(true);
  assert.strictEqual(await cloudTeamName(srv,a),'Van B','cloud niet overschreven');
  assert.strictEqual(JSON.parse(a.ls.data[a.t.CLOUD_CONFLICT_KEY]).data.team.name,'Van B');
  assert.strictEqual(a.t.state.team.name,'Van A','lokale gegevens behouden');
});

test('verschil in tijdnotatie (Z vs +00:00) blokkeert fast-forward niet',async()=>{
  const srv=server(),a=device(srv);
  await a.t.pushSync(false);
  assert.ok(srv.row.updated_at.endsWith('+00:00'));
  a.t.state.team.name='Tweede';await a.t.pushSync(true);
  assert.strictEqual(await cloudTeamName(srv,a),'Tweede');
});

test('veiligheidsrem: lokaal veel minder trainingen dan in de cloud = geen stille upload, wel vraag bij handmatig',async()=>{
  const srv=server(),a=device(srv);
  await a.t.pushSync(false);const n=writes(srv).length;
  a.t.state.trainings=a.t.state.trainings.slice(0,5);
  await a.t.pushSync(true);
  assert.strictEqual(writes(srv).length,n,'geen stille upload');
  assert.ok(a.ls.data[a.t.CLOUD_CONFLICT_KEY]);
  let asked='';a.sandbox.confirm=m=>{asked=m;return false};
  await a.t.pushSync(false);
  assert.ok(/minder gegevens/.test(asked));assert.strictEqual(writes(srv).length,n);
});

test('na herstel van een back-up is eerst een handmatige upload nodig',async()=>{
  const srv=server(),a=device(srv);
  await a.t.pushSync(false);const n=writes(srv).length;
  const backup=a.t.buildFullBackup();backup.team.name='Uit back-up';
  const txt=JSON.stringify(backup);
  await a.t.importBackup({size:txt.length,text:async()=>txt});
  assert.strictEqual(a.t.readSyncBase(),null);
  await a.t.pushSync(true);
  assert.strictEqual(writes(srv).length,n,'herstel wordt niet stil naar de cloud gestuurd');
});

test('basisversie van een ander account wordt niet gebruikt',async()=>{
  const srv=server(),a=device(srv);
  await a.t.pushSync(false);
  const base=a.t.readSyncBase();a.t.writeSyncBase(UID2,base.updatedAt);
  a.t.state.team.name='X';await a.t.pushSync(true);
  assert.notStrictEqual(await cloudTeamName(srv,a),'X');
});

test('ophalen (pull) zet de basis, waarna lokale wijzigingen stil mee kunnen',async()=>{
  const srv=server(),a=device(srv);a.t.state.team.name='Bron';await a.t.pushSync(false);
  const b=device(srv);await b.t.pullSync(false);
  assert.strictEqual(b.t.state.team.name,'Bron');
  assert.ok(b.t.readSyncBase());
  b.t.state.team.name='Bron 2';await b.t.pushSync(true);
  assert.strictEqual(await cloudTeamName(srv,b),'Bron 2');
});

test('syncShrinkWarning: kleine verschillen tellen niet, grote daling wel',()=>{
  const a=createApp(),mk=n=>({trainings:Array.from({length:n},(_,i)=>({id:'t'+i}))});
  assert.strictEqual(a.t.syncShrinkWarning(mk(10),mk(9)).length,0);
  assert.strictEqual(a.t.syncShrinkWarning(mk(3),mk(1)).length,0);
  assert.strictEqual(a.t.syncShrinkWarning(mk(20),mk(10)).length,1);
});

test('offline: sync doet niets en lokale gegevens blijven bewaard',async()=>{
  const a=createApp();a.sandbox.fetch=async()=>{throw new Error('offline')};
  a.ls.data['footballCoachSyncV1']=JSON.stringify({pass:PASS});
  a.ls.data[a.t.AUTH_KEY]=JSON.stringify({access_token:'tok',refresh_token:'ref',expires_at:Date.now()+3600000,user:{id:UID,email:''}});
  a.t.state.team.name='Offline gewijzigd';assert.notStrictEqual(a.t.save({render:false,sync:false}),false);
  await a.t.pushSync(true);
  assert.strictEqual(JSON.parse(a.ls.data['footballCoachDataV2']).team.name,'Offline gewijzigd');
});
