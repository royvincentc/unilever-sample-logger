const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PizZip = require('pizzip');

const dir = 'C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\docx_extracted';

// Reset the extracted folder from zip to start fresh
execSync('powershell -Command "Expand-Archive -Path \\"C:\\Users\\Roy\\OneDrive - MSFT\\DownloadsLP\\Jasmin UL Reports.zip\\" -DestinationPath \\"C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\Jasmin UL Reports 3\\" -Force"');
const freshDir = 'C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\docx_extracted3';
if (fs.existsSync(freshDir)) fs.rmSync(freshDir, { recursive: true, force: true });
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\\Users\\Roy\\.gemini\\antigravity\\brain\\9f3b1817-6e89-4646-b03f-d3b06a1fc7fc\\scratch\\Jasmin UL Reports 3\\Jasmin UL Reports\\FABCON\\Blossom Fresh\\Blossom Fresh-  (0024) 0608262A2.docx', '${freshDir}')"`);

function xmlSafeReplace(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of Object.entries(replacements)) {
        content = content.split(search).join(replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

function xmlSafeReplaceArray(filePath, searches, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace sequentially
    for (let i = 0; i < searches.length; i++) {
        const search = searches[i];
        const parts = content.split(search);
        if (parts.length > 1) {
            content = parts[0] + replacements[i] + parts.slice(1).join(search);
        }
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// Special function to replace date chunk that is broken up
function replaceBrokenDateChunk(filePath) {
    if (!fs.existsSync(filePath)) return;
    let xml = fs.readFileSync(filePath, 'utf8');
    
    // 08/06/2026; 01:10 PM
    const start1 = xml.indexOf('<w:t>08/06</w:t>');
    if (start1 !== -1) {
        const end1 = xml.indexOf('<w:t>M</w:t>', start1) + 12;
        const chunk1 = xml.substring(start1, end1);
        xml = xml.replace(chunk1, '<w:t>{DateReceived}</w:t>');
    }
    
    // 08/13/2026; 10:00 AM (DateReleased)
    const releaseTextIdx = xml.indexOf('Released');
    if (releaseTextIdx !== -1) {
        const start2 = xml.indexOf('<w:t>08</w:t>', releaseTextIdx);
        if (start2 !== -1) {
            const end2 = xml.indexOf('<w:t>M</w:t>', start2) + 12;
            const chunk2 = xml.substring(start2, end2);
            xml = xml.replace(chunk2, '<w:t>{DateReleased}</w:t>');
        }
    }
    
    // Logbook
    const start3 = xml.indexOf('<w:t>MIC-</w:t>');
    if (start3 !== -1) {
        const end3 = xml.indexOf('26-778</w:t>', start3) + 12;
        const chunk3 = xml.substring(start3, end3);
        xml = xml.replace(chunk3, '<w:t>{Logbook}</w:t>');
    }
    
    fs.writeFileSync(filePath, xml, 'utf8');
}


xmlSafeReplace(path.join(freshDir, 'word/header1.xml'), {
    'Blossom Fresh': '{SampleName}',
    '0608262A2 00:24': '{BatchNo}',
    '08/06/2026': '{DateMfd}',
    '11/06/2027': '{ExpiryDate}',
    '28 mL': '{FillVol}',
    'Entera': '{RequestedBy}',
    'Microbial Analysis': '{Purpose}',
    'Finished Goods': '{Category}',
});

replaceBrokenDateChunk(path.join(freshDir, 'word/header1.xml'));

xmlSafeReplace(path.join(freshDir, 'word/footer1.xml'), {
    'PASSED': '{OverallRemarks}',
    'Jasmin C. Barangan': '{AnalyzedBy}',
    '08/13/2026': '{DateAnalyzed}'
});

xmlSafeReplaceArray(path.join(freshDir, 'word/document.xml'), 
  [
    '<w:t>&lt;300 cfu/g</w:t>', // APC Spec
    '<w:t>&lt;300 cfu/g</w:t>', // APC Result
    '<w:t>&lt;100 cfu/g</w:t>', // MY Spec
    '<w:t>&lt;100 cfu/g</w:t>', // MY Result
    '<w:t>No Growth</w:t>',     // GN Spec
    '<w:t>No Growth</w:t>',     // GN Result
    '<w:t>Passed</w:t>',        // APC Remarks
    '<w:t>Passed</w:t>',        // MY Remarks
    '<w:t>Passed</w:t>'         // GN Remarks
  ],
  [
    '<w:t>{APC_Spec}</w:t>',
    '<w:t>{APC_Result}</w:t>',
    '<w:t>{MY_Spec}</w:t>',
    '<w:t>{MY_Result}</w:t>',
    '<w:t>{GN_Spec}</w:t>',
    '<w:t>{GN_Result}</w:t>',
    '<w:t>{APC_Remarks}</w:t>',
    '<w:t>{MY_Remarks}</w:t>',
    '<w:t>{GN_Remarks}</w:t>'
  ]
);

console.log("Replaced. Now zip it with PizZip.");
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
