import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

// Analyst surname-to-full-name mapping
const ANALYST_NAME_MAP: Record<string, string> = {
  'CODINERA': 'Roy Vincent Codiñera',
  'CODIÑERA': 'Roy Vincent Codiñera',
  'GOLORAN': 'James Bryle A. Goloran',
  'BARANGAN': 'Jasmin C. Barangan',
  'CANOY': 'Ahrianne B. Canoy',
  'VILLAVER': 'Annaleen C. Villaver',
  'NUEVA': 'Daryl Chris D. Nueva',
  'JUEN': 'Karen M. Juen',
};

/**
 * Resolves analyst surname(s) to full name(s).
 * - Single analyst: "JUEN" -> "Karen M. Juen"
 * - Dual analyst: "CODINERA/NUEVA" -> "Roy Vincent Codiñera\nDaryl Chris D. Nueva"
 *   (left = first line, right = second line)
 * Falls back to the original value if the surname is not recognized.
 */
function resolveAnalystName(rawValue: string): string {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return '';

  // Check for dual analyst format (separated by /)
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(s => s.trim().toUpperCase());
    const resolved = parts.map(surname => ANALYST_NAME_MAP[surname] || surname);
    return resolved.join('\n');
  }

  // Single analyst
  const upper = trimmed.toUpperCase();
  return ANALYST_NAME_MAP[upper] || trimmed;
}

