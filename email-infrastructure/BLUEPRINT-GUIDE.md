# zkEmail Blueprint Guide

## What is a zkEmail Blueprint?

A blueprint is a configuration that defines:
1. **What emails to verify** (email query patterns)
2. **What data to extract** (regex patterns)
3. **What to make public** (public inputs)
4. **Circuit parameters** (email size, etc.)

## Blueprint Structure

```typescript
{
  // Unique identifier
  "id": "porto-auth-v1",
  
  // Human-readable name
  "name": "Porto Authentication",
  
  // Version for updates
  "version": "1.0.0",
  
  // Email filtering criteria
  "emailQuery": {
    "subject": "PORTO-AUTH-*",      // Subject pattern
    "from": "verify@porto.app",     // Sender email
    "to": "*",                      // Recipient pattern
    "domain": "gmail.com"           // Email domain
  },
  
  // Data extraction patterns
  "extractors": [
    {
      "name": "authCode",
      "regex": "PORTO-AUTH-([0-9]{6})",
      "location": "subject",
      "maxLength": 6
    },
    {
      "name": "walletAddress",
      "regex": "PORTO\\|[0-9]+\\|([0-9a-fA-Fx]+)\\|",
      "location": "body",
      "maxLength": 42
    },
    {
      "name": "action",
      "regex": "PORTO\\|[0-9]+\\|[^|]+\\|([^|]+)\\|",
      "location": "body",
      "maxLength": 32
    },
    {
      "name": "timestamp",
      "regex": "PORTO\\|[0-9]+\\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|([0-9]+)\\|",
      "location": "body",
      "maxLength": 10
    }
  ],
  
  // Which extracted values become public circuit inputs
  "publicInputs": [
    "authCode",
    "walletAddress",
    "action",
    "emailFromAddress",    // Built-in
    "emailDomain",         // Built-in
    "emailTimestamp"       // Built-in
  ],
  
  // Circuit parameters
  "circuitParams": {
    "maxEmailSize": 8192,      // Max email size in bytes
    "maxHeaderSize": 1024,     // Max header size
    "maxBodySize": 7168,       // Max body size
    "shaPrecomputeSelector": true,
    "removeSoftLineBreaks": true,
    "ignoreBodyHashCheck": false
  },
  
  // DKIM verification parameters
  "dkimParams": {
    "headerSelector": "google",
    "maxSignatureLength": 1024,
    "publicKeyModulusLength": 2048
  }
}
```

## Creating a Blueprint for Porto

### Step 1: Define Email Pattern

For Porto auth, we need emails with:
- Subject: `PORTO-AUTH-123456` (6-digit code)
- Body containing: `PORTO|chainId|wallet|action|keyHash|nonce|timestamp|keyId`

### Step 2: Write Regex Extractors

```javascript
// Extract 6-digit code from subject
const authCodeRegex = /PORTO-AUTH-([0-9]{6})/;

// Extract challenge data from body
// Format: PORTO|31337|0x123...|setEmail|0x0|1234567890|1234567890|0x0
const challengeRegex = /PORTO\|(\d+)\|([0-9a-fA-Fx]+)\|(\w+)\|([0-9a-fA-Fx]+)\|(\d+)\|(\d+)\|([0-9a-fA-Fx]+)/;
```

### Step 3: Register Blueprint

```bash
# Install zkEmail CLI
npm install -g @zk-email/cli

# Create blueprint file
cat > porto-auth-blueprint.json << EOF
{
  "id": "porto-auth-v1",
  "name": "Porto Authentication",
  "version": "1.0.0",
  "emailQuery": {
    "subject": "PORTO-AUTH-*",
    "from": "${GMAIL_USER}"
  },
  "extractors": [
    {
      "name": "authCode",
      "regex": "PORTO-AUTH-([0-9]{6})",
      "location": "subject",
      "maxLength": 6
    },
    {
      "name": "chainId",
      "regex": "PORTO\\\\|([0-9]+)\\\\|",
      "location": "body",
      "maxLength": 10
    },
    {
      "name": "walletAddress",
      "regex": "PORTO\\\\|[0-9]+\\\\|([0-9a-fA-Fx]+)\\\\|",
      "location": "body",
      "maxLength": 42
    },
    {
      "name": "action",
      "regex": "PORTO\\\\|[0-9]+\\\\|[^|]+\\\\|([^|]+)\\\\|",
      "location": "body",
      "maxLength": 32
    }
  ],
  "publicInputs": ["authCode", "chainId", "walletAddress", "action"],
  "circuitParams": {
    "maxEmailSize": 8192,
    "maxHeaderSize": 1024,
    "maxBodySize": 7168
  }
}
EOF

# Register blueprint (testnet)
zkemail blueprint register porto-auth-blueprint.json --chain sepolia
```

