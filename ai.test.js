// Regressietests 2.10: coachassistent — regelgebaseerd standaard, alleen lokale AI, geen persoonsgegevens (R9, ADR 0008).
const test=require('node:test'),assert=require('node:assert');
const {createApp}=require('./harness.js');

function withPrompt(a,q){a.domMap['#assistantPrompt']={value:q};return a}
function spyFetch(a,reply){const calls=[];a.sandbox.fetch=async(url,opt={})=>{calls.push({url,body:opt.body,opt});return {ok:true,status:200,json:async()=>reply}};return calls}
const wordRe=s=>new RegExp(`(^|[^\\p{L}\\p{N}])${s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^\\p{L}\\p{N}])`,'iu');

test('alleen lokale endpoints worden geaccepteerd',()=>{
  const {aiEndpointInfo:f}=createApp().t;
  for(const ok of ['http://localhost:11434/api/chat','http://127.0.0.1:8080/x','http://[::1]:11434/api/chat','http://192.168.1.20:11434/api/chat','http://10.0.0.5/ai','http://172.20.1.1/ai','http://coach-pc.local:11434/api/chat'])assert.ok(f(ok).ok,ok);
  for(const bad of ['https://api.openai.com/v1/chat/completions','https://ckodnfshelblddfypmmv.supabase.co/functions/v1/ai','http://172.32.0.1/ai','http://8.8.8.8/ai','javascript:alert(1)','http://user:pw@localhost/x','geen url','http://localhost.evil.com/x'])assert.ok(!f(bad).ok,bad);
  assert.strictEqual(f('http://localhost:11434/api/chat').kind,'ollama');
  assert.strictEqual(f('http://localhost:3000/coach').kind,'json');
});

test('zonder endpoint: regelgebaseerd antwoord met bronvermelding en zonder netwerkverkeer',async()=>{
  const a=withPrompt(createApp(),'Welke spelers hebben de laagste trainingsopkomst?'),calls=spyFetch(a,{});
  await a.t.runAssistant();
  assert.strictEqual(calls.length,0);
  assert.ok(/^Bron: regelgebaseerde coachassistent/.test(a.t.ui.assistantAnswer));
});

test('extern endpoint (eerder opgeslagen) wordt bewaard maar nooit aangeroepen',async()=>{
  const a=withPrompt(createApp(),'opkomst'),calls=spyFetch(a,{answer:'x'});
  a.t.state.ai.endpoint='https://voorbeeld-ai.example.com/coach';
  await a.t.runAssistant();
  assert.strictEqual(calls.length,0);
  assert.strictEqual(a.t.state.ai.endpoint,'https://voorbeeld-ai.example.com/coach');
  assert.ok(/niet gebruikt/.test(a.t.ui.assistantAnswer));
});

// Patch 4: verzenden gaat via een preview-venster met eigen knop (modal) in plaats van confirm().
function captureModal(a){const m={};a.t.setModal((title,body,save,opts={})=>{Object.assign(m,{title,body,opts})});return m}
test('lokaal endpoint: zonder klik op “Versturen” in de preview wordt niets verstuurd',async()=>{
  const a=withPrompt(createApp(),'opkomst'),calls=spyFetch(a,{answer:'x'}),m=captureModal(a);
  a.t.state.ai.endpoint='http://localhost:3000/coach';
  await a.t.runAssistant();
  assert.strictEqual(calls.length,0);assert.ok(m.title&&/Controleer/.test(m.title));
  assert.ok(/Niets verstuurd/.test(a.t.ui.assistantAnswer));
});

