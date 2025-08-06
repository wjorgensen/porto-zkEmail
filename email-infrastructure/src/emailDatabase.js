import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EmailDatabase {
  constructor(logger) {
    this.logger = logger;
    this.db = null;
  }

  async initialize() {
    try {
      // Open database
      this.db = await open({
        filename: path.join(__dirname, '../data/email_proofs.db'),
        driver: sqlite3.Database
      });

      // Create tables if they don't exist
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS email_proofs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email_hash TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          action TEXT NOT NULL,
          nonce TEXT NOT NULL UNIQUE,
          proof TEXT,
          status TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          UNIQUE(email_hash, code_hash)
        );

        CREATE INDEX IF NOT EXISTS idx_email_hash ON email_proofs(email_hash);
        CREATE INDEX IF NOT EXISTS idx_nonce ON email_proofs(nonce);
        CREATE INDEX IF NOT EXISTS idx_status ON email_proofs(status);
      `);

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async hasEmailBeenUsed(emailHash, codeHash) {
    const result = await this.db.get(
      'SELECT id FROM email_proofs WHERE email_hash = ? AND code_hash = ? AND status = ?',
      [emailHash, codeHash, 'completed']
    );
    return !!result;
  }

  async createVerification(verification) {
    const { emailHash, codeHash, walletAddress, action, nonce } = verification;
    
    // Check if this email/code combination has been used
    if (await this.hasEmailBeenUsed(emailHash, codeHash)) {
      throw new Error('This email verification has already been used');
    }

    await this.db.run(
      `INSERT INTO email_proofs (email_hash, code_hash, wallet_address, action, nonce, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [emailHash, codeHash, walletAddress, action, nonce, 'pending']
    );
  }

  async updateVerificationStatus(nonce, status, proof = null) {
    const updates = ['status = ?'];
    const params = [status];

    if (proof) {
      updates.push('proof = ?');
      params.push(JSON.stringify(proof));
    }

    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    params.push(nonce);

    await this.db.run(
      `UPDATE email_proofs SET ${updates.join(', ')} WHERE nonce = ?`,
      params
    );
  }

  async getVerification(nonce) {
    return await this.db.get(
      'SELECT * FROM email_proofs WHERE nonce = ?',
      [nonce]
    );
  }

  async cleanupOldVerifications() {
    // Delete pending verifications older than 30 minutes
    await this.db.run(
      `DELETE FROM email_proofs 
       WHERE status = 'pending' 
       AND datetime(created_at) < datetime('now', '-30 minutes')`
    );
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}