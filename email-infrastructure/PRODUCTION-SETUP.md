# Production zkEmail Setup Guide

## Overview

A zkEmail blueprint defines:
1. **Email Query**: What emails to look for (subject, sender, etc.)
2. **Extractors**: Regex patterns to extract data from emails
3. **Public Inputs**: What data becomes public in the proof
4. **Circuit Parameters**: Technical constraints (email size, etc.)

## Complete Production Setup

### 1. Register Your Blueprint

```bash
# Install zkEmail CLI
npm install -g @zk-email/cli

# Register blueprint on testnet first
zkemail blueprint register blueprints/porto-auth.json \
  --chain base-sepolia \
  --rpc-url https://sepolia.base.org

# Get blueprint ID and verifier address
zkemail blueprint status porto-auth-v1 --chain base-sepolia
```

### 2. Setup GPU Server (RTX 2060)

```bash
# On your GPU server
cd email-infrastructure/gpu-server
./setup-gpu-server.sh

# This will:
# - Install CUDA dependencies
# - Build RapidSnark with GPU support
# - Create optimized circuits
# - Setup systemd service
```

### 3. Circuit Compilation

The setup script compiles a Porto-specific circuit, but here's the manual process:

```bash
# Install circom
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
cargo install --git https://github.com/iden3/circom

# Compile circuit
circom circuits/porto_auth.circom \
  --r1cs --wasm --sym \
  --O2 \  # Optimization level 2
  -l node_modules

# Generate proving key (one-time, takes ~30min)
snarkjs groth16 setup \
  porto_auth.r1cs \
  powersOfTau28_hez_final_21.ptau \
  porto_auth_0001.zkey

# Contribute randomness
snarkjs zkey contribute \
  porto_auth_0001.zkey \
  porto_auth_final.zkey \
  --name="Porto Production" \
  -e="random_entropy_here"

# Export verification key
snarkjs zkey export verificationkey \
  porto_auth_final.zkey \
  verification_key.json
```

### 4. Deploy Verifier Contract

```solidity
// Deploy this contract using the verification key
pragma solidity ^0.8.0;

import "@zk-email/contracts/verifiers/Groth16Verifier.sol";

contract PortoEmailVerifier is Groth16Verifier {
    // Paste verification key here
    uint256[2] public IC0 = [/* from verification_key.json */];
    uint256[2] public IC1 = [/* ... */];
    // ... more IC values
    
    function verifyPortoEmail(
        uint256[8] calldata proof,
        uint256[6] calldata publicInputs
    ) external view returns (bool) {
        // publicInputs order:
        // [0] authCode
        // [1] walletAddress
        // [2] action
        // [3] timestamp
        // [4] emailDomainHash
        // [5] dkimPublicKeyHash
        
        return verifyProof(proof, publicInputs);
    }
}
```

### 5. Production Email Parser

```javascript
// Production-ready email parser
import { DKIMVerify } from '@zk-email/helpers';
import { createHash } from 'crypto';

export async function parseEmailForProof(rawEmail) {
  // 1. Verify DKIM signature
  const dkimResult = await DKIMVerify(rawEmail);
  if (!dkimResult.verified) {
    throw new Error('DKIM verification failed');
  }
  
  // 2. Extract headers
  const headers = rawEmail.split('\r\n\r\n')[0];
  const from = headers.match(/From: .* <(.+)>/)?.[1];
  const subject = headers.match(/Subject: (.+)/)?.[1];
  
  // 3. Extract body data
  const body = rawEmail.split('\r\n\r\n')[1];
  const challengeMatch = body.match(
    /PORTO\|(\d+)\|([0-9a-fA-Fx]+)\|(\w+)\|([0-9a-fA-Fx]+)\|(\d+)\|(\d+)\|([0-9a-fA-Fx]+)/
  );
  
  if (!challengeMatch) {
    throw new Error('Invalid email format');
  }
  
  // 4. Prepare circuit input
  const circuitInput = {
    // Raw email data (padded)
    emailHeader: padToLength(headers, 512),
    emailBody: padToLength(body, 3584),
    
    // DKIM data
    dkimSignature: dkimResult.signature,
    dkimPublicKey: dkimResult.publicKey,
    
    // Extracted values
    authCode: subject.match(/PORTO-AUTH-(\d{6})/)?.[1],
    chainId: challengeMatch[1],
    walletAddress: challengeMatch[2],
    action: challengeMatch[3],
    nonce: challengeMatch[5],
    timestamp: challengeMatch[6],
    
    // Hashes
    emailDomainHash: hashDomain(from.split('@')[1]),
    dkimPublicKeyHash: hashPublicKey(dkimResult.publicKey)
  };
  
  return circuitInput;
}
```

### 6. GPU Proof Generation Service

