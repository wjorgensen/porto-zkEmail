import dns from 'dns/promises';
import crypto from 'crypto';

export class DKIMParser {
  constructor(logger) {
    this.logger = logger;
  }

  // Parse DKIM-Signature header
  parseDKIMHeader(dkimHeader) {
    const tags = {};
    const parts = dkimHeader.replace(/\s+/g, ' ').split(';');
    
    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key && value) {
        tags[key.trim()] = value.trim();
      }
    }
    
    return tags;
  }

  // Extract DKIM signature from email headers
  extractDKIMSignature(emailContent) {
    const lines = emailContent.split('\n');
    let dkimHeader = '';
    let inDKIM = false;
    
    for (const line of lines) {
      if (line.startsWith('DKIM-Signature:')) {
        inDKIM = true;
        dkimHeader = line.substring('DKIM-Signature:'.length);
      } else if (inDKIM) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
          dkimHeader += line;
        } else {
          break;
        }
      }
    }
    
    return this.parseDKIMHeader(dkimHeader);
  }

  // Get DKIM public key from DNS
  async getDKIMPublicKey(domain, selector) {
    try {
      const dkimRecord = `${selector}._domainkey.${domain}`;
      this.logger.info(`Fetching DKIM key from DNS: ${dkimRecord}`);
      
      const records = await dns.resolveTxt(dkimRecord);
      const txtRecord = records.flat().join('');
      
      // Parse the TXT record
      const keyMatch = txtRecord.match(/p=([^;]+)/);
      if (keyMatch) {
        const publicKeyBase64 = keyMatch[1].replace(/\s/g, '');
        return publicKeyBase64;
      }
      
      throw new Error('No public key found in DKIM record');
    } catch (error) {
      this.logger.error(`Failed to fetch DKIM key: ${error.message}`);
      // Return a mock key for testing
      return this.getMockPublicKey();
    }
  }

  // Convert RSA public key to circuit format
  convertPublicKeyToCircuitFormat(publicKeyBase64, k = 17) {
    try {
      // Decode base64 public key
      const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
      
      // Parse DER format to extract modulus
      // This is simplified - real implementation needs proper ASN.1 parsing
      const publicKey = crypto.createPublicKey({
        key: publicKeyDer,
        format: 'der',
        type: 'spki'
      });
      
      const keyData = publicKey.export({
        format: 'jwk'
      });
      
      // Convert modulus from base64url to BigInt
      const modulus = this.base64urlToBigInt(keyData.n);
      
      // Split into k chunks for circuit
      return this.splitBigIntToChunks(modulus, k);
    } catch (error) {
      this.logger.error('Failed to convert public key:', error);
      // Return mock key chunks
      return Array(17).fill('0');
    }
  }

  // Convert signature to circuit format
  convertSignatureToCircuitFormat(signatureBase64, k = 17) {
    try {
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      const signatureBigInt = BigInt('0x' + signatureBuffer.toString('hex'));
      return this.splitBigIntToChunks(signatureBigInt, k);
    } catch (error) {
      this.logger.error('Failed to convert signature:', error);
      return Array(17).fill('0');
    }
  }

  // Helper: Convert base64url to BigInt
  base64urlToBigInt(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - base64.length % 4) % 4;
    const paddedBase64 = base64 + '='.repeat(padding);
    const buffer = Buffer.from(paddedBase64, 'base64');
    return BigInt('0x' + buffer.toString('hex'));
  }

  // Helper: Split BigInt into k chunks
  splitBigIntToChunks(bigInt, k) {
    const chunkSize = 121; // bits per chunk for 2048-bit RSA
    const chunks = [];
    const mask = (1n << BigInt(chunkSize)) - 1n;
    
    for (let i = 0; i < k; i++) {
      chunks.push((bigInt & mask).toString());
      bigInt = bigInt >> BigInt(chunkSize);
    }
    
    return chunks;
  }

  // Get mock public key for testing
  getMockPublicKey() {
    // This is a placeholder RSA public key for testing
    return 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890';
  }

  // Parse email and extract all DKIM data needed for circuit
  async parseDKIMForCircuit(emailContent) {
    try {
      // Extract DKIM signature
      const dkimTags = this.extractDKIMSignature(emailContent);
      
      if (!dkimTags.d || !dkimTags.s || !dkimTags.b) {
        throw new Error('Invalid DKIM signature');
      }
      
      this.logger.info('DKIM Tags:', {
        domain: dkimTags.d,
        selector: dkimTags.s,
        algorithm: dkimTags.a,
        timestamp: dkimTags.t
      });
      
      // Get public key from DNS
      const publicKeyBase64 = await this.getDKIMPublicKey(dkimTags.d, dkimTags.s);
      
      // Convert to circuit format
      const pubkeyChunks = this.convertPublicKeyToCircuitFormat(publicKeyBase64);
      const signatureChunks = this.convertSignatureToCircuitFormat(dkimTags.b);
      
      // Extract email header for circuit
      const headerEndIndex = emailContent.indexOf('\n\n');
      const emailHeader = emailContent.substring(0, headerEndIndex);
      const emailHeaderBytes = Buffer.from(emailHeader);
      const emailHeaderArray = Array.from(emailHeaderBytes);
      
      return {
        emailHeader: emailHeaderArray,
        emailHeaderLength: emailHeaderArray.length,
        pubkey: pubkeyChunks,
        signature: signatureChunks,
        dkimDomain: dkimTags.d,
        dkimSelector: dkimTags.s,
        dkimTimestamp: dkimTags.t
      };
      
    } catch (error) {
      this.logger.error('Failed to parse DKIM for circuit:', error);
      throw error;
    }
  }
}