import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmailSender } from './emailSender.js';
import { EmailMonitor } from './emailMonitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: '../logs/server.log' })
  ]
});

// Initialize services
const emailSender = new EmailSender(logger);
const emailMonitor = new EmailMonitor(logger);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Send verification email
app.post('/send-verification', async (req, res) => {
  try {
    const { toEmail, action } = req.body;
    
    if (!toEmail || !action) {
      return res.status(400).json({ error: 'Missing required fields: toEmail and action' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate nonce for tracking
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Send email with simplified format
    const result = await emailSender.sendVerificationEmail({
      to: toEmail,
      code,
      action
    });
    
    // Start monitoring for reply
    try {
      await emailMonitor.addPendingVerification({
        email: toEmail,
        code,
        action,
        nonce,
        timestamp
      });
    } catch (error) {
      if (error.message.includes('already been used')) {
        return res.status(400).json({ error: 'This email verification has already been used' });
      }
      throw error;
    }
    
    res.json({
      success: true,
      messageId: result.messageId,
      code, // In production, don't return this
      nonce
    });
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Check verification status
app.get('/verification-status/:nonce', async (req, res) => {
  const { nonce } = req.params;
  const status = await emailMonitor.getVerificationStatus(nonce);
  
  if (!status) {
    // Log all pending verifications for debugging
    logger.info('Requested nonce:', nonce);
    logger.info('Pending verifications:', Array.from(emailMonitor.pendingVerifications.keys()));
    return res.status(404).json({ error: 'Verification not found' });
  }
  
  // Include ZK proof information if available
  const response = {
    ...status,
    hasZkProof: !!status.zkProof,
    verifierContract: status.verifierContract || null
  };
  
  res.json(response);
});

// Debug endpoint to manually check emails
app.get('/debug/check-emails', async (req, res) => {
  logger.info('Manually checking for new emails...');
  emailMonitor.fetchNewEmails();
  res.json({ message: 'Email check triggered' });
});

// Debug endpoint to see all pending verifications
app.get('/debug/pending', async (req, res) => {
  const pending = Array.from(emailMonitor.pendingVerifications.entries()).map(([nonce, data]) => ({
    nonce,
    ...data
  }));
  res.json({ pending });
});

// Get saved .eml files
app.get('/saved-emails', async (req, res) => {
  try {
    const emlDir = path.join(__dirname, '..', 'saved-emails');
    
    // Check if directory exists
    try {
      await fs.access(emlDir);
    } catch {
      return res.json({ emails: [], message: 'No emails saved yet' });
    }
    
    // List all .eml files
    const files = await fs.readdir(emlDir);
    const emlFiles = files.filter(f => f.endsWith('.eml'));
    
    // Get file details
    const emails = await Promise.all(emlFiles.map(async (filename) => {
      const filepath = path.join(emlDir, filename);
      const stats = await fs.stat(filepath);
      return {
        filename,
        path: filepath,
        size: stats.size,
        created: stats.birthtime,
        isLatest: filename === 'latest.eml'
      };
    }));
    
    // Sort by creation time, newest first
    emails.sort((a, b) => b.created - a.created);
    
    res.json({ 
      emails,
      savedDirectory: emlDir,
      latestEmail: emails.find(e => e.isLatest)?.path || null
    });
  } catch (error) {
    logger.error('Failed to list saved emails:', error);
    res.status(500).json({ error: 'Failed to list saved emails' });
  }
});

// Download a saved .eml file
app.get('/saved-emails/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(__dirname, '..', 'saved-emails', filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Email file not found' });
    }
    
    // Send the file
    res.download(filepath);
  } catch (error) {
    logger.error('Failed to download email:', error);
    res.status(500).json({ error: 'Failed to download email' });
  }
});

// Get proof data for a verification
app.get('/proof/:nonce', async (req, res) => {
  try {
    const { nonce } = req.params;
    const status = await emailMonitor.getVerificationStatus(nonce);
    
    if (!status) {
      return res.status(404).json({ error: 'Verification not found' });
    }
    
    if (!status.zkProof) {
      return res.status(404).json({ error: 'No proof available for this verification' });
    }
    
    res.json({
      proof: status.zkProof,
      extractedValues: status.extractedValues,
      verifierContract: status.verifierContract,
      verified: status.verified,
      timestamp: status.completedAt
    });
  } catch (error) {
    logger.error('Failed to get proof:', error);
    res.status(500).json({ error: 'Failed to get proof' });
  }
});

// Generate proof (manual trigger for testing)
app.post('/generate-proof', async (req, res) => {
  try {
    const { rawEmail } = req.body;
    
    if (!rawEmail) {
      return res.status(400).json({ error: 'Missing required field: rawEmail' });
    }
    
    // Initialize ZK Proof Service if needed
    if (!emailMonitor.zkProofService.isInitialized) {
      await emailMonitor.zkProofService.initialize();
    }
    
    // Generate proof directly
    const proofResult = await emailMonitor.zkProofService.processEmailForProof({ source: rawEmail });
    
    res.json({
      success: true,
      proof: proofResult.proof,
      extractedValues: proofResult.extractedValues,
      isValid: proofResult.isValid,
      verifierContract: proofResult.verifierContract
    });
  } catch (error) {
    logger.error('Failed to generate proof:', error);
    res.status(500).json({ error: error.message || 'Failed to generate proof' });
  }
});

// Start services
const PORT = process.env.EMAIL_SERVER_PORT || 3001;

async function start() {
  try {
    // Start email monitor
    await emailMonitor.start();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Email server running on port ${PORT}`);
    });
    
    // Cleanup is handled internally by emailMonitor with setTimeout
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down email server...');
      await emailMonitor.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();