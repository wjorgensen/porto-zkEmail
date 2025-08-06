# IthacaAccountV2 Implementation Summary

## Overview
IthacaAccountV2 extends the base IthacaAccount contract to add zkEmail-based key management capabilities while maintaining backward compatibility with V1 functionality.

## Key Features Implemented

### 1. Email Registration
- **One-time email setup**: `setEmail()` function allows setting email hash once per account
- **zkEmail proof verification**: Validates email ownership through zero-knowledge proofs
- **Secure storage**: Email hash stored in dedicated V2 storage slot

### 2. Email-Based Key Management
- **Add keys via email**: `addPasskeyWithEmail()` allows adding new passkeys with email proof
- **Revoke keys via email**: `revokePasskeyWithEmail()` enables key revocation (non-super-admin only)
- **Device ID support**: Enhanced Key struct with `keyId` field for device identification

### 3. Security Features
- **Rate limiting**: Maximum 5 keys can be added per week
- **Nonce protection**: Monotonically increasing nonce prevents replay attacks
- **Action validation**: Only valid actions (setEmail, addKey, revokeKey) are accepted
- **Super admin protection**: Email-based operations cannot affect super admin keys

### 4. Storage Architecture
- **Separate V2 storage**: Uses different storage slot to avoid conflicts with V1
- **Backward compatible**: V1 storage accessed through base contract methods
- **Gas optimized**: Uses inline assembly for critical operations

### 5. Gas Optimizations
- **Inline assembly**: Used for keccak256 hashing and storage operations
- **Storage slot packing**: Efficient use of storage slots
- **Custom errors**: Replace require strings with custom errors
- **Memory-safe assembly**: All assembly blocks marked as memory-safe

## Contract Structure

```solidity
contract IthacaAccountV2 is IthacaAccount, IIthacaAccountV2 {
    // Constants
    - EMAIL_VERIFIER_SLOT: Storage slot for zkEmail verifier address
    - MAX_KEYS_PER_WEEK: Rate limit of 5 keys per week
    - WEEK_DURATION: 7 days in seconds

    // Storage
    - AccountStorageV2: Extended storage with email fields
      - emailHash: keccak256 of email address
      - lastEmailNonce: Replay protection
      - keysAddedThisWeek: Rate limiting counter
      - weekStartTimestamp: Rate limit window tracking
      - keyIds: Mapping of keyHash to device ID

    // Main Functions
    - setEmail(): One-time email registration
    - addPasskeyWithEmail(): Add key with email proof
    - revokePasskeyWithEmail(): Revoke key with email proof
    - getKeysWithIds(): Return keys with device IDs
    - setEmailVerifier(): Admin function to set verifier

    // View Functions
    - getEmailHash(): Return registered email hash
    - getLastEmailNonce(): Return last used nonce
    - isValidEmailProof(): Validate proof without state changes
}
```

## Integration with EmailModuleLib

The contract leverages `EmailModuleLib` for:
- Email proof parsing and validation
- Challenge extraction from email body
- Nonce and timestamp validation
- Action type verification

## Security Considerations

1. **Email Verifier**: Must be set by admin before email operations work
2. **Rate Limiting**: Prevents mass key addition attacks
3. **Nonce Management**: Prevents replay attacks
4. **Super Admin Keys**: Protected from email-based revocation
5. **One-Time Email**: Email cannot be changed once set

## Gas Costs (Estimated)

- `setEmail`: ~150,000 gas (includes zkEmail verification)
- `addPasskeyWithEmail`: ~180,000 gas (includes verification + key storage)
- `revokePasskeyWithEmail`: ~120,000 gas (includes verification + key removal)
- `getKeysWithIds`: ~50,000 + 5,000 per key (view function)

## Deployment Notes

1. Deploy IthacaAccountV2 with orchestrator address
2. Set email verifier address via `setEmailVerifier()` (requires super admin)
3. Account ready for email-based operations

## Future Improvements

1. **Bytecode size**: Contract exceeds 24KB limit, consider:
   - Deploying EmailModuleLib as separate library
   - Moving view functions to reader contract
   - Using proxy pattern for upgradability

2. **Email rotation**: Add secure email update mechanism
3. **Batch operations**: Add batch key management functions
4. **Social recovery**: Implement guardian-based recovery