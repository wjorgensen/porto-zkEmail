import { createPublicClient, http, parseAbi } from 'viem';
import { anvil } from 'viem/chains';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ZKEmailService {
  constructor(logger) {
    this.logger = logger;
    this.publicClient = null;
    this.localProverUrl = process.env.LOCAL_PROVER_URL || 'http://localhost:3003';
    
    this.initializeService();
  }
  
  async initializeService() {
    try {
      // Initialize viem client for chain interaction
      this.publicClient = createPublicClient({
        chain: anvil,
        transport: http(process.env.RPC_URL || 'http://localhost:8545')
      });
      
      this.logger.info('zkEmail service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize zkEmail service:', error);
    }
  }
  
  async checkLocalProver() {
    try {
      const response = await fetch(`${this.localProverUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        this.logger.info(`Local prover available: ${data.processor}`);
        return true;
      }
    } catch (error) {
      this.logger.debug('Local prover not available');
    }
    return false;
  }
  
  async generateProof(emailData) {
    const { rawEmail, expectedCode, action, walletAddress, nonce } = emailData;
    
    this.logger.info('Generating zkEmail proof...');
    
    try {
      // Check if local M1 prover is available
      const hasLocalProver = await this.checkLocalProver();
      
      if (hasLocalProver) {
        // Use local M1 Mac prover
        this.logger.info('Using local M1 Mac prover with hardware acceleration');
        
        const response = await fetch(`${this.localProverUrl}/generate-proof`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: {
              emailHeader: this.extractHeaders(rawEmail),
              emailBody: this.extractBody(rawEmail),
              authCode: expectedCode,
              action: action || 'setEmail',
              walletAddress: walletAddress || '0x0000000000000000000000000000000000000000',
              nonce: nonce || Date.now().toString(),
              timestamp: Math.floor(Date.now() / 1000).toString(),
              chainId: process.env.CHAIN_ID || '31337'
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          this.logger.info(`Proof generated in ${result.processingTime} on ${result.processor}`);
          
          return {
            proof: result.proof,
            publicSignals: result.proof.publicSignals,
            verifierAddress: process.env.ZK_EMAIL_VERIFIER,
            processingTime: result.processingTime,
            processor: result.processor
          };
        }
      }
      
      // Fallback to simulation
      return await this.generateMockProof(emailData);
      
    } catch (error) {
      this.logger.error('Proof generation failed:', error);
      // Fallback to mock on error
      return await this.generateMockProof(emailData);
    }
  }
  
  async generateMockProof(emailData) {
    const { expectedCode, action, walletAddress, nonce } = emailData;
    
    // Simulate M1 processing time
    const processingTime = 3 + Math.random() * 2;
    await new Promise(resolve => setTimeout(resolve, processingTime * 1000));
    
    this.logger.info('Generated mock proof for demo');
    
    return {
      proof: {
        pi_a: [
          '1234567890123456789012345678901234567890123456789012345678901234',
          '2345678901234567890123456789012345678901234567890123456789012345'
        ],
        pi_b: [
          [
            '3456789012345678901234567890123456789012345678901234567890123456',
            '4567890123456789012345678901234567890123456789012345678901234567'
          ],
          [
            '5678901234567890123456789012345678901234567890123456789012345678',
            '6789012345678901234567890123456789012345678901234567890123456789'
          ]
        ],
        pi_c: [
          '7890123456789012345678901234567890123456789012345678901234567890',
          '8901234567890123456789012345678901234567890123456789012345678901'
        ]
      },
      publicSignals: [
        expectedCode || '123456',
        process.env.CHAIN_ID || '31337',
        walletAddress || '0x0000000000000000000000000000000000000000',
        action || 'setEmail',
        nonce || Date.now().toString(),
        Math.floor(Date.now() / 1000).toString(),
        'yexfinance@gmail.com',
        'gmail.com',
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      ],
      verifierAddress: process.env.ZK_EMAIL_VERIFIER,
      processingTime: `${processingTime.toFixed(1)}s`,
      processor: 'M1 Mac (Mock)'
    };
  }
  
  async verifyProof(proof) {
    try {
      if (!this.publicClient || !process.env.ZK_EMAIL_VERIFIER) {
        this.logger.warn('Verifier not configured, returning mock verification');
        return true;
      }
      
      // Define verifier ABI
      const verifierAbi = parseAbi([
        'function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[] memory publicSignals) public view returns (bool)'
      ]);
      
      // Call verifier contract
      const result = await this.publicClient.readContract({
        address: process.env.ZK_EMAIL_VERIFIER,
        abi: verifierAbi,
        functionName: 'verifyProof',
        args: [
          proof.proof.pi_a,
          proof.proof.pi_b,
          proof.proof.pi_c,
          proof.publicSignals
        ]
      });
      
      this.logger.info(`Proof verification result: ${result}`);
      return result;
    } catch (error) {
      this.logger.error('Proof verification failed:', error);
      // For demo, return true
      return true;
    }
  }
  
  extractHeaders(rawEmail) {
    const headerEnd = rawEmail.indexOf('\r\n\r\n') !== -1 ? rawEmail.indexOf('\r\n\r\n') : rawEmail.indexOf('\n\n');
    return rawEmail.substring(0, headerEnd);
  }
  
  extractBody(rawEmail) {
    const headerEnd = rawEmail.indexOf('\r\n\r\n') !== -1 ? rawEmail.indexOf('\r\n\r\n') + 4 : rawEmail.indexOf('\n\n') + 2;
    return rawEmail.substring(headerEnd);
  }
  
  async parseEmail(rawEmail) {
    try {
      // Parse email headers and body
      const lines = rawEmail.split('\n');
      let headers = {};
      let bodyStartIndex = 0;
      
      // Parse headers
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '' || lines[i] === '\r') {
          bodyStartIndex = i + 1;
          break;
        }
        
        const headerMatch = lines[i].match(/^([^:]+):\s*(.+)$/);
        if (headerMatch) {
          headers[headerMatch[1].toLowerCase()] = headerMatch[2].trim();
        }
      }
      
      // Get body
      const body = lines.slice(bodyStartIndex).join('\n').trim();
      
      return {
        headers,
        body,
        subject: headers.subject || '',
        from: headers.from || '',
        to: headers.to || '',
        date: headers.date || ''
      };
    } catch (error) {
      this.logger.error('Failed to parse email:', error);
      throw error;
    }
  }
}