export async function generateDocxReport(data: any, analyzedBy: string, tab: string) {
  try {
    // Fetch the template from the public folder
    const response = await fetch('/template.docx');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Load the zip
    const zip = new PizZip(arrayBuffer);

    // Create the docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    let templateData: any = {};
    const raw = data.__rawRow || [];

    const mapCategory = (cat: string) => {
      const c = (cat || '').toUpperCase().trim();
      if (c === 'SFG') return 'Semi-finished Goods';
      if (c === 'CUC') return 'Finished Goods';
      if (c === 'ROH') return 'Raw Materials';
      return cat || 'N/A';
    };

    const getBatchNo = () => {
      const mix = String(data['MIXING BATCH #'] || data['BATCH #'] || raw[2] || '').trim();
      return mix || String(data['CONTROL #'] || '').trim() || 'N/A';
    };

    if (tab === 'RawMats') {
      const apcSpec = String(data['(S) Aerobic Plate Count'] || raw[22] || raw[21] || '<300 cfu/g');
      const gnSpec = String(data['(S) Gram- Negative'] || raw[23] || raw[22] || 'No Growth');
      const mySpec = String(data['(S) Yeast and Molds'] || raw[24] || raw[23] || '<100 cfu/g');

      const formatResult = (specStr: string, resultStr: string) => {
        if (!specStr || !resultStr) return resultStr;
        const specMatch = String(specStr).match(/<(\d+)/);
        if (!specMatch) return resultStr;
        const specNum = parseFloat(specMatch[1]);
        const resultMatch = String(resultStr).match(/<?\s*(\d+(\.\d+)?)/);
        if (!resultMatch) return resultStr;
        const resultNum = parseFloat(resultMatch[1]);
        if (resultNum < specNum) {
          return specStr;
        }
        return resultStr;
      };

      const rawApc = data['(C) Aerobic Plate Count'] || data['(A) Aerobic Plate Count'] || data['Aerobic Plate Count'] || data['TVC (count)'] || raw[28] || raw[25] || raw[27] || '';
      const apcResultStr = formatResult(apcSpec, String(rawApc));

      const rawMy = data['(C) Yeast and Molds'] || data['(A) Yeast and Molds'] || data['Yeast and Molds'] || data['Molds & Yeast'] || raw[30] || raw[27] || raw[29] || '';
      const myResultStr = formatResult(mySpec, String(rawMy));
      
      const gnResultStr = String(data['(C) Gram- Negative'] || data['(A) Gram- Negative'] || raw[29] || raw[26] || raw[28] || '');

      const apcRemarks = apcResultStr ? ((apcResultStr.includes('<300') || apcResultStr === apcSpec || apcResultStr.startsWith('<')) ? 'Passed' : 'Failed') : '';
      const myRemarks = myResultStr ? ((myResultStr.includes('<100') || myResultStr === mySpec || myResultStr.startsWith('<')) ? 'Passed' : 'Failed') : '';
      
      // GN_Remarks logic: "Passed" if value is <100, <100 cfu/g, numeric <= 100, or 'No Growth'.
      let gnRemarks = '';
      if (gnResultStr) {
        const cleanGn = gnResultStr.toLowerCase().replace(/\s/g, '').replace('cfu/g', '');
        if (cleanGn === '<100' || cleanGn === 'nogrowth' || cleanGn === 'absent' || cleanGn.includes('negative')) {
          gnRemarks = 'Passed';
        } else {
          const match = cleanGn.match(/(\d+(\.\d+)?)/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val <= 100) {
              gnRemarks = 'Passed';
            } else {
              gnRemarks = 'Failed';
            }
          } else {
             if (cleanGn === 'growth' || cleanGn === 'present' || cleanGn.includes('positive')) {
               gnRemarks = 'Failed';
             } else {
               gnRemarks = gnResultStr;
             }
          }
        }
      }

      // OverallRemarks from REMARKS / REMARKS2 / column AI/AH
      const overallRemarks = String(data['REMARKS '] || data['REMARKS'] || raw[34] || raw[33] || raw[17] || '');

      templateData = {
        Category: mapCategory(data['TYPE'] || raw[4] || raw[3]),
        SampleName: data['SAMPLE'] || raw[5] || raw[4] || 'Unknown Sample',
        DateMfd: 'N/A',
        ExpiryDate: 'N/A',
        Purpose: 'Microbial Analysis',
        DateReceived: [data['DATE RECEIVED/SAMPLED'] || raw[9] || raw[8], data['TIME'] || raw[10] || raw[9]].filter(v => v && String(v).trim().length > 0).join('; '),
        DateReleased: [data['DATE RELEASED'] || raw[15] || raw[14], new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })].filter(v => v && String(v).trim().length > 0).join('; '),
        FillVol: String(data['UNIT'] || raw[5] || 'N/A').trim() || 'N/A',
        RequestedBy: data['RFAF'] || '[REFER TO RFAF]',
        BatchNo: getBatchNo(),
        Logbook: '[TO BE FILLED UP]',
        
        // Spec
        APC_Spec: apcSpec,
        MY_Spec: mySpec,
        GN_Spec: gnSpec,
        
        // Result
        APC_Result: apcResultStr,
        MY_Result: myResultStr,
        GN_Result: gnResultStr,
        
        APC_Remarks: apcRemarks,
        MY_Remarks: myRemarks,
        GN_Remarks: gnRemarks,
        
        OverallRemarks: overallRemarks,
        AnalyzedBy: resolveAnalystName(data['ANALYZED BY'] || raw[13] || raw[12] || analyzedBy || 'Jasmin C. Barangan'),
        DateAnalyzed: data['DATE ANALYZED'] || raw[12] || new Date().toLocaleDateString(),
        DateReleasedOnly: data['DATE RELEASED'] || raw[15] || raw[14] || ''
      };
    } else {
      // Generic fallback for other tabs until specified
      templateData = {
        Category: tab,
        SampleName: data['SAMPLE NAME'] || data['SAMPLE'] || data['POINT'] || 'Unknown Sample',
        BatchNo: data['BATCH NUMBER'] || data['BATCH'] || 'N/A',
        DateReceived: data['TIMESTAMP'] || 'N/A',
        DateReleased: new Date().toLocaleDateString() + '; ' + new Date().toLocaleTimeString(),
        DateReleasedOnly: new Date().toLocaleDateString(),
        DateMfd: data['MFG DATE'] || data['DATE SAMPLED'] || 'N/A',
        ExpiryDate: data['EXPIRY DATE'] || 'N/A',
        FillVol: 'N/A',
        RequestedBy: data['SAMPLED BY'] || 'N/A',
        Purpose: 'Microbial Analysis',
        
        APC_Spec: '<300 cfu/g',
        MY_Spec: '<100 cfu/g',
        GN_Spec: 'No Growth',
        
        APC_Result: data['(A) Aerobic Plate Count'] || data['TVC (count)'] || '',
        MY_Result: data['(A) Yeast and Molds'] || '',
        GN_Result: data['(A) Gram- Negative'] || data['Gram Staining'] || data['Gram Negative (count)'] || '',
        
        APC_Remarks: '',
        MY_Remarks: '',
        GN_Remarks: '',
        
        OverallRemarks: '',
        AnalyzedBy: resolveAnalystName(analyzedBy || 'Jasmin C. Barangan'),
        DateAnalyzed: new Date().toLocaleDateString(),
      };
    }

    // Render the document
    doc.render(templateData);

    // Generate the blob
    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Save the file
    const safeName = String(templateData.SampleName).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const controlNum = String(data['CONTROL #'] || data['CONTROL'] || '000').replace(/[^a-z0-9-]/gi, '_');
    saveAs(out, `${safeName}_${controlNum}.docx`);
    
    return true;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}
