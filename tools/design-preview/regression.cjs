// Isolated pure-logic checks. Remote service imports are replaced with synthetic fixtures.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map(),root=path.resolve(__dirname,'../..');
let capturedReport;
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function isolatedRequire(name){if(name==='file-saver')return {saveAs:blob=>{capturedReport=blob;}};if(name==='firebase/firestore'||name==='firebase/auth'||/\/utils\/(api|firebase|auth)$/.test(name)||/^\.\/(api|firebase|auth)$/.test(name))return load(path.join(root,'tools/design-preview/fixtures.ts'));if(name.startsWith('.')){let target=path.resolve(path.dirname(file),name);for(const ext of ['.ts','.tsx','/index.ts'])if(fs.existsSync(target+ext))return load(target+ext);throw Error('Missing '+target);}return require(name);}
new Function('require','module','exports',source)(isolatedRequire,module,module.exports);return module.exports;}
const {generateNextControlNumber,findHighestControlNumber}=load(path.join(root,'src/utils/controlNumber.ts'));
const {remapPayloadToLiveColumns}=load(path.join(root,'src/hooks/useSheetSchema.ts'));
const {historyFromQueuedSample}=load(path.join(root,'src/utils/queueHistory.ts'));
let checks=0;function check(label,run){run();checks++;console.log('PASS '+label)}
for(const [type,prefix]of [['ENVI','E'],['WATER','W'],['RawMats',''],['AIR','A']]){
check(type+' initial assignment',()=>assert.equal(generateNextControlNumber(type,null,'2026-10-08'),prefix+'26-001'));
check(type+' unordered highest control',()=>assert.equal(findHighestControlNumber(type,[prefix+'26-009',prefix+'25-900',prefix+'26-012',prefix+'26-010'],'2026-10-08'),prefix+'26-012'));
check(type+' increment',()=>assert.equal(generateNextControlNumber(type,prefix+'26-012','2026-10-08'),prefix+'26-013'));}
const original={dateSampled:'2026-10-08',dateAnalyzed:'2026-10-09',status:'ON GOING',sample:'Demo water'};
const mapped=remapPayloadToLiveColumns(original,['DATE SAMPLED','DATE ANALYZED','STATUS','SAMPLE']);
const item={id:'fixture',sampleType:'WATER',sampleName:'Demo water',controlNumber:'W26-001',formData:mapped,submittedBy:'Demo analyst'};
check('Mapped queue metadata survives reconciliation',()=>{const entry=historyFromQueuedSample(item,'W26-107');assert.equal(entry.dateSampled,original.dateSampled);assert.equal(entry.dateAnalyzed,original.dateAnalyzed);assert.equal(entry.status,original.status);assert.equal(entry.controlNumber,'W26-107');assert.equal(entry.sampleName,'Demo water');});
check('Expression fallback retains provisional control',()=>assert.equal(historyFromQueuedSample(item,'{{ expression }}').controlNumber,'W26-001'));
check('N/A fallback retains provisional control',()=>assert.equal(historyFromQueuedSample(item,'N/A').controlNumber,'W26-001'));
check('RawMats final number normalized',()=>assert.equal(historyFromQueuedSample({...item,sampleType:'RawMats',formData:{...original,type:'ROH'}},'RM26-019').controlNumber,'26-019'));
console.log(checks+' regression checks passed');
async function checkReport(){
 const previousFetch=global.fetch;
 global.fetch=async url=>{assert.equal(url,'/template.docx');return new Response(fs.readFileSync(path.join(root,'public/template.docx')));};
 try {
  const {generateDocxReport}=load(path.join(root,'src/utils/report.ts'));
  await generateDocxReport({'CONTROL #':'26-101','SAMPLE':'Demo material','ANALYZED BY':'Demo analyst','(C) Aerobic Plate Count':'12'},'Demo analyst','RawMats');
  assert(capturedReport instanceof Blob);
  const PizZip=require('pizzip');const zip=new PizZip(await capturedReport.arrayBuffer());
  const documentXml=zip.file('word/document.xml').asText();
  assert(documentXml.includes('Passed'));
  assert(!documentXml.includes('{APC_Result}'));
  console.log('PASS Actual DOCX generator emits a valid synthetic report');
 } finally {global.fetch=previousFetch;}
}
checkReport().catch(error=>{console.error(error);process.exitCode=1;});
