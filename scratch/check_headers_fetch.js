const response = await fetch('http://localhost:3000/api/sheet-data?sheetId=10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo&tab=RM,FG,SFG%202026');
const data = await response.json();
if (data.length > 0) {
  console.log("Headers:", Object.keys(data[0]));
} else {
  console.log("Empty or no headers");
}
