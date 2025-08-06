import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import { EmailSender } from './emailSender.js';
import { EmailMonitor } from './emailMonitor.js';
import { ProofGenerator } from './proofGenerator.js';

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
const proofGenerator = new ProofGenerator(logger);

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
    const { toEmail, walletAddress, action, chainId } = req.body;
    
    if (!toEmail || !walletAddress || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate challenge data
    const nonce = Date.now();
    const timestamp = Math.floor(Date.now() / 1000);
    const challengeBody = `PORTO|${chainId || 31337}|${walletAddress}|${action}|0x0|${nonce}|${timestamp}|0x0`;
    
    // Send email
    const result = await emailSender.sendVerificationEmail({
      to: toEmail,
      code,
      challengeBody
    });
    
    // Start monitoring for reply
    try {
      await emailMonitor.addPendingVerification({
        email: toEmail,
        code,
        walletAddress,
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
  
  res.json(status);
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

// Generate proof (manual trigger for testing)
app.post('/generate-proof', async (req, res) => {
  try {
    const { emailContent, expectedCode } = req.body;
    
    const proof = await proofGenerator.generateProof({
      emailContent,
      expectedCode
    });
    
    res.json({ proof });
  } catch (error) {
    logger.error('Failed to generate proof:', error);
    res.status(500).json({ error: 'Failed to generate proof' });
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
    
    // Set up periodic cleanup
    setInterval(async () => {
      try {
        await emailMonitor.database.cleanupOldVerifications();
      } catch (error) {
        logger.error('Failed to cleanup old verifications:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
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