#!/bin/bash

# GPU Server Setup Script for zkEmail Proof Generation
# Tested on Ubuntu 20.04/22.04 with NVIDIA RTX 2060

set -e

echo "🚀 Setting up zkEmail GPU Proof Generation Server"
echo ""

# Check CUDA installation
if ! command -v nvidia-smi &> /dev/null; then
    echo "❌ NVIDIA drivers not found. Please install CUDA first:"
    echo "   https://developer.nvidia.com/cuda-downloads"
    exit 1
fi

echo "✅ NVIDIA GPU detected:"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
echo ""

# Create working directory
WORK_DIR="$HOME/porto-gpu-prover"
mkdir -p $WORK_DIR
cd $WORK_DIR

# Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    cmake \
    libgmp-dev \
    libsodium-dev \
    nasm \
    nlohmann-json3-dev \
    libssl-dev \
    git

# Install Node.js 18 if not present
if ! command -v node &> /dev/null || [ $(node -v | cut -d. -f1 | cut -dv -f2) -lt 18 ]; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Rust if not present
if ! command -v cargo &> /dev/null; then
    echo "🦀 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Clone and build RapidSnark with GPU support
echo "🏗️ Building RapidSnark with GPU support..."
if [ ! -d "rapidsnark" ]; then
    git clone https://github.com/iden3/rapidsnark.git
    cd rapidsnark
    git checkout v0.0.2  # Use stable version
    git submodule init
    git submodule update
    ./build_gmp.sh host
    mkdir -p build && cd build
    
    # Build with CUDA support
    cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=../package -DUSE_GPU=ON
    make -j$(nproc)
    make install
    cd ../..
else
    echo "RapidSnark already installed"
fi

# Install Circom
echo "⚡ Installing Circom..."
if ! command -v circom &> /dev/null; then
    git clone https://github.com/iden3/circom.git
    cd circom
    cargo build --release
    cargo install --path circom
    cd ..
else
    echo "Circom already installed"
fi

# Download zkEmail circuits
echo "📥 Downloading zkEmail circuits..."
if [ ! -d "zk-email-verify" ]; then
    git clone https://github.com/zkemail/zk-email-verify.git
    cd zk-email-verify
    npm install
    cd ..
fi

# Download Powers of Tau
echo "📥 Downloading Powers of Tau ceremony files..."
if [ ! -f "powersOfTau28_hez_final_21.ptau" ]; then
    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_21.ptau
fi

# Create Porto-specific circuit
echo "🔧 Creating Porto authentication circuit..."
mkdir -p circuits
cat > circuits/porto_auth.circom << 'EOF'
pragma circom 2.1.5;

include "../zk-email-verify/packages/circuits/email-verifier.circom";

template PortoAuth(max_header_bytes, max_body_bytes, n, k, ignore_body_hash_check) {
    signal input in_padded[max_header_bytes];
    signal input in_body_padded[max_body_bytes];
    signal input in_body_len;
    signal input in_padded_n_bytes;
    signal input in_body_padded_n_bytes;
    signal input pubkey[k];
    signal input signature[k];
    
    signal output pubkey_hash;
    signal output auth_code;
    signal output wallet_address;
    signal output action_type;
    signal output timestamp;
    
    // Email verifier base
    component ev = EmailVerifier(max_header_bytes, max_body_bytes, n, k, ignore_body_hash_check);
    ev.in_padded <== in_padded;
    ev.in_body_padded <== in_body_padded;
    ev.in_body_len <== in_body_len;
    ev.in_padded_n_bytes <== in_padded_n_bytes;
    ev.in_body_padded_n_bytes <== in_body_padded_n_bytes;
    ev.pubkey <== pubkey;
    ev.signature <== signature;
    
    // Extract auth code from subject
    component auth_code_regex = SubjectRegex(max_header_bytes);
    auth_code_regex.in <== in_padded;
    auth_code <== auth_code_regex.out;
    
    // Extract data from body
    component body_regex = BodyRegex(max_body_bytes);
    body_regex.in <== in_body_padded;
    wallet_address <== body_regex.wallet_address;
    action_type <== body_regex.action_type;
    timestamp <== body_regex.timestamp;
    
    pubkey_hash <== ev.pubkey_hash;
}

component main = PortoAuth(1024, 4096, 121, 17, 0);
EOF

# Compile circuit
echo "⚙️ Compiling Porto circuit..."
cd circuits
circom porto_auth.circom --r1cs --wasm --sym -o ../build

# Generate proving key
echo "🔑 Generating proving key (this may take a while)..."
cd ../build
snarkjs groth16 setup porto_auth.r1cs ../powersOfTau28_hez_final_21.ptau porto_auth_0001.zkey

# Contribute to ceremony
echo "🎲 Contributing randomness..."
snarkjs zkey contribute porto_auth_0001.zkey porto_auth_final.zkey \
    --name="Porto GPU Server" -v -e="$(head -n 4096 /dev/urandom | openssl sha256)"

