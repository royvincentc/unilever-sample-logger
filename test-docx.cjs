const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('C:\\Users\\Roy\\OneDrive - MSFT\\projects\\UL Sample Logger 2\\UL Sample Logger\\public\\template.docx', 'binary');
const zip = new PizZip(content);

const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
});

doc.render({
    SampleName: "TEST SAMPLE",
    Category: "TEST CAT",
    APC_Spec: "TEST APC SPEC"
});

const buf = doc.getZip().generate({ type: 'nodebuffer' });
fs.writeFileSync('C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\test_out.docx', buf);
console.log("Done");
