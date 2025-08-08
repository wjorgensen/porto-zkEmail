import dotenv from 'dotenv';
import { ZkProofService } from './src/zkProofService.js';
import winston from 'winston';
import fs from 'fs/promises';

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

async function testZkProofService() {
  console.log('🧪 Testing ZK Proof Service Integration\n');
  console.log('=====================================\n');
  
  try {
    // Initialize the service
    const zkProofService = new ZkProofService(logger);
    console.log('✅ ZK Proof Service created\n');
    
    // Initialize SDK
    await zkProofService.initialize();
    console.log('✅ ZK Proof Service initialized\n');
    
    // Create a mock email for testing
    const mockEmail = `From: sender@poof.ing
To: test@example.com
Subject: PORTO-AUTH-123456
DKIM-Signature: v=1; a=rsa-sha256; d=poof.ing; s=google; t=1704001200;
Date: Mon, 1 Jan 2024 12:00:00 +0000

Please reply to this email to verify your Porto account.
Auth Code: 123456
`;
    
    console.log('📧 Mock Email Content:');
    console.log('-------------------');
    console.log(`Subject: PORTO-AUTH-123456`);
    console.log(`From: sender@poof.ing`);
    console.log(`To: test@example.com`);
    console.log(`Timestamp: 1704001200\n`);
    
    // Extract values
    const extractedValues = zkProofService.extractValuesFromEmail(mockEmail);
    console.log('📊 Extracted Values:');
    console.log(JSON.stringify(extractedValues, null, 2));
    console.log();
    
    // Generate proof
    console.log('⚙️  Generating ZK Proof...');
    const startTime = Date.now();
    
    const proof = await zkProofService.generateProof(mockEmail);
    
    const generationTime = Date.now() - startTime;
    console.log(`✅ Proof generated in ${generationTime}ms\n`);
    
    console.log('🔐 Proof Summary:');
    console.log('----------------');
    console.log(`Blueprint: ${proof.blueprint || 'IonTeLOS/MailAddressProver'}`);
    console.log(`Timestamp: ${new Date(proof.timestamp).toISOString()}`);
    console.log(`Public Inputs:`, proof.publicInputs);
    console.log();
    
    // Verify proof
    console.log('🔍 Verifying Proof...');
    const isValid = await zkProofService.verifyProof(proof);
    console.log(`Verification Result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    // Get verifier contract
    const verifierAddress = zkProofService.getVerifierContractAddress();
    if (verifierAddress) {
      console.log(`📝 Verifier Contract: ${verifierAddress}`);
    } else {
      console.log('📝 Verifier Contract: Not deployed (blueprint pending)');
    }
    
    console.log('\n=====================================');
    console.log('✅ All tests completed successfully!');
    
    // Check if we have a real email to test with
    try {
      const latestEmailPath = '../saved-emails/latest.eml';
      const emailContent = await fs.readFile(latestEmailPath, 'utf8');
      
      console.log('\n📧 Found saved email, testing with real data...');
      const realProofResult = await zkProofService.processEmailForProof({ source: emailContent });
      
      console.log('Real Email Proof Result:');
      console.log(`- Valid: ${realProofResult.isValid}`);
      console.log(`- Extracted Values:`, realProofResult.extractedValues);
      
    } catch (err) {
      console.log('\n📌 No saved emails found for real testing');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testZkProofService().catch(console.error);