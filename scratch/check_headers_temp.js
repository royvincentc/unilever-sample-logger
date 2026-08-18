const https = require('http');

https.get('http://localhost:3000/api/sheet-data?sheetId=10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo&tab=RM,FG,SFG%202026', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.length > 0) {
        console.log("Headers:", Object.keys(parsed[0]));
      } else {
        console.log("Empty or no headers");
      }
    } catch(e) {
      console.log("Error parsing json", e, data);
    }
  });
}).on('error', (err) => {
  console.log("Error: ", err.message);
});
