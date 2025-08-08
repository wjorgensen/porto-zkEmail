// Dynamic import for @zk-email/sdk to handle module issues
let zkEmailSDK = null;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZkProofSnarkjs } from './zkProofSnarkjs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ZkProofService {
  constructor(logger) {
    this.logger = logger;
    this.sdk = null;
    this.blueprint = null;
    this.prover = null;
    this.isInitialized = false;
    
    // Use Snarkjs service for actual proof generation
    this.snarkjsService = new ZkProofSnarkjs(logger);
    
    // Using the actual registry UUID instead of slug
    this.blueprintSlug = 'IonTeLOS/MailAddressProver';
    this.blueprintId = 'e7d84ab3-68f3-46b4-a1af-f6c87611d423';
    
    this.blueprintConfig = {
      name: "MailAddressProver",
      values: [
        {
          parts: [
            { isPublic: false, regexDef: "(\r\n|^)subject:" },
            { isPublic: true, regexDef: "[^\r\n]+" },
            { isPublic: false, regexDef: "\r\n" }
          ],
          name: "subject",
          maxLength: 42,
          location: "header"
        },
        {
          parts: [
            { isPublic: false, regexDef: "(\r\n|^)from:[^\r\n]*@" },
            { isPublic: true, regexDef: "[A-Za-z0-9][A-Za-z0-9\\.-]+\\.[A-Za-z]{2,}" },
            { isPublic: false, regexDef: "[>\r\n]" }
          ],
          name: "sender_domain",
          maxLength: 8,
          location: "header"
        },
        {
          parts: [
            { isPublic: false, regexDef: "(\r\n|^)dkim-signature:" },
            { isPublic: false, regexDef: "([a-z]+=[^;]+; )+t=" },
            { isPublic: true, regexDef: "[0-9]+" },
            { isPublic: false, regexDef: ";" }
          ],
          name: "email_timestamp",
          maxLength: 10,
          location: "header"
        },
        {
          parts: [
            { isPublic: false, regexDef: "(\r\n|^)to:" },
            { isPublic: false, regexDef: "([^\r\n]+<)?" },
            { isPublic: true, regexDef: "[a-zA-Z0-9!#$%&\\*\\+-/=\\?\\^_`{\\|}~\\.]+@[a-zA-Z0-9_\\.-]+" },
            { isPublic: false, regexDef: ">?\r\n" }
          ],
          name: "email_recipient",
          maxLength: 64,
          location: "header"
        }
      ],
      version: 2,
      senderDomain: "poof.ing",
      ignoreBodyHashCheck: true,
      emailHeaderMaxLength: 1088
    };
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.logger.info('Initializing ZK Email Service...');
      
      // Initialize Snarkjs service first
      await this.snarkjsService.initialize();
      this.logger.info('Snarkjs service initialized');
      
      // Try to initialize SDK as well (optional)
      if (!zkEmailSDK) {
        try {
          const module = await import('@zk-email/sdk');
          zkEmailSDK = module.default || module;
        } catch (err) {
          this.logger.debug('SDK not available, using Snarkjs directly');
          zkEmailSDK = () => ({
            getBlueprint: async () => { throw new Error('SDK not available'); }
          });
        }
      }
      
      this.sdk = zkEmailSDK();
      
      try {
        // Try with slug first, then with ID
        this.logger.info(`Attempting to fetch blueprint: ${this.blueprintSlug}`);
        try {
          this.blueprint = await this.sdk.getBlueprint(this.blueprintSlug);
          this.logger.info('Blueprint fetched successfully from registry using slug');
        } catch (slugError) {
          this.logger.info(`Slug failed, trying with ID: ${this.blueprintId}`);
          this.blueprint = await this.sdk.getBlueprint(this.blueprintId);
          this.logger.info('Blueprint fetched successfully from registry using ID');
        }
      } catch (error) {
        this.logger.warn(`Could not fetch blueprint from registry: ${error.message}`);
        this.logger.info('Will use local configuration for now.');
        
        this.blueprint = {
          config: this.blueprintConfig,
          slug: this.blueprintSlug,
          createProver: () => ({
            generateProof: async (emailContent) => {
              this.logger.info('Generating mock proof (blueprint not deployed)');
              
              const extractedValues = this.extractValuesFromEmail(emailContent);
              
              return {
                publicInputs: extractedValues,
                proof: Buffer.from('mock_proof_data').toString('hex'),
                blueprint: this.blueprintSlug,
                timestamp: Date.now()
              };
            }
          }),
          verifyProof: async (proof) => {
            this.logger.info('Mock verification (blueprint not deployed)');
            return true;
          },
          getVerifierContractAddress: () => {
            return null;
          }
        };
      }
      
      this.prover = this.blueprint.createProver();
      
      this.isInitialized = true;
      this.logger.info('ZK Proof Service initialized successfully');
      
      if (this.blueprint.getVerifierContractAddress) {
        const verifierAddress = this.blueprint.getVerifierContractAddress();
        if (verifierAddress) {
          this.logger.info(`Verifier contract address: ${verifierAddress}`);
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to initialize ZK Proof Service:', error);
      throw error;
    }
  }

  extractValuesFromEmail(emailContent) {
    const values = {};
    
    const subjectMatch = emailContent.match(/subject:\s*([^\r\n]+)/i);
    if (subjectMatch) {
      values.subject = subjectMatch[1].trim();
    }
    
    const fromMatch = emailContent.match(/from:[^\r\n]*@([A-Za-z0-9][A-Za-z0-9\.-]+\.[A-Za-z]{2,})/i);
    if (fromMatch) {
      values.sender_domain = fromMatch[1];
    }
    
    const dkimMatch = emailContent.match(/dkim-signature:.*?t=(\d+);/is);
    if (dkimMatch) {
      values.email_timestamp = dkimMatch[1];
    }
    
    const toMatch = emailContent.match(/to:\s*(?:[^\r\n]+<)?([a-zA-Z0-9!#$%&\*\+-/=\?\^_`{\|}~\.]+@[a-zA-Z0-9_\.-]+)/i);
    if (toMatch) {
      values.email_recipient = toMatch[1];
    }
    
    return values;
  }

  async generateProof(emailContent, additionalInputs = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      this.logger.info('Starting proof generation...');
      
      // Use Snarkjs service for actual proof generation
      const proof = await this.snarkjsService.generateProof(emailContent);
      
      return proof;
    } catch (error) {
      this.logger.error('Failed to generate proof:', error);
      throw error;
    }
  }

  async verifyProof(proof) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Use Snarkjs service for verification
      const isValid = await this.snarkjsService.verifyProof(proof);
      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify proof:', error);
      throw error;
    }
  }

  async verifyProofOnChain(proof, chainId = 84532) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      this.logger.info(`Verifying proof on-chain (chainId: ${chainId})...`);
      
      if (!this.blueprint.verifyProofOnChain) {
        this.logger.warn('On-chain verification not available (blueprint may not be deployed)');
        return null;
      }
      
      const result = await this.blueprint.verifyProofOnChain(proof, { chainId });
      
      this.logger.info(`On-chain verification result: ${result ? 'VALID' : 'INVALID'}`);
      
      return result;
    } catch (error) {
      this.logger.error('Failed to verify proof on-chain:', error);
      
      if (error.message.includes('contract not deployed')) {
        this.logger.warn('Verifier contract not deployed on this chain');
        return null;
      }
      
      throw error;
    }
  }

  getVerifierContractAddress() {
    if (!this.blueprint || !this.blueprint.getVerifierContractAddress) {
      return null;
    }
    
    return this.blueprint.getVerifierContractAddress();
  }

  async processEmailForProof(email) {
    try {
      const emailContent = email.source || email.text || '';
      
      if (!emailContent) {
        throw new Error('No email content available for proof generation');
      }
      
      const extractedValues = this.extractValuesFromEmail(emailContent);
      this.logger.info('Extracted values from email:', extractedValues);
      
      const proof = await this.generateProof(emailContent);
      
      const verificationResult = await this.verifyProof(proof);
      
      return {
        proof,
        extractedValues,
        isValid: verificationResult,
        verifierContract: this.getVerifierContractAddress()
      };
    } catch (error) {
      this.logger.error('Failed to process email for proof:', error);
      throw error;
    }
  }
}