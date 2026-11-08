#!/usr/bin/env node
// Hulpmiddel bij docs/GIT_GESCHIEDENIS_OPSCHONEN.md. Draait LOKAAL op een kloon; wijzigt de repository niet.
// Bevat zelf geen namen: de spelersnamen worden uit de historie zelf gehaald (STARTER_DATA in app.js, starter-data.*).
//
//   node tools/historie-inventaris.js inventaris  [--repo PAD]
//   node tools/historie-inventaris.js vervangbestand --uit ../vervangingen.txt [--repo PAD]
//   node tools/historie-inventaris.js controle --namen ../vervangingen.txt [--repo PAD]
//   node tools/historie-inventaris.js site --url https://<gebruiker>.github.io/Coach/ --namen ../vervangingen.txt
//
// Namen worden nooit naar de terminal geschreven (alleen aantallen), tenzij --toon wordt meegegeven.
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const args=process.argv.slice(2),mode=args[0],opt=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null},flag=k=>args.includes(k);
const repo=path.resolve(opt('--repo')||'.');
const git=(...a)=>execFileSync('git',['-C',repo,...a],{encoding:'utf8',maxBuffer:1<<28});
const blobCache=new Map();
function blob(sha){if(!blobCache.has(sha))blobCache.set(sha,execFileSync('git',['-C',repo,'cat-file','-p',sha],{maxBuffer:1<<28}).toString('latin1'));return blobCache.get(sha)}
function commits(){return git('rev-list','--all').trim().split('\n').filter(Boolean)}
function tree(c){return git('ls-tree','-r',c).trim().split('\n').filter(Boolean).map(l=>{const [meta,p]=l.split('\t');const [,type,sha]=meta.split(' ');return {type,sha,path:p}}).filter(x=>x.type==='blob')}
const TEXT=/\.(js|json|html|md|csv|txt|css|ya?ml|sql|sh)$/i;
function starterJson(text){
  const out=[];const m=text.match(/STARTER_DATA\s*=\s*(\{[\s\S]*?\})\s*;?\s*(\n|$)/);if(m)out.push(m[1]);
  const t=text.trim();if(t.startsWith('{')&&t.includes('"players"'))out.push(t);
  return out.map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(Boolean);
}
function collectPeople(){
  const people=new Map();
  for(const c of commits())for(const f of tree(c)){
    if(!/(^|\/)(app\.js|starter-data\.(js|json))$/.test(f.path))continue;
    for(const d of starterJson(blob(f.sha)))(d.players||[]).forEach(p=>{if(p&&p.name&&!(d.meta&&d.meta.fictional))people.set(p.name,p.id||'')});
  }
  return people;
}
function readNames(file){
  const lines=fs.readFileSync(file,'utf8').split('\n').filter(l=>l&&!l.startsWith('regex:')&&!l.startsWith('#')&&l.includes('==>'));
  return lines.map(l=>l.split('==>')[0]).filter(Boolean);
}
function scan(names){
  const res=names.map(n=>new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  const perPath={},hitCommits=new Set(),all=commits();
  for(const c of all)for(const f of tree(c)){if(!TEXT.test(f.path))continue;const s=blob(f.sha);if(res.some(r=>r.test(s))){perPath[f.path]=(perPath[f.path]||0)+1;hitCommits.add(c)}}
  return {total:all.length,hit:hitCommits.size,perPath};
}
function report(r){console.log(`Commits (alle refs): ${r.total}`);console.log(`Commits met spelersgegevens: ${r.hit}`);console.log('Bestanden (aantal commits waarin het bestand namen bevat):');Object.entries(r.perPath).forEach(([p,n])=>console.log(`  ${p}: ${n}`))}

if(mode==='inventaris'){
  const people=collectPeople();
  console.log(`Unieke (niet-fictieve) spelers in de historie: ${people.size}`);if(flag('--toon'))console.log([...people.keys()].join('\n'));
  report(scan([...people.keys(),...[...people.values()].filter(Boolean)]));
}else if(mode==='vervangbestand'){
  const uit=opt('--uit');if(!uit)throw new Error('--uit ontbreekt');
  const abs=path.resolve(uit);if(abs.startsWith(repo+path.sep))throw new Error('Schrijf het vervangbestand BUITEN de repository (het bevat de namen).');
  const people=[...collectPeople()];
  const lines=['# Vervangingen voor git filter-repo --replace-text. Bevat echte namen: niet delen, na afloop verwijderen.',
    'regex:window\\.STARTER_DATA\\s*=\\s*\\{(?![^\\n]{0,200}"fictional":true).*\\};?==>window.STARTER_DATA={"version":2,"meta":{"fictional":true,"note":"uit historie verwijderd"},"players":[],"trainings":[],"matches":[]};'];
  people.forEach(([name,id],i)=>{const n=String(i+1).padStart(2,'0');lines.push(`${name}==>Verwijderde speler ${n}`);if(id)lines.push(`${id}==>p-verwijderd-${n}`)});
  fs.writeFileSync(abs,lines.join('\n')+'\n',{mode:0o600});
  console.log(`Vervangbestand geschreven: ${abs} (${people.length} spelers, ${lines.length-1} regels)`);
}else if(mode==='controle'){
  const file=opt('--namen');if(!file)throw new Error('--namen <vervangbestand> ontbreekt');
  const r=scan(readNames(file));report(r);
  if(r.hit){console.log('NIET SCHOON: er staan nog spelersgegevens in de historie.');process.exit(1)}
  console.log('SCHOON: geen van de namen of spelers-id\'s komt nog voor in enige commit.');
}else if(mode==='site'){
  const url=opt('--url'),file=opt('--namen');if(!url||!file)throw new Error('--url en --namen zijn verplicht');
  (async()=>{const base=url.replace(/\/?$/,'/');const html=await (await fetch(base+'index.html',{cache:'no-store'})).text();
    const src=(html.match(/src="(app\.js[^"]*)"/)||[])[1]||'app.js';const js=await (await fetch(base+src,{cache:'no-store'})).text();
    const names=readNames(file),hits=names.filter(n=>js.toLowerCase().includes(n.toLowerCase())).length;
    const fictional=/"fictional":true/.test(js.split('\n')[1]||'');
    console.log(`Gepubliceerde ${src}: ${hits} namen gevonden; startdata fictief: ${fictional?'ja':'nee'}`);process.exit(hits||!fictional?1:0)})().catch(e=>{console.error(e.message);process.exit(2)});
}else{
  console.log('Gebruik: inventaris | vervangbestand --uit PAD | controle --namen PAD | site --url URL --namen PAD   [--repo PAD] [--toon]');process.exit(mode?1:0);
}
