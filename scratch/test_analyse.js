const response = await fetch('http://localhost:3000/api/sheet-data?sheetId=10ZTitLYObaWll2p8waWfQ0LJzuPu77Of0IDPL42zzwo&tab=RM,FG,SFG%202026');
const dataRows = await response.json();
const getControl = (row) => {
  const raw = String(row['CONTROL #'] || '').trim();
  return raw.replace(/^RM-?/i, '');
};

const isEmpty = (v) => {
  const s = String(v ?? '').trim();
  return s === '' || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null';
};

const incompleteList = [];
let lastNum = 0;
let foundYear = '';

for (const row of dataRows) {
  const ctrl = getControl(row);
  if (!ctrl) continue;

  const match = ctrl.match(/(?:[EW]?\d{2}-)?(\d{2})-(\d+)/i) || ctrl.match(/^(\d{2})-(\d+)$/);
  if (match) {
    foundYear = match[1];
    const num = parseInt(match[2], 10);
    if (num > lastNum) lastNum = num;
  }

  if (isEmpty(row['TYPE']) || isEmpty(row['SAMPLE'])) {
    incompleteList.push(ctrl);
  }
}

incompleteList.sort((a, b) =>
  parseInt(b.split('-').pop() || '0', 10) - parseInt(a.split('-').pop() || '0', 10)
);

const highestControlNumber = lastNum > 0
  ? `${foundYear || new Date().getFullYear().toString().slice(-2)}-${String(lastNum).padStart(3, '0')}`
  : null;

console.log("Incomplete:", incompleteList[0] ?? null);
console.log("Highest:", highestControlNumber);
