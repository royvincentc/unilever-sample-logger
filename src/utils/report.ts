import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

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

    const getBatchNo = (cat: string) => {
      const c = (cat || '').toUpperCase().trim();
      if (c === 'ROH' || c === 'SFG') return raw[2] || 'N/A'; // Column C
      if (c === 'FG' || c === 'CUC') return raw[3] || 'N/A'; // Column D
      // Fallback
      return raw[2] || raw[3] || 'N/A';
    };

    if (tab === 'RawMats') {
      // E=4, F=5, I=8, J=9, K=10, N=13, P=15, W=22, X=23, Y=24, Z=25, AA=26, AB=27
      const apcSpec = String(raw[22] || '');
      const mySpec = String(raw[24] || '');
      const gnSpec = String(raw[23] || '');

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

      const apcResultStr = formatResult(apcSpec, String(data['(A) Aerobic Plate Count'] || data['Aerobic Plate Count'] || data['TVC (count)'] || raw[28] || ''));
      const myResultStr = formatResult(mySpec, String(data['(A) Yeast and Molds'] || data['Yeast and Molds'] || data['Molds & Yeast'] || raw[30] || ''));
      const gnResultStr = formatResult(gnSpec, String(data['Gram Negative'] || data['(A) Gram- Negative'] || data['Gram Staining'] || raw[29] || ''));

      const apcRemarks = apcResultStr ? ((apcResultStr.includes('<300') || apcResultStr === apcSpec || apcResultStr.startsWith('<')) ? 'Passed' : 'Failed') : '';
      const myRemarks = myResultStr ? ((myResultStr.includes('<100') || myResultStr === mySpec || myResultStr.startsWith('<')) ? 'Passed' : 'Failed') : '';
      const gnRemarks = gnResultStr ? ((gnResultStr.toLowerCase().includes('no growth') || gnResultStr.toLowerCase().includes('negative')) ? 'Passed' : 'Failed') : '';

      let overallRemarks = '';
      if (apcRemarks === 'Failed' || myRemarks === 'Failed' || gnRemarks === 'Failed') {
        overallRemarks = 'FAILED';
      } else if (apcRemarks === 'Passed' && myRemarks === 'Passed' && gnRemarks === 'Passed') {
        overallRemarks = 'PASSED';
      }

      templateData = {
        Category: mapCategory(raw[4]),
        SampleName: raw[5] || 'Unknown Sample',
        DateMfd: 'N/A',
        ExpiryDate: 'N/A',
        Purpose: 'Microbial Analysis',
        DateReceived: [raw[9], raw[10]].filter(v => v && String(v).trim().length > 0).join('; '),
        DateReleased: [raw[15], new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })].filter(v => v && String(v).trim().length > 0).join('; '),
        FillVol: raw[8] || 'N/A',
        RequestedBy: '[REFER TO RFAF]',
        BatchNo: getBatchNo(raw[4]),
        Logbook: '[TO BE FILLED UP]',
        
        // Spec
        APC_Spec: apcSpec,
        MY_Spec: mySpec,
        GN_Spec: gnSpec,
        
        // Result
        APC_Result: apcResultStr, // AC
        MY_Result: myResultStr, // AE
        GN_Result: gnResultStr, // AD
        
        APC_Remarks: apcRemarks,
        MY_Remarks: myRemarks,
        GN_Remarks: gnRemarks,
        
        OverallRemarks: overallRemarks,
        AnalyzedBy: raw[13] || analyzedBy || 'Jasmin C. Barangan',
        DateAnalyzed: new Date().toLocaleDateString(),
        DateReleasedOnly: raw[15] || ''
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
        AnalyzedBy: analyzedBy || 'Jasmin C. Barangan',
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
