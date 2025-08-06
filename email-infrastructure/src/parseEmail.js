import { DKIMVerify } from '@zk-email/helpers';
import { bytesToBigInt, stringToBytes } from 'viem';

/**
 * Parse email content for zkEmail circuit input
 */
export class EmailParser {
  constructor(blueprint) {
    this.blueprint = blueprint;
    this.maxHeaderLength = blueprint.circuitParams.maxHeaderSize;
    this.maxBodyLength = blueprint.circuitParams.maxBodySize;
  }

  /**
   * Parse raw email and extract circuit inputs
   */
  async parseForCircuit(rawEmail) {
    // Split headers and body
    const { headers, body } = this.splitEmail(rawEmail);
    
    // Verify DKIM signature
    const dkimResult = await DKIMVerify(rawEmail);
    if (!dkimResult.verified) {
      throw new Error('DKIM verification failed');
    }
    
    // Extract data using regex patterns
    const extractedData = this.extractData(headers, body);
    
    // Prepare circuit input
    const circuitInput = this.prepareCircuitInput({
      headers,
      body,
      dkimResult,
      extractedData
    });
    
    return circuitInput;
  }

  /**
   * Split email into headers and body
   */
  splitEmail(rawEmail) {
    const parts = rawEmail.split('\r\n\r\n');
    return {
      headers: parts[0],
      body: parts.slice(1).join('\r\n\r\n')
    };
  }

  /**
   * Extract data using blueprint patterns
   */
  extractData(headers, body) {
    const extracted = {};
    
    for (const extractor of this.blueprint.extractors) {
      const source = extractor.location === 'subject' ? headers : body;
      const regex = new RegExp(extractor.regex);
      const match = source.match(regex);
      
      if (match && match[1]) {
        extracted[extractor.name] = match[1];
      } else if (extractor.isPublic) {
        throw new Error(`Failed to extract required field: ${extractor.name}`);
      }
    }
    
    return extracted;
  }

  /**
   * Prepare input for the circuit
   */
  prepareCircuitInput({ headers, body, dkimResult, extractedData }) {
    // Pad and convert to circuit format
    const paddedHeader = this.padString(headers, this.maxHeaderLength);
    const paddedBody = this.padString(body, this.maxBodyLength);
    
    // Convert to bytes array
    const headerBytes = stringToBytes(paddedHeader);
    const bodyBytes = stringToBytes(paddedBody);
    
    // Extract DKIM signature components
    const { signature, publicKey } = dkimResult;
    
    // Convert signature and public key to circuit format
    const signatureArray = this.bigIntToArray(
      bytesToBigInt(signature),
      this.blueprint.dkimParams.maxSignatureLength / 64
    );
    
    const publicKeyArray = this.bigIntToArray(
      bytesToBigInt(publicKey),
      this.blueprint.dkimParams.publicKeyModulusLength / 64
    );
    
    return {
      // Email content
      in_padded: Array.from(headerBytes),
      in_body_padded: Array.from(bodyBytes),
      in_body_len: body.length,
      in_padded_n_bytes: headers.length,
      in_body_padded_n_bytes: body.length,
      
      // DKIM signature
      signature: signatureArray,
      pubkey: publicKeyArray,
      
      // Extracted data for verification
      expected_auth_code: parseInt(extractedData.authCode),
      expected_wallet_address: extractedData.walletAddress,
      expected_action: this.stringToField(extractedData.action),
      expected_nonce: BigInt(extractedData.nonce),
      expected_timestamp: parseInt(extractedData.timestamp)
    };
  }

  /**
   * Pad string to fixed length
   */
  padString(str, maxLength) {
    if (str.length > maxLength) {
      throw new Error(`String exceeds max length: ${str.length} > ${maxLength}`);
    }
    return str.padEnd(maxLength, '\0');
  }

  /**
   * Convert BigInt to array of field elements
   */
  bigIntToArray(bigint, numChunks) {
    const chunks = [];
    const chunkSize = 64n; // bits per chunk
    
    for (let i = 0; i < numChunks; i++) {
      chunks.push((bigint >> (chunkSize * BigInt(i))) & ((1n << chunkSize) - 1n));
    }
    
    return chunks.map(n => n.toString());
  }

  /**
   * Convert string to field element
   */
  stringToField(str) {
    const bytes = stringToBytes(str);
    return bytesToBigInt(bytes).toString();
  }
}

/**
 * Example usage
 */
export async function prepareEmailForProof(rawEmail, blueprint) {
  const parser = new EmailParser(blueprint);
  
  try {
    const circuitInput = await parser.parseForCircuit(rawEmail);
    return circuitInput;
  } catch (error) {
    console.error('Email parsing failed:', error);
    throw error;
  }
}