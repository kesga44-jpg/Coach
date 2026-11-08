// Patch 4 — gezondheidsinformatie filteren, exacte preview, bij twijfel niet verzenden.
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');
function setup({prompt='Wat moet terugkomen in de volgende training?',model='lokaal-model'}={}){
  const a=createApp(),s=a.t.state;
  s.ai.endpoint='http://localhost:11434/api/chat';s.ai.model=model;
  a.domMap['#assistantPrompt']={value:prompt};
  const calls=[];a.sandbox.fetch=async(url,opt={})=>{calls.push({url,body:opt.body});return {ok:true,status:200,json:async()=>({message:{content:'Advies voor S1.'}})}};
  const m={};a.t.setModal((title,body,save,opts={})=>{Object.assign(m,{title,body,opts})});
  return {a,s,calls,m,team:s.teams[0],players:a.t.playersForTeam(s.teams[0].id)};
}
const unesc=h=>h.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

test('herkent blessure-, medische en gezondheidstermen (ook samenstellingen), niet gewone voetbaltaal',()=>{
  const h=createApp().sandbox.aiHealthHit;
  for(const t of ['kuitblessure links','is geblesseerd','liesklacht','hamstring','ging naar de fysio','hersenschudding','is geopereerd aan de knie','Afwezig (ziek)','had koorts','last van astma','burn-out','zit bij de psycholoog','heeft veel pijn','kwam bij de huisarts','concussion protocol','hartklachten','zwanger','Aanwezig (herstellend)','medische keuring'])assert.ok(h(t),t);
  for(const t of ['hoog drukzetten na balverlies','Herstel / MD+1 met lage intensiteit','rondo 4v2','omschakelen en afwerken','sterk in de duels','verdedigen in blok','5 W’s','arts­enij'.replace('­','')])assert.strictEqual(h(t),'',t);
});

test('vrije tekst met gezondheidsinformatie wordt in zijn geheel weggelaten; overige inhoud blijft',async()=>{
  const {a,s,calls,m,team,players}=setup();
  players[0].developmentGoals='Na zijn enkelblessure rustig opbouwen';
  players[1].developmentGoals='Beter scannen voor balontvangst';
  const past=s.matches.filter(x=>x.teamId===team.id&&x.date<='2026-11-07')[0];
  past.evaluation={good:'Goed drukgezet',improve:'Twee spelers misten de wedstrijd door griep',nextTraining:'Omschakeling'};
  s.coachNotes.push({id:'n1',teamId:team.id,category:'Training',date:'2026-11-01',text:'Kreeg een knietje, moest naar de dokter'});
  s.coachNotes.push({id:'n2',teamId:team.id,category:'Tactiek',date:'2026-11-02',text:'Linie dichter bij elkaar'});
  await a.t.runAssistant();
  assert.ok(m.opts&&m.opts.onSave,'preview geopend');
  assert.ok(/tekstveld\(en\) weggelaten/.test(m.body)&&/enkelblessure|griep|dokter/.test(m.body),'preview noemt weggelaten velden');
  await m.opts.onSave();
  assert.strictEqual(calls.length,1);
  const body=calls[0].body;
  assert.ok(!/enkelblessure|griep|dokter/i.test(body),'geen gezondheidsinfo verstuurd');
  assert.ok(body.includes('Beter scannen voor balontvangst')&&body.includes('Goed drukgezet')&&body.includes('Linie dichter bij elkaar'),'gewone inhoud blijft');
  assert.ok(body.includes('[weggelaten: mogelijk gezondheidsinformatie]'));
});

test('vraag met gezondheidsinformatie wordt niet verstuurd en er opent geen preview',async()=>{
  const {a,calls,m}=setup({prompt:'Hoe vang ik de hamstringblessure van mijn spits op?'});
  await a.t.runAssistant();
  assert.strictEqual(calls.length,0);assert.ok(!m.opts);
  assert.ok(/niets verstuurd/.test(a.t.ui.assistantAnswer)&&/hamstring/.test(a.t.ui.assistantAnswer));
});

test('preview toont exact de tekst die wordt verstuurd (byte-voor-byte)',async()=>{
  const {a,calls,m}=setup();
  await a.t.runAssistant();
  const shown=unesc(m.body.match(/<pre[^>]*id="aiPreviewBody"[^>]*>([\s\S]*?)<\/pre>/)[1]);
  await m.opts.onSave();
  assert.strictEqual(calls[0].body,shown);
  assert.ok(m.body.includes(`${shown.length} tekens`));
  assert.ok(/Versturen naar localhost:11434/.test(m.opts.saveText));
});

test('bij twijfel niet verzenden: naam, e-mail of spelers-id die door de filters glipt blokkeert alles',async()=>{
  for(const leak of [p=>p.lastName,()=>'info@club.nl',p=>p.id]){
    const {a,s,calls,m,team,players}=setup();
    const next=s.matches.filter(x=>x.teamId===team.id&&x.date>='2026-11-08').concat(s.matches.filter(x=>x.teamId===team.id))[0];
    next.opponent='VV '+leak(players[2]);              // tegenstander wordt niet gescrubd → laatste controle moet ingrijpen
    if(next.date<'2026-11-08')next.date='2099-01-01';
    await a.t.runAssistant();
    if(m.opts)await m.opts.onSave();
    assert.strictEqual(calls.length,0,'niets verstuurd bij: '+leak(players[2]));
    assert.ok(/niets verstuurd uit voorzorg|Niet verstuurd/i.test(a.t.ui.assistantAnswer),a.t.ui.assistantAnswer.slice(0,120));
  }
});

test('aiFinalCheck negeert de vaste instructieteksten maar vindt gezondheidstermen in gegevens',()=>{
  const a=createApp(),f=a.sandbox.aiFinalCheck;
  assert.strictEqual(f('{"tekst":"hoog drukzetten en omschakelen"}').length,0);
  assert.ok(f('{"tekst":"speelde met een gebroken teen"}').some(x=>/gezondheid/.test(x)));
});
