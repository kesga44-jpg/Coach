/* Kennis & Ontwikkeling · zelfstandige, aanvullende module.
   Eigen opslagsleutel (KD_KEY). Raakt state, state.teams, save(), normalize(), validateStateData(),
   back-ups en de Supabase-synchronisatie bewust NIET aan. Wordt na app.js geladen. */
const KD_KEY='footballCoachKnowledgeV1';
const KD_BACKUP_KEY='footballCoachKnowledgeBackupV1';
const KD_RECORD_TYPE='football_knowledge_update';
const KD_REQUIRED=['schema_version','record_type','title','update_date','team_context','summary','items'];
const KD_ROOT_KNOWN=[...KD_REQUIRED,'weekly_team_advice','next_training_action','no_update_note'];
const KD_MAX_FILE=5*1024*1024;
// Eerste alias die in een item voorkomt wordt gelezen/geschreven; overige velden blijven ongemoeid in item.raw.
const KD_FIELDS={
  title:['title','research_title','study_title','name'],
  source:['source','source_name','citation','reference','journal','url','link','doi'],
  publication_date:['publication_date','published','published_date','date','year'],
  method:['research_method','method','methodology','study_design','design'],
  key_findings:['key_findings','findings','main_findings','results','summary'],
  novelty:['novelty','novelty_of_information','new_information','is_new'],
  evidence_quality:['evidence_quality','quality_of_evidence','evidence_level','evidence'],
  relevance:['relevance_full_speed_o23','relevance_for_full_speed_o23','relevance','full_speed_relevance','relevance_full_speed'],
  practical_translation:['practical_translation','practical_application','field_translation','translation_to_pitch'],
  training_form:['training_form','training_adjustment','training_adaptation','training_application'],
  recommendation:['recommendation','recommendations','advice'],
  tags:['tags','keywords','labels']
};
const KD_FIELD_LABELS={title:'Onderzoekstitel',source:'Bron',publication_date:'Publicatiedatum',method:'Onderzoeksmethode',key_findings:'Belangrijkste bevindingen',novelty:'Nieuwheid van de informatie',evidence_quality:'Bewijskwaliteit',relevance:'Relevantie voor Full Speed O23',practical_translation:'Praktische vertaling naar het veld',training_form:'Trainingsvorm of -aanpassing',recommendation:'Aanbeveling',tags:'Tags'};
const KD_CATEGORIES=['Fysiek & belasting','Techniek & tactiek','Mentaal & motivatie','Blessurepreventie & herstel','Jeugd- & talentontwikkeling','Trainingsmethodiek','Overig'];
const KD_CATEGORY_RULES=[
  ['Blessurepreventie & herstel',/blessure|injur|herstel|recover|prevent|hamstring|nordic|slaap|sleep/],
  ['Fysiek & belasting',/fysiek|physical|conditie|belasting|load|sprint|snelheid|speed|kracht|strength|hiit|fitness|endurance|uithoudings/],
  ['Mentaal & motivatie',/mentaal|mental|psycho|motivatie|motivation|stress|focus|zelfvertrouwen|confidence|cognitiv/],
  ['Jeugd- & talentontwikkeling',/jeugd|youth|talent|ontwikkeling|development|academy|maturation|rae\b/],
  ['Techniek & tactiek',/techniek|technical|tactic|tactiek|passing|pressing|positiespel|possession|spelopbouw|small.sided|rondo|afwerking|finishing/],
  ['Trainingsmethodiek',/methodiek|methodolog|training|periodi|didactiek|coaching|feedback|oefenvorm|session/]
];
const kdIsObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const kdNorm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function kdText(v){
  if(v===null||v===undefined)return '';
  if(typeof v==='string')return v;
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(Array.isArray(v))return v.map(kdText).filter(Boolean).join('\n');
  return Object.entries(v).map(([k,x])=>`${k}: ${kdText(x)}`).join('\n');
}
function kdKey(raw,field){return (KD_FIELDS[field]||[]).find(k=>raw&&raw[k]!==undefined&&raw[k]!==null&&kdText(raw[k]).trim())}
function kdGet(raw,field){const k=kdKey(raw,field);return k?raw[k]:''}
function kdSet(raw,field,value){raw[kdKey(raw,field)||(KD_FIELDS[field]||[])[0]||field]=value}
function kdStable(v){
  if(Array.isArray(v))return `[${v.map(kdStable).join(',')}]`;
  if(kdIsObj(v))return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${kdStable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// Dubbelen: zelfde DOI/URL, of zelfde genormaliseerde titel + bron.
function kdItemKeys(raw){
  const keys=[],title=kdNorm(kdText(kdGet(raw,'title')));
  const idText=['doi','url','link','source','citation','reference'].map(k=>kdText(raw[k])).join(' ');
  const doi=idText.match(/10\.\d{4,9}\/[^\s"'<>]+/i),url=idText.match(/https?:\/\/[^\s"'<>]+/i);
  if(doi)keys.push('doi:'+doi[0].toLowerCase().replace(/[.,;]+$/,''));
  else if(url)keys.push('url:'+url[0].toLowerCase().replace(/^https?:\/\/(www\.)?/,'').replace(/[#?].*$/,'').replace(/\/+$/,''));
  if(title)keys.push('title:'+title+'|'+kdNorm(kdText(kdGet(raw,'source'))));
  return keys;
}
function kdCategorize(raw){
  const own=kdText(raw.category||raw.categorie).trim();
  if(own){const hit=KD_CATEGORIES.find(c=>kdNorm(c)===kdNorm(own));if(hit)return hit}
  const hay=kdNorm([kdText(kdGet(raw,'tags')),kdText(kdGet(raw,'title')),kdText(kdGet(raw,'key_findings'))].join(' '));
  const hit=KD_CATEGORY_RULES.find(([,re])=>re.test(hay));
  return hit?hit[0]:'Overig';
}

/* ---- Opslag ---- */
function kdValidStore(s){return kdIsObj(s)&&Array.isArray(s.items)&&Array.isArray(s.updates)&&s.items.every(kdIsObj)&&s.updates.every(kdIsObj)}
function kdEmpty(){return {version:1,updates:[],items:[]}}
function kdRead(){
  let raw=null;
  try{raw=localStorage.getItem(KD_KEY)}catch(e){return {store:kdEmpty(),raw:null,error:'Lokale opslag niet beschikbaar'}}
  if(raw===null)return {store:kdEmpty(),raw:null,error:null};
  try{const s=JSON.parse(raw);if(!kdValidStore(s))throw new Error('onverwachte structuur');return {store:s,raw,error:null}}
  catch(e){return {store:kdEmpty(),raw,error:'Opgeslagen kennisgegevens zijn onleesbaar ('+e.message+'). Er wordt niets overschreven.'}}
}
// Eén atomaire schrijfactie: werkt op een kopie, schrijft pas na succes; bij fout blijft de oude opslag onaangeroerd.
function kdCommit(mutate){
  const cur=kdRead();
  if(cur.error)return {ok:false,error:cur.error};
  const next=clone(cur.store);
  try{if(mutate(next)===false)return {ok:false,error:'Geen wijziging'}}catch(e){return {ok:false,error:e.message||'Wijziging mislukt'}}
  if(!kdValidStore(next))return {ok:false,error:'Ongeldige kennisgegevens; niets opgeslagen'};
  next.updatedAt=new Date().toISOString();
  try{
    const json=JSON.stringify(next);
    if(cur.raw!==null)localStorage.setItem(KD_BACKUP_KEY,cur.raw);
    localStorage.setItem(KD_KEY,json);
  }catch(e){return {ok:false,error:'Opslaan mislukt: '+(e&&e.name==='QuotaExceededError'?'lokale opslag is vol':(e&&e.message)||'onbekende fout')}}
  return {ok:true,store:next};
}

/* ---- Controle van JSON ---- */
function kdParse(rawText,store){
  const out={ok:false,errors:[],warnings:[],update:null,newItems:[],duplicates:[],duplicateUpdate:false};
  const text=String(rawText??'').trim();
  if(!text){out.errors.push('Geen JSON ingevoerd.');return out}
  let data;
  try{data=JSON.parse(text)}catch(e){out.errors.push('Ongeldige JSON: '+e.message);return out}
  if(!kdIsObj(data)){out.errors.push('De JSON moet een object zijn.');return out}
  const missing=KD_REQUIRED.filter(k=>data[k]===undefined||data[k]===null||(typeof data[k]==='string'&&!data[k].trim()));
  if(missing.length)out.errors.push('Verplichte velden ontbreken: '+missing.join(', '));
  if(data.record_type!==undefined&&data.record_type!==KD_RECORD_TYPE)out.errors.push(`record_type "${kdText(data.record_type)}" wordt niet ondersteund (verwacht: ${KD_RECORD_TYPE}).`);
  if(data.schema_version!==undefined&&!/^1(\.|$)/.test(String(data.schema_version)))out.warnings.push(`schema_version ${kdText(data.schema_version)} is nieuwer/onbekend; alle velden worden bewaard maar niet alle worden herkend.`);
  if(data.update_date!==undefined&&(typeof data.update_date!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(data.update_date)||Number.isNaN(Date.parse(data.update_date.slice(0,10)))))out.errors.push('update_date moet een geldige datum zijn (JJJJ-MM-DD).');
  if(data.items!==undefined&&!Array.isArray(data.items))out.errors.push('items moet een lijst zijn.');
  else if(Array.isArray(data.items)){
    if(!data.items.length&&!kdText(data.no_update_note).trim())out.errors.push('items is leeg en er is geen no_update_note.');
    data.items.forEach((it,i)=>{
      if(!kdIsObj(it))out.errors.push(`Item ${i+1} is geen object.`);
      else if(!kdText(kdGet(it,'title')).trim())out.errors.push(`Item ${i+1} mist een onderzoekstitel.`);
      else if(!kdText(kdGet(it,'source')).trim())out.warnings.push(`Item ${i+1} (${kdText(kdGet(it,'title'))}) heeft geen bron.`);
    });
  }
  if(out.errors.length)return out;
  const {items,...root}=data;
  const fingerprint=kdStable(data);
  out.duplicateUpdate=(store.updates||[]).some(u=>u.fingerprint===fingerprint);
  const known=new Set();(store.items||[]).forEach(it=>kdItemKeys(it.raw).forEach(k=>known.add(k)));
  items.forEach(raw=>{
    const keys=kdItemKeys(raw),dup=keys.some(k=>known.has(k));
    if(dup)out.duplicates.push(raw);
    else{keys.forEach(k=>known.add(k));out.newItems.push({raw:clone(raw),category:kdCategorize(raw)})}
  });
  Object.keys(root).filter(k=>!KD_ROOT_KNOWN.includes(k)).length&&out.warnings.push('Onbekende extra velden worden bewaard: '+Object.keys(root).filter(k=>!KD_ROOT_KNOWN.includes(k)).join(', '));
  out.update={fingerprint,root:clone(root)};
  if(out.duplicateUpdate)out.errors.push('Deze update is al eerder geïmporteerd; er wordt niets dubbel opgeslagen.');
  out.ok=!out.errors.length;
  return out;
}
function kdImport(rawText){
  const cur=kdRead();
  if(cur.error)return {ok:false,errors:[cur.error]};
  const p=kdParse(rawText,cur.store);
  if(!p.ok)return {ok:false,errors:p.errors,duplicates:p.duplicates.length};
  const now=new Date().toISOString(),updateId=uid('kdu'),added=p.newItems.map(n=>({id:uid('kdi'),updateId,category:n.category,raw:n.raw,createdAt:now,updatedAt:now}));
  const r=kdCommit(s=>{s.updates.push({id:updateId,fingerprint:p.update.fingerprint,importedAt:now,root:p.update.root,itemIds:added.map(a=>a.id)});s.items.push(...added)});
  if(!r.ok)return {ok:false,errors:[r.error]};
  return {ok:true,added:added.length,duplicates:p.duplicates.length,updateId};
}

/* ---- Bewerken en verwijderen ---- */
const KD_EDIT_FIELDS=['title','source','publication_date','method','key_findings','novelty','evidence_quality','relevance','practical_translation','training_form','recommendation','tags'];
function kdUpdateItem(id,values){
  const r0=kdRead();if(r0.error)return {ok:false,error:r0.error};
  const cur=r0.store.items.find(i=>i.id===id);if(!cur)return {ok:false,error:'Artikel niet gevonden'};
  const draft=clone(cur.raw);
  KD_EDIT_FIELDS.forEach(f=>{
    if(!(f in values))return;
    const old=kdGet(draft,f),oldText=f==='tags'&&Array.isArray(old)?old.map(kdText).join(', '):kdText(old),val=String(values[f]??'').trim();
    if(val===oldText.trim())return;
    kdSet(draft,f,f==='tags'?val.split(',').map(x=>x.trim()).filter(Boolean):val);
  });
  if(!kdText(kdGet(draft,'title')).trim())return {ok:false,error:'Een titel is verplicht'};
  const mine=new Set(kdItemKeys(draft));
  if(r0.store.items.some(i=>i.id!==id&&kdItemKeys(i.raw).some(k=>mine.has(k))))return {ok:false,error:'Dit artikel bestaat al (zelfde bron of titel)'};
  const category=KD_CATEGORIES.includes(values.category)?values.category:cur.category;
  return kdCommit(s=>{const it=s.items.find(i=>i.id===id);it.raw=draft;it.category=category;it.updatedAt=new Date().toISOString()});
}
function kdDeleteItem(id){
  return kdCommit(s=>{const n=s.items.length;s.items=s.items.filter(i=>i.id!==id);if(s.items.length===n)return false;s.updates.forEach(u=>{u.itemIds=(u.itemIds||[]).filter(x=>x!==id)})});
}
function kdDeleteUpdate(id){
  return kdCommit(s=>{const u=s.updates.find(x=>x.id===id);if(!u)return false;const ids=new Set(u.itemIds||[]);s.items=s.items.filter(i=>!ids.has(i.id));s.updates=s.updates.filter(x=>x.id!==id)});
}
function kdSearch(store,q,category){
  const needle=kdNorm(q);
  return [...store.items].filter(i=>!category||i.category===category).filter(i=>!needle||kdNorm(kdText(i.raw)+' '+i.category).includes(needle))
    .sort((a,b)=>String(kdText(kdGet(b.raw,'publication_date'))).localeCompare(String(kdText(kdGet(a.raw,'publication_date'))))||String(b.createdAt).localeCompare(String(a.createdAt)));
}

/* ---- Weergave ---- */
function kdUi(){return ui.kd??={tab:'artikelen',search:'',category:'',draft:'',preview:null,message:''}}
function kdLink(src){const m=kdText(src).match(/https?:\/\/[^\s"'<>]+/i);return m?`<a href="${esc(m[0])}" target="_blank" rel="noopener noreferrer">openen ↗</a>`:''}
function kdRow(label,value){const t=kdText(value).trim();return t?`<div class="kd-row"><span class="muted small">${esc(label)}</span><div style="white-space:pre-wrap">${esc(t)}</div></div>`:''}
function kdItemCard(it,full=true){
  const r=it.raw,tags=kdGet(r,'tags'),tagList=(Array.isArray(tags)?tags:kdText(tags).split(',')).map(x=>kdText(x).trim()).filter(Boolean);
  return `<article class="card kd-card" style="margin-bottom:12px"><div class="chips"><span class="chip green">${esc(it.category)}</span>${kdText(kdGet(r,'publication_date'))?`<span class="chip">${esc(kdText(kdGet(r,'publication_date')))}</span>`:''}${tagList.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
  <h3 style="margin:8px 0">${esc(kdText(kdGet(r,'title')))}</h3>
  <p class="muted small">${esc(kdText(kdGet(r,'source')))} ${kdLink(kdGet(r,'source'))}</p>
  ${['method','key_findings','novelty','evidence_quality','relevance','practical_translation','training_form','recommendation'].filter(f=>full||['practical_translation','training_form','recommendation'].includes(f)).map(f=>kdRow(KD_FIELD_LABELS[f],kdGet(r,f))).join('')}
  ${full?`<div class="row-actions" style="margin-top:10px"><button class="btn ghost small-btn" data-kd="edit" data-kd-id="${esc(it.id)}">Aanpassen</button><button class="btn danger small-btn" data-kd="delete" data-kd-id="${esc(it.id)}">Verwijderen</button></div>`:''}</article>`;
}
function kdResultsHtml(store){
  const u=kdUi(),list=kdSearch(store,u.search,u.category);
  return list.map(i=>kdItemCard(i)).join('')||`<div class="empty">${store.items.length?'Geen artikelen gevonden voor deze zoekopdracht.':'Nog geen kennisartikelen. Ga naar “Importeren” om een JSON-update toe te voegen.'}</div>`;
}
function kdPreviewHtml(p){
  if(!p)return '';
  const msgs=[...p.errors.map(e=>`<div class="callout red" style="margin-bottom:8px">${esc(e)}</div>`),...p.warnings.map(w=>`<div class="callout orange" style="margin-bottom:8px">${esc(w)}</div>`)].join('');
  if(!p.update)return `<section class="card" style="margin-top:12px"><h3>Controle</h3>${msgs}<p class="muted small">Er is niets opgeslagen.</p></section>`;
  const root=p.update.root;
  return `<section class="card" style="margin-top:12px"><p class="eyebrow">VOORBEELD · NOG NIET OPGESLAGEN</p><h3>${esc(kdText(root.title))}</h3><p class="muted small">${esc(kdText(root.update_date))} · ${esc(kdText(root.team_context))}</p>${msgs}
  <p>${esc(kdText(root.summary))}</p>${kdRow('Weekadvies voor het team',root.weekly_team_advice)}${kdRow('Volgende trainingsactie',root.next_training_action)}${kdRow('Geen-update-notitie',root.no_update_note)}
  <p><strong>${p.newItems.length}</strong> nieuw · <strong>${p.duplicates.length}</strong> dubbel (wordt overgeslagen)</p>
  ${p.newItems.map(n=>kdItemCard({id:'preview',category:n.category,raw:n.raw},false).replace(/<h3/,'<h4').replace(/<\/h3>/,'</h4>')).join('')}
  ${p.ok?'<button class="btn primary" data-kd="save-import">Opslaan in Kennis & Ontwikkeling</button> ':''}<button class="btn ghost" data-kd="cancel-import">Annuleren</button></section>`;
}
function kdAdviceHtml(store){
  const updates=[...store.updates].sort((a,b)=>String(kdText(b.root.update_date)).localeCompare(String(kdText(a.root.update_date)))||String(b.importedAt).localeCompare(String(a.importedAt)));
  if(!updates.length)return '<div class="empty">Nog geen trainingsadvies. Importeer eerst een update.</div>';
  const latest=updates[0];
  const practical=store.items.filter(i=>['practical_translation','training_form','recommendation'].some(f=>kdText(kdGet(i.raw,f)).trim()));
  return `<section class="card" style="margin-bottom:12px"><p class="eyebrow">VOLGENDE TRAININGSACTIE</p><div style="white-space:pre-wrap"><strong>${esc(kdText(latest.root.next_training_action)||'Geen actie opgegeven')}</strong></div>${kdRow('Weekadvies voor het team',latest.root.weekly_team_advice)}<p class="muted small">Uit: ${esc(kdText(latest.root.title))} · ${esc(kdText(latest.root.update_date))}</p></section>
  <h3>Praktische adviezen per artikel</h3>${practical.map(i=>kdItemCard(i,false)).join('')||'<div class="empty">Geen praktische adviezen in de opgeslagen artikelen.</div>'}
  <h3 style="margin-top:16px">Updates</h3>${updates.map(u=>`<article class="card" style="margin-bottom:12px"><div class="card-head"><div><p class="eyebrow">${esc(kdText(u.root.update_date))}</p><h3>${esc(kdText(u.root.title))}</h3></div><button class="btn danger small-btn" data-kd="delete-update" data-kd-id="${esc(u.id)}">Update verwijderen</button></div><p class="muted small">${esc(kdText(u.root.team_context))}</p><p>${esc(kdText(u.root.summary))}</p>${kdRow('Weekadvies voor het team',u.root.weekly_team_advice)}${kdRow('Volgende trainingsactie',u.root.next_training_action)}${kdRow('Geen-update-notitie',u.root.no_update_note)}<p class="muted small">${(u.itemIds||[]).length} artikel(en)</p></article>`).join('')}`;
}
function kdImportHtml(){
  const u=kdUi();
  return `<section class="card"><p class="eyebrow">IMPORTEREN</p><h3>JSON plakken of bestand kiezen</h3><p class="muted small">Eerst wordt alles gecontroleerd; er wordt pas iets opgeslagen nadat je het voorbeeld bevestigt. Bestaande teams, spelers, wedstrijden en trainingen worden nooit aangepast.</p>
  <textarea id="kdPaste" class="input" rows="8" style="width:100%;font-family:monospace" placeholder='{"schema_version":"1.0","record_type":"football_knowledge_update",…}'>${esc(u.draft)}</textarea>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn primary" data-kd="check">Controleren</button><button class="btn ghost" data-kd="pick-file">JSON-bestand kiezen</button></div></section>${kdPreviewHtml(u.preview)}`;
}
function renderKennis(){
  const u=kdUi(),cur=kdRead(),tabs=[['artikelen','Artikelen'],['advies','Trainingsadvies'],['importeren','Importeren']];
  const body=cur.error?`<div class="callout red" role="alert">${esc(cur.error)}</div>`:u.tab==='advies'?kdAdviceHtml(cur.store):u.tab==='importeren'?kdImportHtml():
    `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="kdSearch" class="input" type="search" placeholder="Zoek in artikelen…" value="${esc(u.search)}" style="flex:1;min-width:180px"><select id="kdCategory" class="input"><option value="">Alle categorieën</option>${KD_CATEGORIES.map(c=>`<option ${u.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div id="kdResults">${kdResultsHtml(cur.store)}</div>`;
  return `<div class="card-head"><div><p class="eyebrow">KENNIS & ONTWIKKELING</p><h2>Onderzoek en trainingsinzichten</h2></div><button class="btn ghost small-btn" data-kd="export">Kennis exporteren</button></div>
  <div class="chips" style="margin-bottom:12px">${tabs.map(([k,l])=>`<button class="btn ${u.tab===k?'primary':'ghost'} small-btn" data-kd="tab" data-kd-id="${k}">${l}${k==='artikelen'?` (${cur.store.items.length})`:''}</button>`).join('')}</div>${u.message?`<div class="callout" style="margin-bottom:12px">${esc(u.message)}</div>`:''}${body}`;
}

/* ---- Acties ---- */
function kdRunCheck(text){
  const u=kdUi();u.draft=text;u.message='';
  const cur=kdRead();
  u.preview=cur.error?{errors:[cur.error],warnings:[],update:null,newItems:[],duplicates:[]}:kdParse(text,cur.store);
  renderPage();
}
function kdEditItem(id){
  const cur=kdRead().store.items.find(i=>i.id===id);if(!cur)return;
  const val=f=>{const v=kdGet(cur.raw,f);return f==='tags'&&Array.isArray(v)?v.map(kdText).join(', '):kdText(v)};
  const fields=KD_EDIT_FIELDS.map(f=>`<div class="field full"><label>${esc(KD_FIELD_LABELS[f])}</label>${f==='title'||f==='tags'||f==='publication_date'||f==='source'?`<input class="input" data-kd-field="${f}" value="${esc(val(f))}">`:`<textarea data-kd-field="${f}" rows="3">${esc(val(f))}</textarea>`}</div>`).join('');
  modal('Artikel aanpassen',`<div class="form-grid"><div class="field full"><label>Categorie</label><select class="input" data-kd-field="category">${KD_CATEGORIES.map(c=>`<option ${cur.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>${fields}</div>`,null,{onSave(){
    const values={};$$('[data-kd-field]').forEach(el=>{values[el.dataset.kdField]=el.value});
    const r=kdUpdateItem(id,values);if(!r.ok)return toast(r.error);
    $('#modal').close();renderPage();toast('Artikel bijgewerkt');
  }});
}
function kdHandleClick(b){
  const u=kdUi(),a=b.dataset.kd,id=b.dataset.kdId;
  if(a==='tab'){u.tab=id;u.message='';renderPage()}
  else if(a==='check')kdRunCheck(($('#kdPaste')?.value)??u.draft);
  else if(a==='pick-file')$('#kdFile').click();
  else if(a==='cancel-import'){u.preview=null;renderPage()}
  else if(a==='save-import'){
    const r=kdImport(u.draft);
    if(!r.ok){u.preview={errors:r.errors,warnings:[],update:null,newItems:[],duplicates:[]};renderPage();return toast('Niet opgeslagen: '+r.errors[0])}
    u.preview=null;u.draft='';u.tab='artikelen';u.message=`${r.added} artikel(en) opgeslagen, ${r.duplicates} dubbel overgeslagen.`;renderPage();toast('Kennisupdate opgeslagen');
  }
  else if(a==='edit')kdEditItem(id);
  else if(a==='delete'){if(!confirm('Dit artikel verwijderen uit Kennis & Ontwikkeling? Andere gegevens blijven ongemoeid.'))return;const r=kdDeleteItem(id);u.message=r.ok?'Artikel verwijderd.':r.error;renderPage()}
  else if(a==='delete-update'){if(!confirm('Deze update en de bijbehorende artikelen verwijderen uit Kennis & Ontwikkeling? Andere gegevens blijven ongemoeid.'))return;const r=kdDeleteUpdate(id);u.message=r.ok?'Update verwijderd.':r.error;renderPage()}
  else if(a==='export'){const c=kdRead();if(c.error)return toast(c.error);downloadJson(c.store,`kennis-ontwikkeling-${TODAY()}.json`)}
}
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t&&t.id==='kdFile'){
    const f=t.files&&t.files[0];t.value='';
    if(!f)return;
    if(f.size>KD_MAX_FILE)return toast('Bestand is te groot (max. 5 MB)');
    try{kdUi().tab='importeren';kdRunCheck(await f.text())}catch{toast('Bestand kon niet worden gelezen')}
  }else if(t&&t.id==='kdCategory'){const u=kdUi();u.category=t.value;const el=$('#kdResults');if(el)el.innerHTML=kdResultsHtml(kdRead().store)}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t&&t.id==='kdSearch'){const u=kdUi();u.search=t.value;const el=$('#kdResults');if(el)el.innerHTML=kdResultsHtml(kdRead().store)}
  else if(t&&t.id==='kdPaste')kdUi().draft=t.value;
});
