# Porto Email Infrastructure

This service handles email sending, monitoring, and zkEmail proof generation for Porto account verification.

## Quick Start

1. **Setup Gmail Account**
   - Create a new Gmail account
   - Enable 2FA and generate an app password
   - See `setup.md` for detailed instructions

2. **Configure Environment**
   ```bash
   cp .env.sample .env
   # Edit .env with your Gmail credentials
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start the Server**
   ```bash
   npm start
   ```

## API Endpoints

### POST /send-verification
Send a verification email to a user.

**Request Body:**
```json
{
  "toEmail": "user@example.com",
  "walletAddress": "0x...",
  "action": "setEmail",
  "chainId": 31337
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "...",
  "code": "123456",
  "nonce": 1234567890
}
```

### GET /verification-status/:nonce
Check the status of a verification.

**Response:**
```json
{
  "status": "pending" | "generating_proof" | "completed" | "failed",
  "emailReceived": true,
  "proof": { ... },
  "error": "..."
}
```

### POST /generate-proof
Manually trigger proof generation (for testing).

**Request Body:**
```json
{
  "emailContent": "...",
  "expectedCode": "123456"
}
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│ Email Server │────▶│    Gmail    │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            │                     ▼
                            │              ┌─────────────┐
                            │              │ User Inbox  │
                            │              └─────────────┘
                            ▼                     │
                    ┌──────────────┐              │
                    │ IMAP Monitor │◀─────────────┘
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │Proof Generator│
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Blockchain  │
                    └──────────────┘
```

## Important Notes

- **Demo Mode**: This implementation simulates zkEmail proof generation
- **Production**: Would require actual zkEmail circuits and GPU setup
- **Security**: Never commit `.env` file with credentials
- **Rate Limits**: Gmail has sending limits (500/day)

## Troubleshooting

See `setup.md` for common issues and solutions.