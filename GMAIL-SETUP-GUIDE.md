# Gmail Setup Guide for Porto zkEmail

## Quick Reference

### 📍 Current .env Location
`/Users/wes/Programming/porto-zk/email-infrastructure/.env`

### 📧 Your Email
`yexfinance@gmail.com`

### 🔑 What You Need
A 16-character Gmail App Password (looks like: `abcd efgh ijkl mnop`)

## Step-by-Step Gmail Setup

### 1. Enable 2-Factor Authentication (Required)

1. Go to: https://myaccount.google.com/security
2. Find "2-Step Verification"
3. Click and follow the setup wizard
4. Enable 2FA using your phone

### 2. Generate App Password

1. After enabling 2FA, go to: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords
2. Click "Select app" → Choose "Mail"
3. Click "Select device" → Choose "Other (custom name)"
4. Enter name: "Porto zkEmail"
5. Click "Generate"
6. **COPY THE 16-CHARACTER PASSWORD** (shown as: `abcd efgh ijkl mnop`)
   - Remove spaces when pasting into .env file
   - You won't be able to see this password again!

### 3. Enable IMAP Access

1. Open Gmail: https://mail.google.com
2. Click gear icon ⚙️ → "See all settings"
3. Go to "Forwarding and POP/IMAP" tab
4. Under "IMAP access", select "Enable IMAP"
5. Click "Save Changes"

### 4. Update Your .env File

Edit `/Users/wes/Programming/porto-zk/email-infrastructure/.env`:

```env
# Gmail Configuration
GMAIL_USER=yexfinance@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop  # Your 16-char password WITHOUT spaces
```

## Folder Structure Explanation

You have two email-related folders:

### 1. `email-infrastructure/` (USE THIS ONE)
- **Status**: Active, complete implementation
- **Features**: Full zkEmail integration, M1 optimized, real proofs
- **Location**: `/Users/wes/Programming/porto-zk/email-infrastructure/`
- **Setup Guide**: `email-infrastructure/setup.md`
- **Blueprint**: `email-infrastructure/blueprints/porto-auth.json`

### 2. `zkEmailRelayer/` (OLD - Don't use)
- **Status**: Earlier implementation, TypeScript-based
- **Purpose**: Was the initial relayer design
- **Note**: Superseded by email-infrastructure

## Testing Your Setup

### 1. Check Gmail Connection

```bash
cd /Users/wes/Programming/porto-zk/email-infrastructure
npm test-connection  # If available, or start the server
```

### 2. Send Test Email

```bash
# Start everything
cd /Users/wes/Programming/porto-zk
./start-all.sh

# Visit http://localhost:3000
# Try the signup flow
```

### 3. Monitor Logs

```bash
# In tmux session
tmux attach -t porto
# Switch to email window (Ctrl+B then 1)
```

## Common Issues

### "Invalid credentials"
- Make sure you're using App Password, not regular password
- Remove all spaces from the app password
- Check that 2FA is enabled

### "IMAP connection failed"
- Verify IMAP is enabled in Gmail settings
- Check firewall isn't blocking port 993
- Try: `telnet imap.gmail.com 993`

### "Cannot send email"
- Gmail has daily limits (500 emails/day)
- Check spam folder
- Verify sender matches GMAIL_USER

## Security Notes

1. **Never commit .env to git** - It's in .gitignore
2. **Use dedicated email** - Don't use personal Gmail
3. **Rotate app passwords** - Regenerate periodically
4. **Monitor access** - Check Google Account activity

## Quick Checklist

- [ ] 2FA enabled on yexfinance@gmail.com
- [ ] App password generated and copied
- [ ] IMAP enabled in Gmail settings
- [ ] .env file updated with credentials
- [ ] Tested email sending/receiving

## Need Help?

If you're stuck:
1. Check `email-infrastructure/logs/` for detailed errors
2. Verify all Gmail settings are correct
3. Try the connection test scripts
4. Check spam/promotional folders for test emails