## Setting Up Proof Generation Service

### Prerequisites for GPU Server

1. **NVIDIA Driver & CUDA**:
   ```bash
   # Check CUDA version
   nvidia-smi
   
   # Should show CUDA 11.x or 12.x
   ```

2. **Node.js 18+**:
   ```bash
   node --version
   ```

3. **RapidSnark GPU**:
   ```bash
   # Install dependencies
   sudo apt-get update
   sudo apt-get install build-essential cmake libgmp-dev libsodium-dev nasm
   
   # Clone and build rapidsnark
   git clone https://github.com/iden3/rapidsnark.git
   cd rapidsnark
   npm install
   git submodule init
   git submodule update
   ./build_gmp.sh host
   mkdir build && cd build
   cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package
   make -j$(nproc) && make install
   ```

### Circuit Setup

1. **Download zkEmail Circuits**:
   ```bash
   # Create circuits directory
   mkdir -p ~/porto-circuits
   cd ~/porto-circuits
   
   # Download pre-compiled circuits (if available)
   # Or compile from source
   git clone https://github.com/zkemail/zk-email-verify.git
   cd zk-email-verify
   ```

2. **Generate Circuit Files**:
   ```bash
   # Install circom
   curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
   source $HOME/.cargo/env
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom
   
   # Compile circuit
   circom circuits/email_auth.circom \
     --r1cs --wasm --sym \
     -o ./build \
     -l ./node_modules
   
   # Generate proving key (this takes time and memory!)
   snarkjs groth16 setup build/email_auth.r1cs powersOfTau28_hez_final_21.ptau email_auth_0001.zkey
   
   # Contribute to ceremony
   snarkjs zkey contribute email_auth_0001.zkey email_auth_final.zkey --name="Porto" -v
   
   # Export verification key
   snarkjs zkey export verificationkey email_auth_final.zkey verification_key.json
   ```

### GPU Proof Generation Server

```javascript
// gpu-prover.js
import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import express from 'express';

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

class GPUProver {
  constructor() {
    this.circuitWasm = './build/email_auth_js/email_auth.wasm';
    this.circuitZkey = './email_auth_final.zkey';
    this.rapidsnarkPath = '~/rapidsnark/package/bin/prover';
  }

  async generateProof(input) {
    // Step 1: Generate witness
    const witness = await this.generateWitness(input);
    
    // Step 2: Generate proof using GPU
    const proof = await this.generateProofGPU(witness);
    
    return proof;
  }

  async generateWitness(input) {
    // Use snarkjs to generate witness
    const { wtns } = await snarkjs.wtns.calculate(
      input,
      this.circuitWasm
    );
    
    // Save witness to file
    await fs.writeFile('./witness.wtns', wtns);
    
    return './witness.wtns';
  }

  async generateProofGPU(witnessPath) {
    // Use rapidsnark for GPU acceleration
    const cmd = `${this.rapidsnarkPath} ${this.circuitZkey} ${witnessPath} proof.json public.json`;
    
    console.time('GPU Proof Generation');
    await execAsync(cmd);
    console.timeEnd('GPU Proof Generation');
    
    // Read proof and public inputs
    const proof = JSON.parse(readFileSync('./proof.json', 'utf8'));
    const publicSignals = JSON.parse(readFileSync('./public.json', 'utf8'));
    
    return { proof, publicSignals };
  }
}

const prover = new GPUProver();

app.post('/generate-proof', async (req, res) => {
  try {
    const { emailContent, blueprint } = req.body;
    
    // Parse email and extract data
    const input = await parseEmailForCircuit(emailContent, blueprint);
    
    // Generate proof on GPU
    const { proof, publicSignals } = await prover.generateProof(input);
    
    res.json({
      proof: formatProofForSolidity(proof),
      publicInputs: publicSignals,
      generationTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Proof generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3002, () => {
  console.log('GPU Proof Generation Server running on port 3002');
});
```

