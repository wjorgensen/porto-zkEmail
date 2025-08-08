import dotenv from 'dotenv';
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

async function testDeployedBlueprint() {
  console.log('🔍 Testing Deployed Blueprint Access\n');
  console.log('=====================================\n');
  
  console.log('Blueprint Information:');
  console.log('- Slug: IonTeLOS/MailAddressProver');
  console.log('- ID: e7d84ab3-68f3-46b4-a1af-f6c87611d423');
  console.log('- URL: https://registry.zk.email/e7d84ab3-68f3-46b4-a1af-f6c87611d423\n');
  
  try {
    // Try importing the SDK
    console.log('📦 Attempting to import @zk-email/sdk...');
    const { default: zkEmailSDK } = await import('@zk-email/sdk');
    console.log('✅ SDK imported successfully\n');
    
    // Initialize SDK
    console.log('🔧 Initializing SDK...');
    const sdk = zkEmailSDK();
    console.log('✅ SDK initialized\n');
    
    // Try different methods to fetch the blueprint
    const attempts = [
      { method: 'slug', value: 'IonTeLOS/MailAddressProver' },
      { method: 'ID', value: 'e7d84ab3-68f3-46b4-a1af-f6c87611d423' },
      { method: 'full URL', value: 'https://registry.zk.email/e7d84ab3-68f3-46b4-a1af-f6c87611d423' }
    ];
    
    for (const attempt of attempts) {
      console.log(`\n🔄 Attempting to fetch blueprint using ${attempt.method}: ${attempt.value}`);
      try {
        const blueprint = await sdk.getBlueprint(attempt.value);
        
        console.log(`✅ Blueprint fetched successfully using ${attempt.method}!\n`);
        console.log('Blueprint Details:');
        console.log('- Name:', blueprint.name || 'N/A');
        console.log('- Version:', blueprint.version || 'N/A');
        console.log('- Status:', blueprint.status || 'N/A');
        
        if (blueprint.verifierContract) {
          console.log('\n📝 Verifier Contracts:');
          Object.entries(blueprint.verifierContract).forEach(([chain, address]) => {
            console.log(`  - ${chain}: ${address}`);
          });
        }
        
        if (blueprint.circuitArtifacts) {
          console.log('\n⚙️ Circuit Artifacts:');
          console.log('  - WASM:', blueprint.circuitArtifacts.wasm || 'N/A');
          console.log('  - ZKey:', blueprint.circuitArtifacts.zkey || 'N/A');
        }
        
        // Try to create a prover
        console.log('\n🔨 Creating prover...');
        const prover = blueprint.createProver();
        console.log('✅ Prover created successfully');
        
        // Test with a mock email
        const mockEmail = `From: sender@poof.ing
To: test@example.com
Subject: PORTO-AUTH-123456
DKIM-Signature: v=1; a=rsa-sha256; d=poof.ing; s=google; t=1704001200;
Date: Mon, 1 Jan 2024 12:00:00 +0000

Please reply to this email to verify your Porto account.
Auth Code: 123456
`;
        
        console.log('\n📧 Testing proof generation with mock email...');
        try {
          const proof = await prover.generateProof(mockEmail);
          console.log('✅ Proof generated successfully!');
          console.log('Proof summary:', {
            hasProof: !!proof.proof,
            hasPublicInputs: !!proof.publicInputs,
            timestamp: proof.timestamp
          });
        } catch (proofError) {
          console.log('❌ Proof generation failed:', proofError.message);
        }
        
        break; // Success, exit loop
        
      } catch (error) {
        console.log(`❌ Failed with ${attempt.method}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n📌 Note: The blueprint may need to be accessed differently.');
    console.log('You may need to manually download the circuit files from:');
    console.log('https://registry.zk.email/e7d84ab3-68f3-46b4-a1af-f6c87611d423');
  }
}

// Run the test
testDeployedBlueprint().catch(console.error);