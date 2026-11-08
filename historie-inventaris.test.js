// Test van tools/historie-inventaris.js op een tijdelijke, synthetische git-repository (geen echte namen).
const test=require('node:test'),assert=require('node:assert');
const {execFileSync,spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const TOOL=path.join(__dirname,'tools','historie-inventaris.js');
const run=(cwd,...a)=>spawnSync(process.execPath,[TOOL,...a],{cwd,encoding:'utf8'});
function repoMetHistorie(){
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'coach-hist-')),g=(...a)=>execFileSync('git',['-C',d,...a],{encoding:'utf8'});
  g('init','-q');g('config','user.email','t@t');g('config','user.name','t');
  const echt={version:2,meta:{source:'test'},players:[{id:'p-anna-testpersoon',name:'Anna Testpersoon'},{id:'p-bram-proefkonijn',name:'Bram Proefkonijn'}],trainings:[{id:'t1',attendance:{'p-anna-testpersoon':'Afwezig (ziek)'}}]};
  fs.writeFileSync(path.join(d,'app.js'),`/* v1 */\nwindow.STARTER_DATA=${JSON.stringify(echt)};\nconsole.log(1)\n`);g('add','.');g('commit','-qm','eerste');
  fs.writeFileSync(path.join(d,'starter-data.json'),JSON.stringify(echt,null,2));g('add','.');g('commit','-qm','tweede');
  fs.rmSync(path.join(d,'starter-data.json'));
  fs.writeFileSync(path.join(d,'app.js'),`/* v2 */\nwindow.STARTER_DATA=${JSON.stringify({version:2,meta:{fictional:true},players:[{id:'p-fictief-01',name:'Aart Voorbeeldt'}]})};\n`);g('add','-A');g('commit','-qm','fictief');
  return d;
}
test('inventaris vindt echte (niet-fictieve) spelers in alle commits en bestanden, zonder namen te tonen',()=>{
  const d=repoMetHistorie(),r=run(d,'inventaris');
  assert.strictEqual(r.status,0,r.stderr);
  assert.match(r.stdout,/Unieke \(niet-fictieve\) spelers in de historie: 2/);
  assert.match(r.stdout,/Commits met spelersgegevens: 2/);
  assert.match(r.stdout,/starter-data\.json: 1/);
  assert.ok(!/Anna|Bram|Aart/.test(r.stdout),'geen namen in de uitvoer');
});
test('vervangbestand wordt alleen buiten de repository geschreven en spaart fictieve startdata',()=>{
  const d=repoMetHistorie();
  assert.notStrictEqual(run(d,'vervangbestand','--uit',path.join(d,'v.txt')).status,0,'weigert binnen de repo');
  const uit=path.join(os.tmpdir(),`vervang-${process.pid}.txt`);
  assert.strictEqual(run(d,'vervangbestand','--uit',uit).status,0);
  const txt=fs.readFileSync(uit,'utf8');
  assert.ok(txt.includes('Anna Testpersoon==>Verwijderde speler')&&txt.includes('p-bram-proefkonijn==>p-verwijderd-'));
  const rule=txt.split('\n').find(l=>l.startsWith('regex:')).slice(6).split('==>')[0];
  const re=new RegExp(rule.replace('(?![^\\n]{0,200}','(?![^\\n]{0,200}'));
  assert.ok(re.test('window.STARTER_DATA={"version":2,"meta":{"source":"x"},"players":[]};'),'echte startdata wordt vervangen');
  assert.ok(!re.test('window.STARTER_DATA={"version":2,"meta":{"createdAt":"x","fictional":true},"players":[]};'),'fictieve startdata blijft');
  const c=run(d,'controle','--namen',uit);
  assert.strictEqual(c.status,1,'historie is nog niet schoon');assert.match(c.stdout,/NIET SCHOON/);
  fs.rmSync(uit);
});
test('controle meldt SCHOON als geen naam meer voorkomt',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'coach-schoon-')),g=(...a)=>execFileSync('git',['-C',d,...a]);
  g('init','-q');g('config','user.email','t@t');g('config','user.name','t');
  fs.writeFileSync(path.join(d,'app.js'),'console.log(1)\n');g('add','.');g('commit','-qm','x');
  const namen=path.join(os.tmpdir(),`namen-${process.pid}.txt`);fs.writeFileSync(namen,'Anna Testpersoon==>Verwijderde speler 01\n');
  const r=run(d,'controle','--namen',namen);
  assert.strictEqual(r.status,0);assert.match(r.stdout,/SCHOON/);fs.rmSync(namen);
});