# Export verification key
snarkjs zkey export verificationkey porto_auth_final.zkey verification_key.json

# Create GPU prover service
echo "🖥️ Creating GPU prover service..."
cd $WORK_DIR
mkdir -p service
cd service

# Initialize Node.js project
npm init -y
npm install express cors dotenv winston snarkjs

# Create the GPU prover service
cat > gpu-prover.js << 'EOF'
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as snarkjs from 'snarkjs';
import winston from 'winston';

const execAsync = promisify(exec);
const app = express();

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'gpu-prover.log' })
  ]
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

class GPUProver {
  constructor() {
    this.circuitWasm = '../build/porto_auth_js/porto_auth.wasm';
    this.circuitZkey = '../build/porto_auth_final.zkey';
    this.rapidsnarkPath = '../rapidsnark/package/bin/prover';
    this.vKey = JSON.parse(readFileSync('../build/verification_key.json', 'utf8'));
  }

  async generateProof(input) {
    const startTime = Date.now();
    
    try {
      // Generate witness
      logger.info('Generating witness...');
      const witnessFile = `/tmp/witness_${Date.now()}.wtns`;
      await snarkjs.wtns.calculate(input, this.circuitWasm, witnessFile);
      
      // Generate proof using GPU
      logger.info('Generating proof on GPU...');
      const proofFile = `/tmp/proof_${Date.now()}.json`;
      const publicFile = `/tmp/public_${Date.now()}.json`;
      
      const cmd = `${this.rapidsnarkPath} ${this.circuitZkey} ${witnessFile} ${proofFile} ${publicFile}`;
      
      const { stdout, stderr } = await execAsync(cmd);
      if (stderr) logger.warn('RapidSnark stderr:', stderr);
      
      // Read results
      const proof = JSON.parse(readFileSync(proofFile, 'utf8'));
      const publicSignals = JSON.parse(readFileSync(publicFile, 'utf8'));
      
      // Clean up temp files
      await execAsync(`rm ${witnessFile} ${proofFile} ${publicFile}`);
      
      const duration = Date.now() - startTime;
      logger.info(`Proof generated in ${duration}ms`);
      
      return {
        proof: formatProofForSolidity(proof),
        publicSignals,
        duration
      };
    } catch (error) {
      logger.error('Proof generation failed:', error);
      throw error;
    }
  }
}

function formatProofForSolidity(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]]
  };
}

const prover = new GPUProver();

// Health check
app.get('/health', async (req, res) => {
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader');
    const [gpuUtil, memUsed, memTotal] = stdout.trim().split(', ');
    
    res.json({
      status: 'healthy',
      gpu: {
        utilization: gpuUtil,
        memory: { used: memUsed, total: memTotal }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Generate proof endpoint
app.post('/generate-proof', async (req, res) => {
  try {
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: 'Missing input' });
    }
    
    const result = await prover.generateProof(input);
    res.json(result);
    
  } catch (error) {
    logger.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`GPU Prover Service running on port ${PORT}`);
});
EOF

# Create systemd service
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/porto-gpu-prover.service > /dev/null << EOF
[Unit]
Description=Porto GPU Proof Generation Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORK_DIR/service
ExecStart=/usr/bin/node gpu-prover.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3003

[Install]
WantedBy=multi-user.target
EOF

# Create benchmark script
cat > $WORK_DIR/benchmark.js << 'EOF'
const axios = require('axios');
const fs = require('fs');

async function benchmark() {
  console.log('Running GPU proof generation benchmark...\n');
  
  const testInput = {
    // Your test input here
  };
  
  const times = [];
  const iterations = 10;
  
  for (let i = 0; i < iterations; i++) {
    try {
      const start = Date.now();
      const response = await axios.post('http://localhost:3003/generate-proof', {
        input: testInput
      });
      const duration = response.data.duration;
      times.push(duration);
      console.log(`Iteration ${i + 1}: ${duration}ms`);
    } catch (error) {
      console.error(`Iteration ${i + 1} failed:`, error.message);
    }
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log('\nBenchmark Results:');
  console.log(`Average: ${avg.toFixed(2)}ms`);
  console.log(`Min: ${min}ms`);
  console.log(`Max: ${max}ms`);
}

benchmark();
EOF

echo ""
echo "✅ GPU Server Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Start the service:"
echo "   sudo systemctl start porto-gpu-prover"
echo "   sudo systemctl enable porto-gpu-prover"
echo ""
echo "2. Check service status:"
echo "   sudo systemctl status porto-gpu-prover"
echo ""
echo "3. View logs:"
echo "   journalctl -u porto-gpu-prover -f"
echo ""
echo "4. Test the service:"
echo "   curl http://localhost:3003/health"
echo ""
echo "5. Run benchmark:"
echo "   cd $WORK_DIR && node benchmark.js"
echo ""
echo "🚀 Your RTX 2060 GPU is ready for zkEmail proof generation!"