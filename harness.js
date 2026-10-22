// Laadt app.js in een vm met minimale browserstubs (geen dependencies).
const vm=require('vm'),fs=require('fs'),path=require('path');
function makeEl(){const f=function(){};const p=new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;if(k==='length')return 0;if(k==='dataset'||k==='style')return makeEl();if(['forEach','map','filter'].includes(k))return()=>[];if(['value','textContent','innerHTML','className'].includes(k))return t[k]??'';return t[k]??makeEl()},set(t,k,v){t[k]=v;return true},apply(){return makeEl()}});return p}
function createApp({store={},failWrites=false,confirmAnswer=true}={}){
  const ls={data:{...store},failWrites,getItem(k){return k in this.data?this.data[k]:null},setItem(k,v){if(this.failWrites){const e=new Error('quota');e.name='QuotaExceededError';throw e}this.data[k]=String(v)},removeItem(k){delete this.data[k]}};
  const toasts=[];
  const doc={querySelector:()=>makeEl(),querySelectorAll:()=>[],getElementById:()=>makeEl(),createElement:()=>makeEl(),addEventListener(){},body:makeEl(),documentElement:makeEl()};
  const win={addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),location:{protocol:'file:',href:''}};
  const sandbox={window:win,document:doc,localStorage:ls,navigator:{onLine:false},location:win.location,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
    confirm:()=>confirmAnswer,alert(){},fetch:async()=>{throw new Error('geen netwerk')},crypto:require('crypto').webcrypto,TextEncoder,TextDecoder,btoa,atob,URL,Blob,Intl,Date,JSON};
  win.window=win;Object.assign(win,sandbox,{window:win});
  const ctx=vm.createContext(sandbox);
  const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8')+`
;globalThis.__t={get state(){return state},set state(v){state=v},get storageLoadError(){return storageLoadError},save,load,validateStateData,persistRemoteCopy,writeCloudCopy,pushSync,pullSync,fetchCloudCopy,ensureSession,authSignIn,authSignUp,authSignOut,getAuthSession,storeAuthSession,AUTH_KEY,SYNC_ROW_ID,normalizedStateCopy,STORAGE_KEY,LEGACY_STORAGE_KEY,RECOVERY_BACKUP_KEY,CLOUD_CONFLICT_KEY,SYNC_ACCOUNT_KEY,checkNewSyncPass,initialSync,encryptData,decryptData,syncIdFromPass,vc2Index,vc2Passages,vc2IsSearchable,addExerciseToTraining,STANDARD_PRINCIPLES,seedStandardPrinciples,vc2FileMatches,toastLog:()=>__toasts};`;
  sandbox.__toasts=toasts;
  vm.runInContext(src.replace(/function toast\(msg\)\{/,'function toast(msg){__toasts.push(msg);'),ctx,{filename:'app.js'});
  return {t:sandbox.__t,ls,toasts,sandbox};
}
module.exports={createApp};
