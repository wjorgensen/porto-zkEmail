import nodemailer from 'nodemailer';

export class EmailSender {
  constructor(logger) {
    this.logger = logger;
    
    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    
    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error('SMTP connection failed:', error);
      } else {
        this.logger.info('SMTP server ready');
      }
    });
  }
  
  async sendVerificationEmail({ to, code, challengeBody }) {
    const subject = `PORTO-AUTH-${code}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Porto Account Verification</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>To complete your registration, please reply to this email.</p>
        <p style="margin-top: 30px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; font-family: monospace; word-break: break-all;">
          ${challengeBody}
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated message. Please reply to verify your account.
        </p>
      </div>
    `;
    
    const text = `
Porto Account Verification

Your verification code is: ${code}

To complete your registration, please reply to this email.

${challengeBody}

This is an automated message. Please reply to verify your account.
    `;
    
    try {
      const info = await this.transporter.sendMail({
        from: `"Porto Auth" <yexfinance@gmail.com>`,
        to,
        subject,
        text,
        html,
        headers: {
          'X-Porto-Auth': code,
          'X-Porto-Nonce': challengeBody.split('|')[5]
        }
      });
      
      this.logger.info(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }
}