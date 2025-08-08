import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { hashEmail, hashCode } from './utils/crypto.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZkProofService } from './zkProofService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class EmailMonitor {
  constructor(logger) {
    this.logger = logger;
    this.pendingVerifications = new Map();
    this.isRunning = false;
    this.processedEmails = new Set(); // Track processed email IDs
    this.zkProofService = new ZkProofService(logger);
    
    // Configure IMAP
    this.imap = new Imap({
      user: process.env.GMAIL_USER,
      password: process.env.GMAIL_APP_PASSWORD,
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.imap.on('ready', () => {
      this.logger.info('IMAP connection ready');
      this.openInbox();
    });
    
    this.imap.on('error', (err) => {
      this.logger.error('IMAP error:', err);
    });
    
    this.imap.on('end', () => {
      this.logger.info('IMAP connection ended');
      this.isRunning = false;
    });
  }
  
  async start() {
    if (this.isRunning) return;
    
    // Initialize ZK Proof Service
    await this.zkProofService.initialize();
    
    // Load pending verifications
    await this.loadPendingVerifications();
    
    this.isRunning = true;
    this.imap.connect();
  }
  
  async stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.imap.end();
  }
  
  async loadPendingVerifications() {
    // This loads any pending verifications
    // We don't need to do this since we're tracking by nonce
  }
  
  openInbox() {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        this.logger.error('Failed to open inbox:', err);
        return;
      }
      
      this.logger.info('Inbox opened, monitoring for new emails');
      this.startMonitoring();
    });
  }
  
  startMonitoring() {
    // Monitor for new emails
    this.imap.on('mail', (numNewMail) => {
      this.logger.info(`${numNewMail} new email(s) received`);
      this.fetchNewEmails();
    });
    
    // Check existing unread emails
    this.fetchNewEmails();
    
    // Also poll every 5 seconds as backup
    this.pollInterval = setInterval(() => {
      this.logger.debug('Polling for new emails...');
      this.fetchNewEmails();
    }, 5000);
  }
  
  fetchNewEmails() {
    // Search for unseen emails with PORTO-AUTH in subject (including replies)
    const searchCriteria = ['UNSEEN', ['OR', ['SUBJECT', 'PORTO-AUTH'], ['SUBJECT', 'Re: PORTO-AUTH']]];
    
    this.imap.search(searchCriteria, (err, results) => {
      if (err) {
        this.logger.error('Search error:', err);
        return;
      }
      
      if (results.length === 0) {
        this.logger.debug('No new emails found');
        return;
      }
      
      this.logger.info(`Found ${results.length} new email(s) to process`);
      
      const fetch = this.imap.fetch(results, {
        bodies: '',
        markSeen: true  // Mark as seen after processing to avoid re-processing
      });
      
      fetch.on('message', (msg, seqno) => {
        let rawEmailBuffer = Buffer.alloc(0);
        
        msg.on('body', (stream, info) => {
          // Collect the raw email data
          stream.on('data', (chunk) => {
            rawEmailBuffer = Buffer.concat([rawEmailBuffer, chunk]);
          });
          
          stream.on('end', async () => {
            const rawEmail = rawEmailBuffer.toString('utf8');
            
            // Also parse it for easier access
            simpleParser(rawEmail, async (err, parsed) => {
              if (err) {
                this.logger.error('Parse error:', err);
                return;
              }
              
              // Add the raw email to the parsed object
              parsed.source = rawEmail;
              
              await this.processEmail(parsed);
            });
          });
        });
      });
      
      fetch.on('error', (err) => {
        this.logger.error('Fetch error:', err);
      });
    });
  }
  
  async processEmail(email) {
    try {
      // Extract code from subject
      const subjectMatch = email.subject?.match(/PORTO-AUTH-(\d{6})/);
      if (!subjectMatch) {
        this.logger.warn('Invalid subject format:', email.subject);
        return;
      }
      
      const code = subjectMatch[1];
      const fromEmail = email.from?.value[0]?.address;
      
      // Create unique ID for this email to prevent duplicate processing
      const emailId = `${email.messageId || ''}_${code}_${fromEmail}`;
      if (this.processedEmails.has(emailId)) {
        this.logger.debug(`Email already processed: ${emailId}`);
        return;
      }
      this.processedEmails.add(emailId);
      
      // Save the raw email as .eml file for testing (only once)
      await this.saveEmailAsEml(email, code, fromEmail);
      
      // Hash email and code for database lookup
      const emailHash = hashEmail(fromEmail);
      const codeHash = hashCode(code);
      
      // Check if this email/code combination has already been used
      // (Tracking in memory for now)
      const verificationKey = `${emailHash}_${codeHash}`;
      if (this.processedEmails.has(verificationKey)) {
        this.logger.warn(`Email verification already used: ${fromEmail} with code ${code}`);
        return;
      }
      
      // Find pending verification
      let verification = null;
      for (const [nonce, pending] of this.pendingVerifications) {
        if (pending.email === fromEmail && pending.code === code) {
          verification = { nonce, ...pending };
          break;
        }
      }
      
      if (!verification) {
        this.logger.warn(`No pending verification found for ${fromEmail} with code ${code}`);
        return;
      }
      
      this.logger.info(`Processing verification for ${fromEmail}`);
      
      // Update status in memory
      this.pendingVerifications.set(verification.nonce, {
        ...verification,
        status: 'generating_proof',
        emailReceived: true
      });
      
      // Generate ZK proof
      try {
        this.logger.info('Generating ZK proof for email verification...');
        
        const proofResult = await this.zkProofService.processEmailForProof(email);
        
        this.logger.info('ZK Proof generated successfully:', {
          isValid: proofResult.isValid,
          extractedValues: proofResult.extractedValues,
          verifierContract: proofResult.verifierContract
        });
        
        // Update status to show email was verified with proof
        this.pendingVerifications.set(verification.nonce, {
          ...verification,
          status: 'verified',
          verified: true,
          emailReceived: true,
          zkProof: proofResult.proof,
          extractedValues: proofResult.extractedValues,
          verifierContract: proofResult.verifierContract,
          completedAt: new Date().toISOString()
        });
        
        // Save proof alongside the email
        const proofPath = path.join(__dirname, '..', 'saved-emails', `proof_${code}_${fromEmail.replace(/[@.]/g, '_')}.json`);
        await fs.writeFile(proofPath, JSON.stringify(proofResult, null, 2));
        this.logger.info(`ZK Proof saved to: ${proofPath}`);
        
      } catch (proofError) {
        this.logger.error('Failed to generate ZK proof:', proofError);
        
        // Still mark as verified but note the proof generation failed
        this.pendingVerifications.set(verification.nonce, {
          ...verification,
          status: 'verified_no_proof',
          verified: true,
          emailReceived: true,
          proofError: proofError.message,
          completedAt: new Date().toISOString()
        });
      }
      
      
      this.logger.info(`Email verified for ${fromEmail} - .eml file saved for zkEmail registry upload`);
    } catch (error) {
      this.logger.error('Failed to process email:', error);
    }
  }
  
  async addPendingVerification(verification) {
    const emailHash = hashEmail(verification.email);
    const codeHash = hashCode(verification.code);
    
    try {
      // Add to memory
      this.pendingVerifications.set(verification.nonce, {
        ...verification,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      // Clean up old verifications after 30 minutes
      setTimeout(() => {
        this.pendingVerifications.delete(verification.nonce);
      }, 30 * 60 * 1000);
    } catch (error) {
      if (error.message.includes('already been used')) {
        throw error;
      }
      this.logger.error('Failed to add pending verification:', error);
      throw error;
    }
  }
  
  async getVerificationStatus(nonce) {
    // Try memory first
    let status = this.pendingVerifications.get(nonce);
    
    // If not found, try as number
    if (!status && !isNaN(nonce)) {
      status = this.pendingVerifications.get(Number(nonce));
    }
    
    // If still not found, return null
    if (!status) {
      status = null;
    }
    
    return status;
  }
  
  reconstructRawEmail(parsed) {
    // Reconstruct raw email from parsed data if source is not available
    let raw = '';
    
    // Add headers
    if (parsed.headers) {
      for (const [key, value] of parsed.headers) {
        raw += `${key}: ${value}\r\n`;
      }
    }
    
    // Add blank line between headers and body
    raw += '\r\n';
    
    // Add body
    if (parsed.text) {
      raw += parsed.text;
    } else if (parsed.html) {
      raw += parsed.html;
    }
    
    return raw;
  }
  
  async saveEmailAsEml(email, code, fromEmail) {
    try {
      // Create directory for saved emails if it doesn't exist
      const emlDir = path.join(__dirname, '..', 'saved-emails');
      await fs.mkdir(emlDir, { recursive: true });
      
      // Get raw email source (should be properly captured now)
      const rawEmail = email.source;
      if (!rawEmail) {
        this.logger.error('No raw email source available to save');
        return;
      }
      
      // Create filename with timestamp and code for easy identification
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeEmail = fromEmail.replace(/[@.]/g, '_');
      const filename = `porto_auth_${code}_${safeEmail}_${timestamp}.eml`;
      const filepath = path.join(emlDir, filename);
      
      // Save the email
      await fs.writeFile(filepath, rawEmail, 'utf8');
      
      this.logger.info('═══════════════════════════════════════════════════════════════');
      this.logger.info('📧 EMAIL SAVED FOR ZK EMAIL REGISTRY TESTING');
      this.logger.info('═══════════════════════════════════════════════════════════════');
      this.logger.info(`File: ${filepath}`);
      this.logger.info(`Auth Code: ${code}`);
      this.logger.info(`From: ${fromEmail}`);
      this.logger.info('');
      this.logger.info('You can now upload this .eml file to https://registry.zk.email');
      this.logger.info('when creating or testing your blueprint!');
      this.logger.info('═══════════════════════════════════════════════════════════════');
      
      // Also save a "latest.eml" for convenience
      const latestPath = path.join(emlDir, 'latest.eml');
      await fs.writeFile(latestPath, rawEmail, 'utf8');
      this.logger.info(`Also saved as: ${latestPath} (for quick access)`);
      this.logger.info('');
      
    } catch (error) {
      this.logger.error('Failed to save email as .eml:', error);
    }
  }
}