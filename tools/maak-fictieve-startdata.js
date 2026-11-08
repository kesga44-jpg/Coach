// Genereert FICTIEVE voorbeeldspelers, -trainingen en -wedstrijden voor de startdata in app.js.
// Deterministisch (vaste seed): dezelfde invoer geeft altijd dezelfde uitvoer, zodat startdata.test.js kan
// controleren dat de startdata in app.js exact uit deze generator komt en dus geen echte personen bevat.
// Gebruik: node tools/maak-fictieve-startdata.js --schrijf   (vervangt regel 2 van app.js; overige onderdelen blijven gelijk)
const VOORNAMEN=['Aart','Bas','Coen','Dirk','Eelco','Freek','Gijs','Hidde','Ids','Joost','Kick','Lucas','Merijn','Niels','Olaf','Pim','Rogier','Sjoerd'];
const ACHTERNAMEN=['Voorbeeldt','Proefmans','Testerink','Fictiefsma','Demmink','Oefenaar','Nepveu','Schijnman','Proevers','Probeersma','Modelaar','Monsterman','Vertoonen','Steekhout','Schetsema','Ontwerpers','Conceptor','Sjablonius'];
const POSITIES=['Keeper','Rechtsback','Centrale verdediger','Centrale verdediger','Linksback','Controlerende middenvelder','Middenvelder','Aanvallende middenvelder','Rechtsbuiten','Spits','Linksbuiten','Keeper','Centrale verdediger','Middenvelder','Middenvelder','Spits','Linksback','Rechtsbuiten'];
const STATUS=[['Aanwezig',74],['Afwezig (school/werk)',8],['Afwezig (vakantie)',5],['Afwezig (blessure)',4],['Afwezig (ziek)',3],['Afwezig (geen bericht)',3],['Aanwezig (herstellend)',2],['Afwezig',1]];
const OPPONENTS=['VV Voorbeeldstad O23','SV Proefpolder O23','FC Fictiefdorp O23','RKSV Demo O23','VV Testkwartier O23'];
const FOCUS=['Opbouw van achteruit','Hoog drukzetten','Omschakeling','Afwerken','Positiespel','Wedstrijdvorm'];
const LINEUP_KEYS=['GK','RB','RCB','LCB','LB','DM','LCM','RCM','RW','ST','LW'];
const TEAM='team-full-speed-o23';
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function pick(r,weighted){const total=weighted.reduce((a,[,w])=>a+w,0);let x=r()*total;for(const [v,w] of weighted){if((x-=w)<0)return v}return weighted[0][0]}
const iso=(y,m,d)=>new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10);
function genereer(exerciseIds=[]){
  const r=rng(20261108);
  const players=VOORNAMEN.map((first,i)=>({id:`p-fictief-${String(i+1).padStart(2,'0')}`,firstName:first,lastName:ACHTERNAMEN[i],name:`${first} ${ACHTERNAMEN[i]}`,
    position:POSITIES[i],number:String(i+1),selection:i<14?'Definitief':i<16?'Twijfel':'Overig',notes:'',primaryTeamId:TEAM,teamIds:[TEAM],alternatePositions:[],preferredFoot:'',
    birthDate:'',startDate:i===16?'2026-09-15':i===17?'2026-10-01':'',active:true,developmentGoals:'',scores:{technical:0,tactical:0,physical:0,mental:0,attitude:0},conversations:[]}));
  const att=date=>Object.fromEntries(players.filter(p=>!p.startDate||date>=p.startDate).map(p=>[p.id,pick(r,STATUS)]));
  const trainings=[];
  for(let w=0;w<13;w++)for(const off of [0,2]){
    const date=iso(2026,8,18+w*7+off),i=trainings.length,future=date>'2026-11-07';
    const plan=exerciseIds.length?[0,1,2].map(k=>({id:`pi-tr-fictief-${i}-${k}`,exerciseId:exerciseIds[(i+k)%exerciseIds.length],duration:[15,20,25][k],coachPoints:[],notes:''})):[];
    trainings.push({id:`tr-fictief-${String(i+1).padStart(2,'0')}`,date,title:'Training',startTime:'20:00',focus:FOCUS[i%FOCUS.length],notes:'',exerciseIds:plan.map(p=>p.exerciseId),
      attendance:future?{}:att(date),teamId:TEAM,squadPlayerIds:null,intensity:'Middel',load:'',planItems:plan,coachNotes:'',cancelled:i===9});
  }
  const matches=[[2026,9,5],[2026,9,19],[2026,10,3],[2026,10,17],[2026,11,14]].map(([y,m,d],i)=>{
    const date=iso(y,m,d),past=date<'2026-11-07',lineup={},stats={};
    const avail=players.filter((p,k)=>k!==((i*3)%players.length));
    LINEUP_KEYS.forEach((k,j)=>{lineup[k]=past?avail[j].id:''});
    const bench=past?avail.slice(11,16).map(p=>p.id):[];
    if(past)[...Object.values(lineup),...bench].forEach((id,j)=>{stats[id]={minutes:j<11?90:Math.round(r()*30),goals:r()<0.1?1:0,assists:r()<0.1?1:0,yellow:r()<0.05?1:0,red:0,started:j<11,coachRating:0}});
    return {id:`m-fictief-${i+1}`,date,opponent:OPPONENTS[i],homeAway:i%2?'Uit':'Thuis',startTime:'14:30',formation:'4-3-3',notes:'',attendance:past?att(date):{},lineup,teamId:TEAM,squadPlayerIds:null,
      benchIds:bench,playerStats:stats,goalsFor:past?String(Math.floor(r()*4)):'',goalsAgainst:past?String(Math.floor(r()*3)):'',competition:'Competitie',venue:'',
      plan:{teamGoal:'',pressing:'',buildUp:'',setPieces:'',individual:''},evaluation:{good:'',improve:'',nextTraining:''},checklist:{},
      availability:past?{}:{[players[3].id]:{status:'Geblesseerd',reason:'Fictief voorbeeld'}}};
  });
  return {players,trainings,matches,meta:{createdAt:'2026-11-08T12:00:00+01:00',updatedAt:'2026-11-08T12:00:00+01:00',fictional:true,source:'Fictieve voorbeelddata (tools/maak-fictieve-startdata.js) — geen echte personen'}};
}
module.exports={genereer,VOORNAMEN,ACHTERNAMEN};
if(require.main===module&&process.argv.includes('--schrijf')){
  const fs=require('fs'),path=require('path'),p=path.join(__dirname,'..','app.js'),lines=fs.readFileSync(p,'utf8').split('\n');
  if(!lines[1].startsWith('window.STARTER_DATA='))throw new Error('Regel 2 van app.js is niet de startdata');
  const cur=JSON.parse(lines[1].replace(/^window\.STARTER_DATA=/,'').replace(/;\s*$/,''));
  const g=genereer((cur.exercises||[]).map(e=>e.id));
  const next={...cur,meta:g.meta,players:g.players,trainings:g.trainings,matches:g.matches,coachNotes:[],documents:[],seasonItems:[]};
  lines[1]='window.STARTER_DATA='+JSON.stringify(next)+';';
  let out=lines.join('\n');
  // Zoekvoorbeeld bevatte een voornaam uit de echte selectie; idempotent vervangen.
  out=out.replace('placeholder="Bijv. Sem, PMRS, pressing','placeholder="Bijv. spelernaam, PMRS, pressing');
  fs.writeFileSync(p,out);
  console.log(`Startdata vervangen: ${g.players.length} fictieve spelers, ${g.trainings.length} trainingen, ${g.matches.length} wedstrijden`);
}
