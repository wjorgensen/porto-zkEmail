import dotenv from 'dotenv';
import { ZkProofSnarkjs } from './src/zkProofSnarkjs.js';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

// Setup logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testRealEmail() {
  console.log('🧪 Testing with Real Email (.eml file)\n');
  console.log('=====================================\n');
  
  try {
    // Read the real email
    const emlPath = path.join(__dirname, 'saved-emails', 'latest.eml');
    const emailContent = await fs.readFile(emlPath, 'utf8');
    
    console.log('📧 Email loaded from:', emlPath);
    
    // Extract some info from the email
    const subjectMatch = emailContent.match(/Subject:\s*([^\r\n]+)/i);
    const fromMatch = emailContent.match(/From:\s*([^\r\n]+)/i);
    const toMatch = emailContent.match(/To:\s*([^\r\n]+)/i);
    const dkimMatch = emailContent.match(/DKIM-Signature:\s*v=1/i);
    
    console.log('Email Details:');
    console.log('- Subject:', subjectMatch ? subjectMatch[1] : 'N/A');
    console.log('- From:', fromMatch ? fromMatch[1] : 'N/A');
    console.log('- To:', toMatch ? toMatch[1] : 'N/A');
    console.log('- Has DKIM:', dkimMatch ? 'Yes' : 'No');
    console.log();
    
    // Initialize the service
    const zkProofService = new ZkProofSnarkjs(logger);
    console.log('✅ ZK Proof Service created\n');
    
    // Initialize
    await zkProofService.initialize();
    console.log('✅ Service initialized\n');
    
    // Generate proof
    console.log('⚙️  Generating ZK Proof from real email...');
    console.log('This may take a while for the first run...\n');
    
    const startTime = Date.now();
    const proof = await zkProofService.generateProof(emailContent);
    const generationTime = Date.now() - startTime;
    
    console.log(`✅ Proof generated in ${generationTime}ms\n`);
    
    console.log('🔐 Proof Details:');
    console.log('- Protocol:', proof.proof.protocol);
    console.log('- Curve:', proof.proof.curve);
    console.log('- Blueprint:', proof.blueprint);
    console.log('- Is Mock:', proof.isMock || false);
    console.log();
    
    console.log('📊 Extracted Values:');
    console.log(JSON.stringify(proof.publicInputs, null, 2));
    console.log();
    
    if (proof.publicSignals && proof.publicSignals.length > 0) {
      console.log('📡 Public Signals:', proof.publicSignals.length, 'values');
      console.log('First few signals:', proof.publicSignals.slice(0, 5));
    }
    
    // Verify proof
    console.log('\n🔍 Verifying Proof...');
    const isValid = await zkProofService.verifyProof(proof);
    console.log(`Verification Result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    if (!proof.isMock) {
      console.log('🎉 Successfully generated and verified a real ZK proof!');
      console.log('This proof can be verified on-chain using the verifier contract.');
    } else {
      console.log('⚠️ Generated a mock proof (DKIM verification may have failed)');
      console.log('Check the logs above for details.');
    }
    
    console.log('\n=====================================');
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testRealEmail().catch(console.error);