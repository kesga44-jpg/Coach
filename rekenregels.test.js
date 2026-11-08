// Regressietests rekenregels: aanwezigheid, selecties, rugnummers en wedstrijdblad.
// 1. Gouden vergelijking: op een vaste FICTIEVE dataset (tests/fixtures/rekenregels-dataset.json) en een vaste datum moeten de
//    uitkomsten exact gelijk zijn aan v2.9.1 (main@9b74826). De hashes zijn met de v2.9.1-code berekend.
//    (In 2.10.0 is dezelfde vergelijking ook op de toenmalige echte startdata uitgevoerd: identiek.)
// 2. Randgevallen van de bestaande regels (geen nieuwe rekenregels).
const test=require('node:test'),assert=require('node:assert');
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const {createApp}=require('./harness.js');
const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'tests/fixtures/rekenregels-golden.json'),'utf8'));

const DATASET=fs.readFileSync(path.join(__dirname,'tests/fixtures/rekenregels-dataset.json'),'utf8').trim();
function fixedApp(){
  const a=createApp({store:{footballCoachDataV2:DATASET}}),RealDate=Date,ISO='2026-11-08T12:00:00+01:00';
  class FixedDate extends RealDate{constructor(...x){if(x.length)super(...x);else super(ISO)}static now(){return new RealDate(ISO).getTime()}}
  a.sandbox.Date=FixedDate;return a;
}
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');

test('gouden vergelijking (fictieve dataset): aanwezigheid, tellingen, selectiewaarschuwingen en wedstrijdblad identiek aan v2.9.1',()=>{
  const a=fixedApp(),t=a.t,s=t.state,out={attendancePct:{},attendanceStats:{},trainingCounts:{},matchCounts:{},selection:{},sheet:{}};
  for(const team of s.teams)for(const p of s.players)out.attendancePct[team.id+'|'+p.id]=t.attendancePct(p.id,team.id);
  for(const p of s.players)out.attendanceStats[p.id]=t.attendanceStatsForTrainings(p.id,s.trainings.filter(x=>x.date<='2026-11-08'));
  for(const x of s.trainings)out.trainingCounts[x.id]=t.eventAttendanceCounts(x);
  for(const m of s.matches){out.matchCounts[m.id]=t.eventAttendanceCounts(m);out.selection[m.id]={warnings:t.selectionWarnings(m),dups:t.duplicateMatchNumbers(m)};out.sheet[m.id]=JSON.parse(JSON.stringify(t.matchSheetModel(m)))}
  for(const [k,g] of Object.entries(golden.sections)){
    const plain=JSON.parse(JSON.stringify(out[k]));
    assert.strictEqual(Object.keys(plain).length,g.entries,k+' aantal');
    assert.strictEqual(sha(plain),g.sha256,k+' uitkomst gewijzigd t.o.v. v2.9.1');
  }
});

function teamApp(){
  const a=fixedApp(),team=a.t.state.teams[0].id;
  const mk=(id,extra={})=>({id,firstName:id,lastName:'Test',name:id+' Test',primaryTeamId:team,teamIds:[team],active:true,startDate:'',...extra});
  return {a,team,mk};
}
test('aanwezigheid: geannuleerde en toekomstige trainingen tellen niet mee',()=>{
  const {a,team,mk}=teamApp();
  a.t.state.players=[mk('p')];
  a.t.state.trainings=[
    {id:'1',teamId:team,date:'2026-10-01',attendance:{p:'Aanwezig'}},
    {id:'2',teamId:team,date:'2026-10-08',attendance:{p:'Afwezig'}},
    {id:'3',teamId:team,date:'2026-10-15',attendance:{p:'Afwezig'},cancelled:true},
    {id:'4',teamId:team,date:'2026-12-01',attendance:{p:'Afwezig'}}];
  a.t.normalize();
  assert.strictEqual(a.t.attendancePct('p',team),50);
});
test('aanwezigheid: later geregistreerde speler — alleen trainingen vanaf "Aangemeld sinds"; lege registratie telt als niet aanwezig',()=>{
  const {a,team,mk}=teamApp();
  a.t.state.players=[mk('laat',{startDate:'2026-10-10'})];
  a.t.state.trainings=[
    {id:'1',teamId:team,date:'2026-10-01',attendance:{laat:'Afwezig'}},   // vóór aanmelding: telt niet
    {id:'2',teamId:team,date:'2026-10-10',attendance:{laat:'Aanwezig'}},  // aanmelddag telt mee
    {id:'3',teamId:team,date:'2026-10-17',attendance:{laat:'Aanwezig (herstellend)'}},
    {id:'4',teamId:team,date:'2026-10-24',attendance:{}}];               // niet ingevuld
  a.t.normalize();
  const st=a.t.attendanceStatsForTrainings('laat',a.t.state.trainings);
  assert.deepStrictEqual([st.relevant,st.present,st.filled,st.pct],[3,2,2,67]);
});
test('aanwezigheid: speler buiten de trainingsselectie telt niet; meetrainer telt niet bij eigen team',()=>{
  const {a,team,mk}=teamApp();
  a.t.state.teams.push({id:'o19',name:'O19',shortName:'O19'});
  a.t.state.players=[mk('a'),mk('b'),{...mk('g'),primaryTeamId:'o19',teamIds:['o19']}];
  a.t.state.trainings=[
    {id:'1',teamId:team,date:'2026-10-01',squadPlayerIds:['a'],attendance:{a:'Aanwezig'}},
    {id:'2',teamId:team,date:'2026-10-02',attendance:{a:'Aanwezig',b:'Aanwezig','guest:x':'Aanwezig'},guestPlayers:[{id:'x',playerId:'g'}]},
    {id:'3',teamId:'o19',date:'2026-10-03',attendance:{g:'Afwezig'}}];
  a.t.normalize();
  assert.strictEqual(a.t.attendancePct('b',team),100,'training 1 (andere selectie) telt niet voor b');
  assert.strictEqual(a.t.attendancePct('a',team),100);
  assert.strictEqual(a.t.attendancePct('g','o19'),0,'meetrainen bij ander team verandert eigen opkomst niet');
  const c=a.t.eventAttendanceCounts(a.t.state.trainings[1]);
  assert.strictEqual(c.present,3,'meetrainer telt wel mee in de trainingstelling');
});
test('wedstrijd: niet-beschikbare speler en dubbele rugnummers worden gesignaleerd; profielnummer blijft gelijk',()=>{
  const {a,team,mk}=teamApp();
  a.t.state.players=Array.from({length:13},(_,i)=>mk('p'+i,{number:String(i+1)}));
  const lineup={};['GK','LB','LCB','RCB','RB','DM','LCM','RCM','LW','ST','RW'].forEach((pos,i)=>lineup[pos]='p'+i);
  a.t.state.matches=[{id:'m',teamId:team,date:'2026-11-14',opponent:'Tegenstander',lineup,benchIds:['p11','p12'],playerNumbers:{p12:'1'},availability:{}}];
  a.t.normalize();const m=a.t.state.matches[0];
  assert.strictEqual(a.t.matchPlayerNumber(m,a.t.state.players[12]),'1');
  assert.strictEqual(a.t.state.players[12].number,'13');
  assert.ok(a.t.duplicateMatchNumbers(m).length>0);
  assert.ok(a.t.selectionWarnings(m).every(w=>!/in plaats van 11/.test(w)),'11 basisspelers');
});
