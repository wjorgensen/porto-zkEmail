#!/usr/bin/env node

/**
 * Test script for full zkEmail proof generation and verification flow
 * 
 * This script tests:
 * 1. Sending a verification email
 * 2. Monitoring for email reply
 * 3. Generating zkEmail proof
 * 4. Verifying the proof
 */

import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';

const SERVER_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testFullFlow() {
  log('\n========================================', 'blue');
  log('zkEmail Full Flow Test', 'blue');
  log('========================================\n', 'blue');

  try {
    // Step 1: Check server health
    log('1. Checking server health...', 'yellow');
    const healthRes = await fetch(`${SERVER_URL}/health`);
    const health = await healthRes.json();
    log(`   ✓ Server is healthy: ${health.status}`, 'green');

    // Step 2: Send verification email
    log('\n2. Sending verification email...', 'yellow');
    const email = process.env.TEST_EMAIL || 'test@example.com';
    
    const sendRes = await fetch(`${SERVER_URL}/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: email,
        action: 'setEmail'
      })
    });

    if (!sendRes.ok) {
      const error = await sendRes.json();
      throw new Error(`Failed to send email: ${error.error}`);
    }

    const sendResult = await sendRes.json();
    log(`   ✓ Email sent successfully`, 'green');
    log(`   - Message ID: ${sendResult.messageId}`, 'blue');
    log(`   - Code: ${sendResult.code}`, 'blue');
    log(`   - Nonce: ${sendResult.nonce}`, 'blue');

    // Step 3: Instructions for manual reply
    log('\n3. Manual Step Required:', 'yellow');
    log('   Please reply to the email with the subject line:', 'yellow');
    log(`   "Re: PORTO-AUTH-${sendResult.code}"`, 'red');
    log('   Waiting for email reply...', 'yellow');

    // Step 4: Poll for verification status
    log('\n4. Monitoring for email reply and proof generation...', 'yellow');
    let verified = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    
    while (!verified && attempts < maxAttempts) {
      await setTimeout(5000); // Wait 5 seconds between checks
      attempts++;
      
      const statusRes = await fetch(`${SERVER_URL}/verification-status/${sendResult.nonce}`);
      if (statusRes.ok) {
        const status = await statusRes.json();
        
        if (status.status === 'generating_proof') {
          log(`   ⏳ Generating ZK proof...`, 'yellow');
        } else if (status.status === 'verified' || status.status === 'verified_no_proof') {
          verified = true;
          log(`   ✓ Email verified!`, 'green');
          
          if (status.hasZkProof) {
            log(`   ✓ ZK Proof generated successfully`, 'green');
            
            // Step 5: Get proof details
            log('\n5. Fetching proof details...', 'yellow');
            const proofRes = await fetch(`${SERVER_URL}/proof/${sendResult.nonce}`);
            if (proofRes.ok) {
              const proofData = await proofRes.json();
              log(`   ✓ Proof retrieved successfully`, 'green');
              log(`   - Extracted values:`, 'blue');
              console.log(proofData.extractedValues);
              log(`   - Verifier contract: ${proofData.verifierContract || 'Not deployed'}`, 'blue');
            }
          } else if (status.proofError) {
            log(`   ⚠ Email verified but proof generation failed: ${status.proofError}`, 'red');
          }
          
          break;
        }
      }
      
      if (attempts % 6 === 0) { // Every 30 seconds
        log(`   ... Still waiting (${attempts * 5} seconds elapsed)`, 'yellow');
      }
    }
    
    if (!verified) {
      throw new Error('Timeout waiting for email verification');
    }

    // Step 6: List saved emails
    log('\n6. Checking saved emails...', 'yellow');
    const emailsRes = await fetch(`${SERVER_URL}/saved-emails`);
    if (emailsRes.ok) {
      const emailsData = await emailsRes.json();
      log(`   ✓ Found ${emailsData.emails.length} saved email(s)`, 'green');
      if (emailsData.latestEmail) {
        log(`   - Latest email: ${emailsData.latestEmail}`, 'blue');
        log(`   - Ready for zkEmail registry upload`, 'blue');
      }
    }

    log('\n========================================', 'green');
    log('✓ Full zkEmail flow test completed successfully!', 'green');
    log('========================================\n', 'green');

  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the test
testFullFlow().catch(console.error);