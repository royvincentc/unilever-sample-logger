/** Synthetic-only services, wired exclusively by preview.config.ts. Never used by the production build. */
const today = new Date();
const date = (days = 0) => { const d = new Date(today); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
export let history = [
  { id:'demo-1',sampleType:'ENVI',sampleName:'Surface swab A',controlNumber:'E26-001',status:'ONGOING',dateSampled:date(2),dateAnalyzed:date(2),submittedAt:today.toISOString(),submittedBy:'Demo analyst',categories:['MV01'] },
  { id:'demo-2',sampleType:'WATER',sampleName:'Water point A',controlNumber:'W26-001',status:'PENDING RELEASE',dateSampled:date(14),dateAnalyzed:date(14),submittedAt:today.toISOString(),submittedBy:'Demo analyst' },
  { id:'demo-3',sampleType:'RawMats',sampleName:'Liquid detergent lot A',controlNumber:'26-0001',status:'ONGOING',dateSampled:date(3),dateAnalyzed:date(3),submittedAt:today.toISOString(),submittedBy:'Demo analyst',rawMatsType:'SFG',batchNumber:'DEMO-A' },
  { id:'demo-4',sampleType:'AIR',sampleName:'Air monitoring point A',controlNumber:'A26-001',status:'COMPLETED',dateSampled:date(),dateAnalyzed:date(),submittedAt:today.toISOString(),submittedBy:'Demo analyst' },
];
const listeners = new Set<(snapshot:any)=>void>();
function snapshot(ref:any) {
  const path = ref?.path || '';
  const records = path.includes('history') ? history : [];
  const docs = records.map(row=>({id:row.id,data:()=>({...row})}));
  return { exists:()=>false, data:()=>({}), empty:!docs.length, docs, forEach:(fn:any)=>docs.forEach(fn) };
}
export const collection = (_db:any,...path:string[])=>({path:path.join('/')});
export const doc = (_db:any,...path:string[])=>({path:path.join('/')});
export const query = (ref:any,..._args:any[])=>ref;
export const orderBy = (..._args:any[])=>({});
export const limit = (..._args:any[])=>({});
export const where = (..._args:any[])=>({});
export const getDocs = async (ref:any)=>snapshot(ref);
export const getDoc = async (ref:any)=>snapshot(ref);
export const onSnapshot = (ref:any,callback:any)=>{callback(snapshot(ref));const cb=()=>callback(snapshot(ref));listeners.add(cb);return ()=>listeners.delete(cb);};
let rejectNextHistorySave = false;
export const failNextHistorySave = ()=>{rejectNextHistorySave=true;};
export const setDoc = async (ref:any,row:any)=>{if(ref.path.startsWith('history/')){if(rejectNextHistorySave){rejectNextHistorySave=false;throw Error('Synthetic history outage');}const found=history.findIndex(r=>r.id===row.id);if(found<0)history.push(row);else history[found]=row;listeners.forEach(cb=>cb(null));}};
export const deleteDoc = async (ref:any)=>{history=history.filter(r=>!ref.path.endsWith('/'+r.id));listeners.forEach(cb=>cb(null));};
export const writeBatch = (_db:any)=>{const writes:any[]=[];return {set:(ref:any,row:any)=>writes.push([ref,row]),delete:(ref:any)=>writes.push([ref,null]),commit:async()=>{for(const [ref,row] of writes) row ? await setDoc(ref,row):await deleteDoc(ref);}};};
export const auth = { currentUser:{uid:'synthetic-user',providerData:[]},onAuthStateChanged:(callback:any)=>{callback({uid:'synthetic-user',providerData:[]});return ()=>{};} };
export const db = {};
export class GoogleAuthProvider { addScope(_scope:string){} }
export const onAuthStateChanged = (_auth:any,callback:any)=>auth.onAuthStateChanged(callback);
export const getRedirectResult = async()=>null;
export const signInWithPopup = async()=>({user:{uid:'synthetic-user',displayName:'Demo analyst'},_tokenResponse:{oauthAccessToken:'synthetic-only'}});
export const signInWithRedirect = async()=>{};
export const signInAnonymously = async()=>({user:auth.currentUser});
export const signOut = async()=>{};
export const getUserName = ()=>'Demo analyst';
export const isAuthenticated = ()=>true;
export const loginWithPassword = (user:string,password:string)=>user==='demo'&&password==='demo';
export const loginWithPin = async(pin:string)=>pin==='12345678';
export const logout = ()=>{};
export const saveGoogleSession = (_name:string)=>{};
export const signInWithGooglePopup = async()=>({success:true,firstName:'Demo',uid:'synthetic-user'});
export const signInWithGoogleRedirect = async()=>{};
export const getGoogleUserProfile = async()=>null;
export const saveGoogleUserProfile = async()=>{};
export const getSettings = ()=>({spreadsheetId:'synthetic-preview',n8nWebhookUrl:'/api/fixture',n8nApiKey:'',enviWebhook:'/api/fixture',waterWebhook:'/api/fixture',rawMatsWebhook:'/api/fixture',airWebhook:'/api/fixture',apiKey:'',theme:'system',sheetTab:'SWAB 2026'});
export const saveSettings = (_value:any)=>{};
export const saveSheetPreference = async()=>{};
export const listenToSheetPreference = (cb:any)=>{cb('synthetic-preview');return ()=>{};};
export const headers = ['CONTROL #','SAMPLE','DATE SAMPLED','DATE ANALYZED','STATUS','ANALYZED BY','APC','MY','REMARKS'];
const rowEdits: Record<string,Record<string,unknown>> = {};
export function sheetRows(tab='SWAB') {
  const type=tab.includes('WATER')?'WATER':tab.includes('AIR')?'AIR':tab.includes('RM')||tab.includes('SFG')?'RawMats':'ENVI';
  return history.filter(r=>r.sampleType===type).map((r,i)=>({_rowIndex:i+2,'CONTROL #':r.controlNumber,'SAMPLE':r.sampleName,'DATE SAMPLED':r.dateSampled,'DATE ANALYZED':r.dateAnalyzed,'STATUS':r.status,'ANALYZED BY':r.submittedBy,'APC':'0','MY':'0','REMARKS':'Pass',...rowEdits[r.controlNumber]}));
}
export const fetchHistoryFromSheet = async()=>{if(!navigator.onLine)throw Error('Synthetic offline state');return history.map(r=>r.id);};
export const fetchLiveSheetData = async(tab:string)=>sheetRows(tab);
export const fetchActiveIncubationsFromSheet = async()=>history.filter(r=>r.status!=='COMPLETED');
export const fetchSheetSchema = async()=>headers;
export const fetchSheetControlNumbers = async(tab:string)=>sheetRows(tab).map(r=>r['CONTROL #']);
export const analyseSheetForSubmission = async()=>({incompleteControlNumber:null,highestControlNumber:null});
let counter=100;
export const sendToWebhook = async(endpoint:string,_payload:any)=>navigator.onLine?{success:true,controlNumber:`${endpoint==='water'?'W':endpoint==='envi'?'E':endpoint==='air'?'A':''}26-${++counter}`}:{success:false,error:'Synthetic offline state'};
export const sendToWebhookBulk = async(endpoint:string,payloads:any[])=>({success:true,results:await Promise.all(payloads.map(p=>sendToWebhook(endpoint,p))),controlNumber:`${endpoint==='air'?'A':endpoint==='water'?'W':'E'}26-${++counter}`});
export const updateSheetRow = async(_tab:string,control:string,values:Record<string,unknown>)=>{rowEdits[control]={...values};return {success:true};};
export const testWebhookConnection = async()=>true;