### Performance Optimization

1. **Circuit Optimization**:
   ```javascript
   // Use smaller email sizes when possible
   const circuitParams = {
     maxEmailSize: 4096,  // Reduced from 8192
     maxHeaderSize: 512,  // Reduced from 1024
     shaPrecomputeSelector: true  // Precompute SHA
   };
   ```

2. **GPU Memory Management**:
   ```bash
   # Monitor GPU usage
   nvidia-smi -l 1
   
   # Set CUDA visible devices
   export CUDA_VISIBLE_DEVICES=0
   ```

3. **Batch Processing**:
   ```javascript
   // Process multiple proofs in parallel
   const batchProver = new BatchGPUProver({
     maxBatchSize: 10,
     gpuMemoryLimit: 0.8  // Use 80% of GPU memory
   });
   ```

## Complete Production Setup

### 1. Blueprint Registration

```bash
# 1. Create blueprint JSON
cat > blueprint.json << EOF
{
  "id": "porto-auth-v1",
  "name": "Porto Authentication",
  "version": "1.0.0",
  "emailQuery": {
    "subject": "PORTO-AUTH-*",
    "from": "verify@porto.app"
  },
  "extractors": [...],
  "publicInputs": [...],
  "circuitParams": {
    "maxEmailSize": 4096
  }
}
EOF

# 2. Register on zkEmail Registry
zkemail blueprint register blueprint.json --chain base-sepolia

# 3. Get blueprint ID and verifier address
zkemail blueprint status porto-auth-v1
```

### 2. Deploy Verifier Contract

```solidity
// PortoEmailVerifier.sol
pragma solidity ^0.8.0;

import "@zk-email/contracts/DKIMRegistry.sol";
import "@zk-email/contracts/Groth16Verifier.sol";

contract PortoEmailVerifier is Groth16Verifier {
    DKIMRegistry public dkimRegistry;
    bytes32 public blueprintId;
    
    constructor(address _dkimRegistry, bytes32 _blueprintId) {
        dkimRegistry = DKIMRegistry(_dkimRegistry);
        blueprintId = _blueprintId;
    }
    
    function verifyEmailProof(
        uint256[8] calldata proof,
        uint256[] calldata publicInputs
    ) external view returns (bool) {
        // Verify DKIM signature
        require(
            dkimRegistry.isDKIMPublicKeyHashValid(
                publicInputs[0], // domain
                publicInputs[1]  // publicKeyHash
            ),
            "Invalid DKIM"
        );
        
        // Verify Groth16 proof
        return verifyProof(proof, publicInputs);
    }
}
```

### 3. Production Server Architecture

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
          ┌─────────────────┴─────────────────┐
          │                                   │
    ┌─────┴──────┐                     ┌─────┴──────┐
    │ API Server │                     │ API Server │
    └─────┬──────┘                     └─────┬──────┘
          │                                   │
          └─────────────┬─────────────────────┘
                        │
                ┌───────┴────────┐
                │  Redis Queue   │
                └───────┬────────┘
                        │
      ┌─────────────────┼─────────────────┐
      │                 │                 │
┌─────┴──────┐    ┌─────┴──────┐   ┌─────┴──────┐
│ GPU Worker │    │ GPU Worker │   │ GPU Worker │
│  (RTX 2060)│    │  (Future)  │   │  (Future)  │
└────────────┘    └────────────┘   └────────────┘
```

## Testing Your Setup

1. **Test Circuit**:
   ```bash
   # Generate test input
   node generate-test-input.js > input.json
   
   # Test witness generation
   snarkjs wtns calculate circuit.wasm input.json witness.wtns
   
   # Test proof generation
   time ~/rapidsnark/package/bin/prover circuit.zkey witness.wtns proof.json public.json
   ```

2. **Benchmark GPU Performance**:
   ```bash
   # Should be < 10 seconds for RTX 2060
   for i in {1..10}; do
     time ./generate-proof.sh test-email-$i.eml
   done
   ```

Your RTX 2060 should handle zkEmail proofs in 5-10 seconds depending on email size!