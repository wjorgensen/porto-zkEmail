# EmailModule.sol - Optimized Standalone Email Verification Contract

## Overview
The `EmailModule` is a gas-optimized standalone contract that handles zkEmail verification for Porto accounts. It's deployed separately to reduce the main account contract size.

## Key Features

### Gas Optimizations
1. **Deployment Size**: Only 2.8 KB (2,892 bytes)
2. **Deployment Cost**: 672,606 gas
3. **Verification Cost**: ~16,604 gas per verification

### Security Features
- Validates email hash matches expected value
- Checks chain ID to prevent cross-chain replay
- Validates EOA address matches expected account
- Enforces timestamp freshness (15-minute window)
- Monotonic nonce enforcement for replay protection
- Validates action types (setEmail, addKey, revokeKey)

### Main Functions

#### `verifyEmailAndRegister`
- Verifies email proof for initial registration
- Parses and validates challenge data
- Returns parsed challenge for account to process
- Gas cost: ~16,604

#### `verifyEmailAction`
- Verifies email proof for add/revoke key operations
- Additional nonce validation for non-registration actions
- Calls `verifyEmailAndRegister` internally

### Email Challenge Format
```
Subject: PORTO-AUTH-<6-digit-code>
Body: PORTO|<chainId>|<eoa>|<action>|<keyHash>|<nonce>|<timestamp>|<keyId>
```

### Optimization Techniques Used

1. **Assembly for Parsing**: Custom assembly implementation for parsing challenge strings
2. **Inline Assembly for Hashing**: Direct keccak256 calls in assembly
3. **Custom Errors**: Uses 4-byte selectors instead of string reverts
4. **Efficient Type Conversions**: Optimized hex parsing and uint parsing
5. **Memory-Safe Assembly**: All assembly blocks are properly annotated
6. **Minimal Storage**: Zero storage slots used (pure verification logic)
7. **Staticcall for Verification**: Gas-efficient external calls

### Integration with IthacaAccountV2

The account contract can call this module like:
```solidity
EmailModule.ParsedChallenge memory challenge = emailModule.verifyEmailAndRegister(
    emailProof,
    zkEmailVerifier,
    expectedEmailHash,
    address(this)
);
```

### Deployment Instructions

1. Deploy EmailModule:
```bash
forge create EmailModule --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

2. In IthacaAccountV2, store the module address and use it for verification

### Gas Comparison
- **Before** (inline library): Part of ~24KB account contract
- **After** (standalone module): 2.8KB separate contract + minimal call overhead

This separation allows the main account to stay under size limits while maintaining full email verification functionality.