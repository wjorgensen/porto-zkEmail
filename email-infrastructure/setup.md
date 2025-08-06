# Email Infrastructure Setup

This directory contains the email server and proof generation service for Porto zkEmail integration.

## Prerequisites

1. **Gmail Account Setup**
   - Create a new Gmail account specifically for this demo
   - Enable 2-factor authentication
   - Generate an App Password for SMTP/IMAP access

2. **Node.js Requirements**
   - Node.js >= 18.0.0
   - npm or yarn

3. **GPU Requirements** (for fast proof generation)
   - NVIDIA GPU with CUDA support
   - CUDA toolkit installed
   - Or fallback to CPU (slower)

## Gmail Configuration

### Step 1: Enable App Passwords

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to Security → 2-Step Verification (enable if not already)
3. Navigate to Security → App passwords
4. Create a new app password for "Mail"
5. Save the 16-character password

### Step 2: Enable IMAP

1. Open Gmail settings (gear icon → See all settings)
2. Go to "Forwarding and POP/IMAP" tab
3. Enable IMAP
4. Save changes

### Step 3: Create Environment File

Create a `.env` file in this directory with:

```env
# Gmail Configuration
GMAIL_USER=your-gmail-address@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Email Server Configuration
EMAIL_SERVER_PORT=3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
IMAP_HOST=imap.gmail.com
IMAP_PORT=993

# Proof Generation
PROOF_GENERATION_TIMEOUT=300000  # 5 minutes
USE_GPU=true  # Set to false to use CPU

# RPC Configuration
RPC_URL=http://localhost:8545
CHAIN_ID=31337

# Contract Addresses (will be filled by deployment script)
ACCOUNT_IMPLEMENTATION=
ZK_EMAIL_VERIFIER=
ORCHESTRATOR=
```

## zkEmail Blueprint Configuration

### Step 1: Install zkEmail SDK

```bash
npm install @zk-email/sdk
```

### Step 2: Create Blueprint

The blueprint defines what to extract from emails:

```javascript
// blueprint.js
const blueprint = {
  name: "porto-auth",
  version: "1.0.0",
  emailQuery: {
    subject: "PORTO-AUTH-*",
    from: process.env.GMAIL_USER
  },
  extractors: [
    {
      name: "authCode",
      regex: "PORTO-AUTH-([0-9]{6})",
      location: "subject"
    },
    {
      name: "challengeData",
      regex: "PORTO\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)\\|([^|]+)",
      location: "body"
    }
  ],
  publicInputs: ["authCode", "challengeData"],
  maxEmailSize: 8192
};
```

## Circuit Files

### Download Required Circuits

zkEmail circuits need to be downloaded or generated:

```bash
# Create circuits directory
mkdir -p circuits

# Download pre-built circuits (if available)
# Or generate them using zkEmail tools
```

## Server Structure

```
email-infrastructure/
├── .env                    # Environment variables
├── setup.md               # This file
├── package.json           # Dependencies
├── src/
│   ├── server.js          # Main email server
│   ├── emailMonitor.js    # IMAP email monitoring
│   ├── emailSender.js     # SMTP email sending
│   ├── proofGenerator.js  # zkEmail proof generation
│   └── blueprints/        # zkEmail blueprints
├── circuits/              # zkEmail circuits
└── logs/                  # Server logs
```

## Running the Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

The server will:
- Listen for email verification requests on port 3001
- Send verification emails via SMTP
- Monitor inbox for replies via IMAP
- Generate zkEmail proofs when replies are detected
- Submit proofs to the blockchain

## Security Notes

1. **Never commit the `.env` file** - Add it to `.gitignore`
2. **Use a dedicated Gmail account** - Don't use your personal email
3. **Rotate app passwords regularly**
4. **Monitor for suspicious activity**

## Troubleshooting

### Gmail Authentication Issues
- Ensure 2FA is enabled
- Check app password is correct (no spaces)
- Verify "Less secure app access" if needed

### IMAP Connection Issues
- Check firewall rules
- Verify IMAP is enabled in Gmail
- Try telnet to test connectivity: `telnet imap.gmail.com 993`

### Proof Generation Issues
- Check GPU drivers if using GPU
- Increase timeout for CPU generation
- Verify circuit files are present
- Check available memory

### Email Not Received
- Check spam folder
- Verify sender email matches GMAIL_USER
- Check Gmail sending limits (500/day)