test('lokaal Ollama-endpoint: verzonden gegevens bevatten geen namen, id\'s, geboortedata of e-mail; antwoord krijgt namen lokaal terug',async()=>{
  const a=createApp(),s=a.t.state,team=s.teams[0];
  const ps=s.players.filter(p=>p.primaryTeamId===team.id&&p.active!==false);
  ps[0].birthDate='2003-04-05';ps[0].email='speler@voorbeeld.nl';ps[0].availabilityNote='Hamstringblessure links';
  ps[0].developmentGoals=`${ps[0].firstName} moet beter scannen; mail ${ps[0].email}`;
  s.coachNotes.push({id:'n1',teamId:team.id,category:'Training',text:`${ps[1].name} was sterk in de rondo`,date:'2026-10-01'});
  s.coachNotes.push({id:'n2',teamId:team.id,category:'Gesprek',text:'Vertrouwelijk gesprek',date:'2026-10-01'});
  s.ai.endpoint='http://localhost:11434/api/chat';s.ai.model='lokaal-model';
  withPrompt(a,`Hoe ontwikkelt ${ps[0].name} zich?`);
  const calls=spyFetch(a,{message:{role:'assistant',content:'S1 kan meer scannen.'}}),m=captureModal(a);
  await a.t.runAssistant();
  assert.strictEqual(calls.length,0,'nog niets verstuurd vóór bevestiging');
  await m.opts.onSave();
  assert.strictEqual(calls.length,1);
  const body=calls[0].body,sent=JSON.parse(body);
  assert.strictEqual(sent.model,'lokaal-model');assert.strictEqual(sent.stream,false);
  for(const p of s.players){for(const n of [p.name,p.firstName,p.lastName].filter(x=>x&&x.length>=3))assert.ok(!wordRe(n).test(body),`naam gelekt: ${n}`);assert.ok(!body.includes(p.id),`id gelekt: ${p.id}`)}
  assert.ok(!body.includes('2003-04-05')&&!body.includes('speler@voorbeeld.nl')&&!/Hamstring/i.test(body)&&!body.includes('Vertrouwelijk'));
  assert.ok(body.includes('S1'));
  assert.strictEqual(calls[0].opt.credentials,'omit');
  assert.ok(a.t.ui.assistantAnswer.includes(`${a.t.playerFullName(a.t.playersForTeam(team.id)[0])} (S1)`));
  assert.ok(/^Bron: lokaal AI-model via localhost:11434/.test(a.t.ui.assistantAnswer));
});

test('Ollama zonder modelnaam of onbereikbaar: terugval op regelgebaseerd',async()=>{
  const a=withPrompt(createApp(),'opkomst');a.t.state.ai.endpoint='http://localhost:11434/api/chat';
  spyFetch(a,{});const m=captureModal(a);await a.t.runAssistant();
  assert.ok(/modelnaam|naam van het lokale model/i.test(a.t.ui.assistantAnswer));
  a.t.state.ai.model='m';a.sandbox.fetch=async()=>{throw new Error('Failed to fetch')};
  await a.t.runAssistant();await m.opts.onSave();
  assert.ok(/niet bereikbaar/.test(a.t.ui.assistantAnswer)&&/regelgebaseerde/.test(a.t.ui.assistantAnswer));
});

test('aiScrub: namen (ook hoofdletterongevoelig en met accenten), e-mail en 06-nummers worden vervangen',()=>{
  const a=createApp(),tok=a.t.aiNameTokens([{firstName:'Joël',lastName:'van Dijk',name:'Joël van Dijk'}]);
  const out=a.t.aiScrub('joël VAN DIJK belde 06-12345678, mail joel@x.nl. Dijkstra blijft.',tok);
  assert.ok(!/joël|van dijk/i.test(out));assert.ok(out.includes('S1'));
  assert.ok(out.includes('[telefoon]')&&out.includes('[e-mail]'));
  assert.ok(out.includes('Dijkstra'),'geen deelwoordvervanging');
});

test('instellingen: extern AI-endpoint wordt geweigerd, lokaal endpoint en model worden opgeslagen',()=>{
  const a=createApp(),btn={hasAttribute:k=>k==='data-save-settings',dataset:{}},ev={target:{closest:()=>btn}};
  Object.assign(a.domMap,{'#setAiEndpoint':{value:'https://ai.example.com/x'},'#setAiModel':{value:'m1'},'#setClub':{value:'Club'},'#setSeason':{value:'2026/2027'},'#setTime':{value:'20:00'},'#setPeriodization':{value:''}});
  a.t.handleClick(ev);
  assert.strictEqual(a.t.state.ai.endpoint||'','');
  assert.ok(a.toasts.some(m=>/niet opgeslagen/.test(m)));
  a.domMap['#setAiEndpoint']={value:'http://localhost:11434/api/chat'};
  a.t.handleClick(ev);
  assert.strictEqual(a.t.state.ai.endpoint,'http://localhost:11434/api/chat');assert.strictEqual(a.t.state.ai.model,'m1');
});

test('instellingenpagina toont lokaal-endpointveld en modelveld; kennisbankpagina toont beveiligingswaarschuwing',()=>{
  const a=createApp();
  const html=a.t.renderSettings();
  assert.ok(html.includes('id="setAiModel"')&&html.includes('Alleen lokaal'));
  assert.ok(/Beveiligingswaarschuwing/.test(a.t.renderKnowledge())&&/overschrijven/.test(a.t.renderKnowledge()));
});
