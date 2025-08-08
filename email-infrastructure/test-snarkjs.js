import dotenv from 'dotenv';
import { ZkProofSnarkjs } from './src/zkProofSnarkjs.js';
import winston from 'winston';

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

async function testSnarkjsProof() {
  console.log('🧪 Testing Snarkjs Proof Generation with Circuit Files\n');
  console.log('=====================================================\n');
  
  try {
    // Initialize the service
    const zkProofService = new ZkProofSnarkjs(logger);
    console.log('✅ ZK Proof Snarkjs Service created\n');
    
    // Initialize
    await zkProofService.initialize();
    console.log('✅ Service initialized with circuit files\n');
    
    // Create a test email
    const mockEmail = `From: sender@poof.ing
To: test@example.com
Subject: PORTO-AUTH-123456
DKIM-Signature: v=1; a=rsa-sha256; d=poof.ing; s=google; t=1704001200;
Date: Mon, 1 Jan 2024 12:00:00 +0000

Please reply to this email to verify your Porto account.
Auth Code: 123456
`;
    
    console.log('📧 Test Email:');
    console.log('- Subject: PORTO-AUTH-123456');
    console.log('- From: sender@poof.ing');
    console.log('- To: test@example.com\n');
    
    // Generate proof
    console.log('⚙️  Generating ZK Proof (this may take a moment)...');
    const startTime = Date.now();
    
    const proof = await zkProofService.generateProof(mockEmail);
    
    const generationTime = Date.now() - startTime;
    console.log(`✅ Proof generated in ${generationTime}ms\n`);
    
    console.log('🔐 Proof Details:');
    console.log('- Protocol:', proof.proof.protocol);
    console.log('- Curve:', proof.proof.curve);
    console.log('- Blueprint:', proof.blueprint);
    console.log('- Public Inputs:', proof.publicInputs);
    console.log('- Is Mock:', proof.isMock || false);
    console.log();
    
    // Verify proof
    console.log('🔍 Verifying Proof...');
    const isValid = await zkProofService.verifyProof(proof);
    console.log(`Verification Result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    // Format for Solidity
    if (!proof.isMock) {
      console.log('📝 Formatted for Solidity:');
      const solidityProof = zkProofService.formatProofForSolidity(proof);
      console.log('- a:', solidityProof.a);
      console.log('- b:', solidityProof.b);
      console.log('- c:', solidityProof.c);
      console.log('- inputs:', solidityProof.input);
    }
    
    console.log('\n=====================================================');
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testSnarkjsProof().catch(console.error);