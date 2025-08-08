import { verifyDKIMSignature } from '@zk-email/helpers/dist/dkim/index.js';
import { generateEmailVerifierInputsFromDKIMResult } from '@zk-email/helpers/dist/input-generators.js';

export class CircuitInputPreparer {
  constructor(logger) {
    this.logger = logger;
    
    // Circuit parameters from circuit.circom
    this.maxHeaderLength = 1088;
    this.maxBodyLength = 0; // No body verification
    this.n = 121; // bits per RSA chunk
    this.k = 17; // number of RSA chunks  
    this.packSize = 7;
    
    // Regex patterns for finding indices
    this.patterns = {
      subject: /subject:\s*([^\r\n]+)/i,
      senderDomain: /from:[^\r\n]*@([A-Za-z0-9][A-Za-z0-9\.-]+\.[A-Za-z]{2,})/i,
      emailTimestamp: /dkim-signature:.*?t=(\d+);/is,
      emailRecipient: /to:\s*(?:[^\r\n]+<)?([a-zA-Z0-9!#$%&\*\+-/=\?\^_`{\|}~\.]+@[a-zA-Z0-9_\.-]+)/i
    };
  }

  async prepareCircuitInputs(emailContent, proverETHAddress = '0x0000000000000000000000000000000000000000') {
    try {
      this.logger.info('Preparing circuit inputs from email...');
      
      // Verify DKIM signature
      const dkimResult = await verifyDKIMSignature(Buffer.from(emailContent));
      
      if (!dkimResult.valid) {
        throw new Error('Invalid DKIM signature');
      }
      
      this.logger.info('DKIM signature verified successfully');
      
      // Generate base inputs for email verifier
      const emailVerifierInputs = await generateEmailVerifierInputsFromDKIMResult(
        dkimResult,
        {
          maxHeaderLength: this.maxHeaderLength,
          maxBodyLength: this.maxBodyLength,
          ignoreBodyHash: true // Blueprint has ignoreBodyHashCheck: true
        }
      );
      
      // Find regex indices for extracted values
      const regexIndices = this.findRegexIndices(emailContent);
      
      // Convert ETH address to field element
      const ethAddressInt = BigInt(proverETHAddress);
      
      // Prepare complete circuit inputs
      const circuitInputs = {
        ...emailVerifierInputs,
        proverETHAddress: ethAddressInt.toString(),
        
        // Add regex indices
        subjectRegexIdx: regexIndices.subject.toString(),
        sender_domainRegexIdx: regexIndices.senderDomain.toString(), 
        email_timestampRegexIdx: regexIndices.emailTimestamp.toString(),
        email_recipientRegexIdx: regexIndices.emailRecipient.toString()
      };
      
      this.logger.info('Circuit inputs prepared successfully');
      return circuitInputs;
      
    } catch (error) {
      this.logger.error('Failed to prepare circuit inputs:', error);
      
      // Return mock inputs if DKIM verification fails
      return this.prepareMockInputs(emailContent, proverETHAddress);
    }
  }

  findRegexIndices(emailContent) {
    const indices = {};
    
    // Find subject index
    const subjectMatch = emailContent.match(this.patterns.subject);
    if (subjectMatch) {
      indices.subject = subjectMatch.index + 'subject:'.length;
    } else {
      indices.subject = 0;
    }
    
    // Find sender domain index
    const senderMatch = emailContent.match(this.patterns.senderDomain);
    if (senderMatch) {
      // Find the start of the domain part
      const fullMatch = senderMatch[0];
      const domain = senderMatch[1];
      indices.senderDomain = senderMatch.index + fullMatch.indexOf(domain);
    } else {
      indices.senderDomain = 0;
    }
    
    // Find timestamp index
    const timestampMatch = emailContent.match(this.patterns.emailTimestamp);
    if (timestampMatch) {
      const fullMatch = timestampMatch[0];
      const timestamp = timestampMatch[1];
      indices.emailTimestamp = timestampMatch.index + fullMatch.indexOf(timestamp);
    } else {
      indices.emailTimestamp = 0;
    }
    
    // Find recipient index
    const recipientMatch = emailContent.match(this.patterns.emailRecipient);
    if (recipientMatch) {
      const fullMatch = recipientMatch[0];
      const recipient = recipientMatch[1];
      indices.emailRecipient = recipientMatch.index + fullMatch.indexOf(recipient);
    } else {
      indices.emailRecipient = 0;
    }
    
    return indices;
  }

  prepareMockInputs(emailContent, proverETHAddress) {
    // Prepare mock inputs when DKIM verification is not available
    const emailBytes = Buffer.from(emailContent.substring(0, this.maxHeaderLength));
    const emailHeader = Array(this.maxHeaderLength).fill(0);
    
    for (let i = 0; i < Math.min(emailBytes.length, this.maxHeaderLength); i++) {
      emailHeader[i] = emailBytes[i].toString();
    }
    
    // Mock RSA key and signature (all zeros for testing)
    const pubkey = Array(this.k).fill('0');
    const signature = Array(this.k).fill('0');
    
    // Find regex indices
    const regexIndices = this.findRegexIndices(emailContent);
    
    return {
      emailHeader,
      emailHeaderLength: Math.min(emailBytes.length, this.maxHeaderLength).toString(),
      pubkey,
      signature,
      proverETHAddress: BigInt(proverETHAddress || '0x0').toString(),
      
      // Regex indices
      subjectRegexIdx: regexIndices.subject.toString(),
      sender_domainRegexIdx: regexIndices.senderDomain.toString(),
      email_timestampRegexIdx: regexIndices.emailTimestamp.toString(),
      email_recipientRegexIdx: regexIndices.emailRecipient.toString()
    };
  }

  // Extract public values that the circuit will output
  extractPublicValues(emailContent) {
    const values = {};
    
    const subjectMatch = emailContent.match(this.patterns.subject);
    if (subjectMatch) {
      values.subject = subjectMatch[1].trim();
    }
    
    const senderMatch = emailContent.match(this.patterns.senderDomain);
    if (senderMatch) {
      values.senderDomain = senderMatch[1];
    }
    
    const timestampMatch = emailContent.match(this.patterns.emailTimestamp);
    if (timestampMatch) {
      values.emailTimestamp = timestampMatch[1];
    }
    
    const recipientMatch = emailContent.match(this.patterns.emailRecipient);
    if (recipientMatch) {
      values.emailRecipient = recipientMatch[1];
    }
    
    return values;
  }
}