Your RTX 2060 setup will handle proofs in 5-10 seconds:

```javascript
// GPU-accelerated proof generation
class GPUProofService {
  constructor() {
    this.rapidsnarkPath = '/home/user/rapidsnark/build/prover';
    this.circuitWasm = './porto_auth.wasm';
    this.provingKey = './porto_auth_final.zkey';
  }
  
  async generateProof(emailInput) {
    // 1. Generate witness (CPU)
    console.time('Witness generation');
    const witness = await snarkjs.wtns.calculate(
      emailInput,
      this.circuitWasm
    );
    console.timeEnd('Witness generation'); // ~1-2s
    
    // 2. Generate proof (GPU)
    console.time('GPU proof generation');
    const { proof, publicSignals } = await this.runRapidsnark(
      witness,
      this.provingKey
    );
    console.timeEnd('GPU proof generation'); // ~5-10s on RTX 2060
    
    return { proof, publicSignals };
  }
  
  async runRapidsnark(witness, zkey) {
    // Save witness to temp file
    const witnessFile = `/tmp/witness_${Date.now()}.wtns`;
    await writeFile(witnessFile, witness);
    
    // Run rapidsnark with GPU
    const cmd = `${this.rapidsnarkPath} ${zkey} ${witnessFile} proof.json public.json`;
    await exec(cmd);
    
    // Read results
    const proof = JSON.parse(await readFile('proof.json'));
    const publicSignals = JSON.parse(await readFile('public.json'));
    
    // Cleanup
    await unlink(witnessFile);
    
    return { proof, publicSignals };
  }
}
```

### 7. Performance Optimization

For RTX 2060 (6GB VRAM):

```bash
# Monitor GPU usage
nvidia-smi dmon -s um

# Optimize circuit size
# Use smaller email sizes when possible
MAX_EMAIL_SIZE=4096  # Instead of 8192
MAX_HEADER_SIZE=512  # Instead of 1024

# Enable GPU memory pooling
export CUDA_VISIBLE_DEVICES=0
export CUDA_CACHE_MAXSIZE=2147483648  # 2GB cache

# Use optimized build flags
cmake -DUSE_GPU=ON -DUSE_CUDA_MULTI_PRECISION=ON
```

### 8. Load Testing

```javascript
// Load test your GPU server
async function loadTest() {
  const concurrency = 5; // RTX 2060 can handle ~5 concurrent proofs
  const iterations = 100;
  
  const times = [];
  
  for (let i = 0; i < iterations; i += concurrency) {
    const batch = Array(concurrency).fill().map(async () => {
      const start = Date.now();
      await generateProof(testEmail);
      return Date.now() - start;
    });
    
    const batchTimes = await Promise.all(batch);
    times.push(...batchTimes);
  }
  
  console.log('Average proof time:', average(times));
  console.log('Throughput:', (iterations / (sum(times) / 1000)).toFixed(2), 'proofs/sec');
}
```

### 9. Production Architecture

```
┌─────────────────┐
│   Email Server  │
│  (Send/Monitor) │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Queue  │ (Redis/RabbitMQ)
    └────┬────┘
         │
┌────────▼────────┐
│  GPU Prover     │
│  (RTX 2060)     │
│  - 5-10s/proof  │
│  - 5 concurrent │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Contract│ (Verify on-chain)
    └─────────┘
```

### 10. Monitoring & Alerts

```bash
# Setup Prometheus metrics
cat > metrics.js << EOF
const promClient = require('prom-client');

const proofGenerationTime = new promClient.Histogram({
  name: 'proof_generation_duration_seconds',
  help: 'Proof generation time in seconds',
  buckets: [1, 5, 10, 15, 20, 30]
});

const gpuUtilization = new promClient.Gauge({
  name: 'gpu_utilization_percent',
  help: 'GPU utilization percentage'
});

const gpuMemoryUsed = new promClient.Gauge({
  name: 'gpu_memory_used_mb',
  help: 'GPU memory used in MB'
});
EOF
```

## Expected Performance

With RTX 2060 (6GB VRAM):
- **Witness Generation**: 1-2 seconds (CPU)
- **Proof Generation**: 5-10 seconds (GPU)
- **Total Time**: 6-12 seconds per proof
- **Throughput**: ~300-500 proofs/hour
- **Concurrent Capacity**: 5 proofs

## Troubleshooting

### GPU Out of Memory
```bash
# Reduce batch size
export CUDA_BATCH_SIZE=1

# Clear GPU memory
nvidia-smi --gpu-reset
```

### Slow Proof Generation
- Check GPU utilization: `nvidia-smi`
- Ensure using Release build of rapidsnark
- Verify CUDA compute capability matches GPU

### DKIM Verification Failures
- Check email hasn't been modified
- Verify sender domain has valid DKIM
- Test with `openssl` to debug