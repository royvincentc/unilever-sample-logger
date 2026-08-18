const response = await fetch('http://localhost:3000/api/sheet-data?sheetId=10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo&tab=RM,FG,SFG%202026');
const dataRows = await response.json();
console.log("Total rows:", dataRows.length);
console.log(dataRows.slice(-10).map(r => ({
  ctrl: r['CONTROL #'],
  type: r['TYPE'],
  sample: r['SAMPLE']
})));
