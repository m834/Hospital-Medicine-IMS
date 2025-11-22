import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';

interface MedicineData {
  serialNo?: string;
  name: string;
  genericName?: string;
  form: string;
  strength?: string;
  manufacturer?: string;
  packSize?: string;
  governmentPrice?: number;
  retailPrice?: number;
}

async function parsePDF() {
  const pdfPath = path.join(__dirname, '../../..', 'PRODUCT PRICE LIST FY 2024-2025 HEALTH DEPARTMENT GOB (1).pdf');
  
  console.log('Reading PDF from:', pdfPath);
  
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  
  console.log('PDF Info:');
  console.log('- Pages:', data.numpages);
  console.log('- Text length:', data.text.length);
  console.log('\n--- First 2000 characters ---\n');
  console.log(data.text.substring(0, 2000));
  console.log('\n--- Last 1000 characters ---\n');
  console.log(data.text.substring(data.text.length - 1000));
  
  // Save full text to file for analysis
  const outputPath = path.join(__dirname, 'pdf-extracted-text.txt');
  fs.writeFileSync(outputPath, data.text);
  console.log('\nFull text saved to:', outputPath);
  
  // Try to parse the structure
  const lines = data.text.split('\n').filter(line => line.trim().length > 0);
  
  console.log('\n--- Sample lines (first 50) ---\n');
  lines.slice(0, 50).forEach((line, idx) => {
    console.log(`${idx + 1}: ${line}`);
  });
  
  return {
    pages: data.numpages,
    textLength: data.text.length,
    lines: lines.length,
    sampleLines: lines.slice(0, 100),
  };
}

parsePDF()
  .then((result) => {
    console.log('\n=== Parsing Complete ===');
    console.log('Total lines:', result.lines);
  })
  .catch((error) => {
    console.error('Error parsing PDF:', error);
    process.exit(1);
  });
