const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {createApp}=require('./harness');
const bytes=s=>new Blob([s],{type:'application/pdf'});
const fakeLib=(pages,{fail}={})=>{const calls=[];return {calls,GlobalWorkerOptions:{},getDocument(o){calls.push(o);return {promise:fail?Promise.reject(new Error(fail)):Promise.resolve({numPages:pages.length,getPage:async i=>({getTextContent:async()=>({items:pages[i-1].map(str=>({str}))})})})}}}};
function setup(lib){const a=createApp();a.sandbox.pdfjsLib=lib;a.sandbox.window.pdfjsLib=lib;return a}

test('VC2-pad (extractPdfText) opent PDF met isEvalSupported:false en enableXfa:false',async()=>{
  const lib=fakeLib([['Hallo','wereld']]),a=setup(lib);
  const pages=await a.t.extractPdfText(bytes('%PDF-1.4'));
  assert.equal(JSON.stringify(pages).includes('Hallo'),true);
  assert.equal(lib.calls.length,1);assert.equal(lib.calls[0].isEvalSupported,false);assert.equal(lib.calls[0].enableXfa,false);
  assert.equal(lib.GlobalWorkerOptions.workerSrc,a.t.PDFJS_WORKER);
});

test('Bronnen-pad (readDocumentFile) opent PDF met dezelfde beveiligde opties',async()=>{
  const lib=fakeLib([['Pagina','een'],['twee']]),a=setup(lib);
  const f=new Blob(['%PDF-1.4']);f.name='Plan.PDF';
  const txt=await a.t.readDocumentFile(f);
  assert.match(txt,/# Pagina 1/);assert.match(txt,/twee/);
  assert.equal(lib.calls[0].isEvalSupported,false);assert.equal(lib.calls[0].enableXfa,false);
});

test('opties kunnen niet door de aanroeper worden overschreven en data blijft bytes',async()=>{
  const lib=fakeLib([[]]),a=setup(lib);await a.t.pdfjsOpen(lib,new Uint8Array([1,2]));
  assert.equal(lib.calls[0].data.length,2);assert.equal(lib.calls[0].isEvalSupported,false);
});

test('beschadigde PDF: fout bubbelt op en wijzigt geen index',async()=>{
  const a=setup(fakeLib([],{fail:'Invalid PDF structure'}));
  await assert.rejects(()=>a.t.extractPdfText(bytes('kapot')),/Invalid PDF/);
  const f=new Blob(['x']);f.name='kapot.pdf';await assert.rejects(()=>a.t.readDocumentFile(f),/Invalid PDF/);
});

test('verdachte PDF-inhoud (JS, eval-fontpad, HTML) wordt alleen als tekst teruggegeven',async()=>{
  const evil='<script>alert(1)</script>';const lib=fakeLib([[evil,"/FontMatrix [1 2 3] /JS (app.alert(1))"]]),a=setup(lib);
  globalThis.__pwned=false;
  const pages=await a.t.extractPdfText(bytes('%PDF-1.4 /OpenAction /JS'));
  assert.equal(globalThis.__pwned,false);assert.ok(JSON.stringify(pages).includes('alert(1)'));
  assert.equal(lib.calls[0].isEvalSupported,false);
});

test('offline: bibliotheek niet geladen geeft duidelijke fout, geen crash',async()=>{
  const a=createApp();a.sandbox.window.pdfjsLib=undefined;
  a.sandbox.document.scripts=[];
  const hd={appendChild:s=>{setImmediate(()=>s.onerror())}};a.sandbox.document.head=hd;
  a.sandbox.document.createElement=()=>({remove(){}});
  await assert.rejects(()=>a.t.extractPdfText(bytes('%PDF')),/Bibliotheek laden mislukt/);
});

test('VC2-indexering: PDF wordt via extractPdfText geïndexeerd, tekstbestand niet',async()=>{
  const a=setup(fakeLib([['x']]));
  const pages=await a.t.vc2ExtractText(bytes('%PDF'),'a.pdf');assert.equal(JSON.stringify(pages).includes('x'),true);
  const t=await a.t.vc2ExtractText(new Blob(['  a   b \n c ']),'n.txt');assert.equal(t[0],'a b c');
  const viaName=await a.t.vc2ExtractText(new Blob(['%PDF'],{type:''}),'B.PDF');assert.equal(viaName.length,1);
});

test('bestaande tekstimport en CDN-pins blijven werken',async()=>{
  const a=createApp();const f=new Blob(['a,b']);f.name='x.csv';assert.equal(await a.t.readDocumentFile(f),'a,b');
  assert.match(a.t.PDFJS_URL,/pdfjs-dist@\d+\.\d+\.\d+\//);assert.match(a.t.PDFJS_WORKER,/pdfjs-dist@\d+\.\d+\.\d+\//);
  assert.equal(a.t.PDFJS_URL.split('@')[1].split('/')[0],a.t.PDFJS_WORKER.split('@')[1].split('/')[0]);
});

test('statisch: elke getDocument-aanroep loopt via pdfjsOpen (geen onbeveiligde parser)',()=>{
  const s=fs.readFileSync('app.js','utf8');
  assert.equal((s.match(/\.getDocument\(/g)||[]).length,1);
  assert.match(s,/function pdfjsOpen\(lib,data\)\{return lib\.getDocument\(Object\.assign\(\{data\},PDFJS_OPTS\)\)/);
  assert.match(s,/PDFJS_OPTS=\{isEvalSupported:false/);
});

test('regressie: fcLoadScript bestaat in de hoofdapp (niet alleen in het wedstrijdblad-sjabloon)',()=>{
  const a=createApp();assert.equal(typeof a.t.fcLoadScript,'function');
});
