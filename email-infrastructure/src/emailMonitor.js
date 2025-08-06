import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { ZKEmailService } from './zkEmailServiceSimple.js';
import { EmailDatabase } from './emailDatabase.js';
import { hashEmail, hashCode } from './utils/crypto.js';

export class EmailMonitor {
  constructor(logger) {
    this.logger = logger;
    this.pendingVerifications = new Map();
    this.zkEmailService = new ZKEmailService(logger);
    this.database = new EmailDatabase(logger);
    this.isRunning = false;
    
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
    
    // Initialize database
    await this.database.initialize();
    
    // Load pending verifications from database
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
    await this.database.close();
  }
  
  async loadPendingVerifications() {
    // This loads any pending verifications from the database
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
        markSeen: false  // Don't mark as seen until processed
      });
      
      fetch.on('message', (msg, seqno) => {
        msg.on('body', (stream, info) => {
          simpleParser(stream, async (err, parsed) => {
            if (err) {
              this.logger.error('Parse error:', err);
              return;
            }
            
            await this.processEmail(parsed);
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
      
      // Hash email and code for database lookup
      const emailHash = hashEmail(fromEmail);
      const codeHash = hashCode(code);
      
      // Check if this email/code combination has already been used
      if (await this.database.hasEmailBeenUsed(emailHash, codeHash)) {
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
      
      // Update status in database
      await this.database.updateVerificationStatus(verification.nonce, 'generating_proof');
      
      // Generate proof
      try {
        // Get raw email for zkEmail proof
        const rawEmail = email.source || this.reconstructRawEmail(email);
        
        const proof = await this.zkEmailService.generateProof({
          rawEmail,
          expectedCode: code,
          action: verification.action || 'setEmail',
          walletAddress: verification.walletAddress,
          nonce: verification.nonce
        });
        
        // Update with proof in memory
        this.pendingVerifications.set(verification.nonce, {
          ...verification,
          status: 'completed',
          proof,
          completedAt: new Date().toISOString()
        });
        
        // Update in database with proof
        await this.database.updateVerificationStatus(verification.nonce, 'completed', proof);
        
        this.logger.info(`Proof generated for ${fromEmail}`);
      } catch (error) {
        this.logger.error('Proof generation failed:', error);
        this.pendingVerifications.set(verification.nonce, {
          ...verification,
          status: 'failed',
          error: error.message
        });
        await this.database.updateVerificationStatus(verification.nonce, 'failed');
      }
    } catch (error) {
      this.logger.error('Failed to process email:', error);
    }
  }
  
  async addPendingVerification(verification) {
    const emailHash = hashEmail(verification.email);
    const codeHash = hashCode(verification.code);
    
    try {
      // Add to database first
      await this.database.createVerification({
        emailHash,
        codeHash,
        walletAddress: verification.walletAddress,
        action: verification.action,
        nonce: verification.nonce
      });
      
      // Then add to memory
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
    
    // If still not found, check database
    if (!status) {
      const dbRecord = await this.database.getVerification(nonce);
      if (dbRecord) {
        status = {
          email: 'hidden', // Don't expose email from DB
          status: dbRecord.status,
          proof: dbRecord.proof ? JSON.parse(dbRecord.proof) : null,
          createdAt: dbRecord.created_at,
          completedAt: dbRecord.completed_at
        };
      }
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
}