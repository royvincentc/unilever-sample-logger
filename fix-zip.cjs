const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const freshDir = 'C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\docx_extracted2';
const zip = new PizZip();

function addFilesToZip(dirPath, zipPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const relativePath = zipPath ? `${zipPath}/${file}` : file;
        
        if (fs.statSync(fullPath).isDirectory()) {
            addFilesToZip(fullPath, relativePath);
        } else {
            zip.file(relativePath, fs.readFileSync(fullPath));
        }
    }
}

addFilesToZip(freshDir, '');

const outPath = 'C:\\Users\\Roy\\OneDrive - MSFT\\projects\\UL Sample Logger 2\\UL Sample Logger\\public\\template.docx';
fs.writeFileSync(outPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log("Template generated properly with PizZip at public/template.docx");
