# Porto zkEmail Integration (V2)

This directory contains the implementation of Porto Account V2 with zkEmail recovery support as specified in the plan.

## Overview

IthacaAccountV2 extends the existing IthacaAccount with email-based recovery features using zkEmail technology. This allows users to:
- Set a recovery email (one-time)
- Add new passkeys via email verification
- Revoke passkeys via email verification
- Maintain full backward compatibility with V1 accounts

## Key Components

### Contracts
- `IthacaAccountV2.sol` - Main account contract extending IthacaAccount
- `interfaces/IIthacaAccountV2.sol` - Interface defining new V2 methods
- `lib/EmailModuleLib.sol` - Gas-optimized library for zkEmail verification

### Features
- **Email Recovery**: One-time email registration for account recovery
- **Device Management**: Add/revoke passkeys with email verification
- **Rate Limiting**: Maximum 5 keys per week
- **Device IDs**: Each key has a unique ID for device naming
- **Storage Compatibility**: V2 uses separate storage slots, maintaining V1 compatibility

## Contract Size Issue

The IthacaAccountV2 contract exceeds the 24KB size limit (26.5KB). For production deployment, consider:

1. **Deploy EmailModuleLib as a library**: Link externally to reduce size
2. **Modular Architecture**: Split functionality into multiple contracts
3. **Proxy Pattern**: Use minimal proxy with modular implementation

## Deployment

```bash
# Deploy V2 implementation
forge script script/DeployIthacaV2.s.sol --rpc-url $RPC_URL --broadcast

# Deploy zkEmail verifier (if not already deployed)
forge script script/DeployZkEmailVerifier.s.sol --rpc-url $RPC_URL --broadcast

# Upgrade existing account to V2
forge script script/UpgradeToV2.s.sol --rpc-url $RPC_URL --broadcast
```

## Testing

```bash
# Run all tests
forge test

# Run specific test file
forge test --match-path test/IthacaAccountV2.t.sol -vvv
```

## SDK Integration

New RPC methods have been added to support V2 features:
- `wallet_setEmail` - Set recovery email
- `wallet_addPasskeyWithEmail` - Add key with email proof
- `wallet_revokePasskeyWithEmail` - Revoke key with email proof
- `wallet_getKeysWithIds` - Get keys with device IDs

## Security Considerations

1. **Email Hash Storage**: Only email hash is stored on-chain
2. **Nonce Protection**: Monotonic nonce prevents replay attacks
3. **Time Window**: Email proofs valid for 15 minutes
4. **Super Admin Protection**: Cannot revoke super admin keys via email
5. **Rate Limiting**: Maximum 5 keys per week

## Next Steps

1. **Size Optimization**: Deploy libraries separately to reduce contract size
2. **zkEmail Infrastructure**: Deploy actual zkEmail verifier contracts
3. **Relayer Setup**: Implement email monitoring and proof generation
4. **Frontend Integration**: Update Dialog and ID apps for email flows
5. **Device Name Service**: Implement off-chain storage for device names

## Test Coverage

The implementation includes comprehensive tests:
- Unit tests for EmailModuleLib functions
- Integration tests for IthacaAccountV2
- Storage migration tests for V1→V2 upgrade
- Gas usage benchmarks

Note: Some tests are failing due to parsing issues in the EmailModuleLib that need to be addressed before production deployment.