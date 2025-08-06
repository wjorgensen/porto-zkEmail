# Porto SDK – zkEmail & EIP‑7702 Integration Plan (Full Spec v3.2)

**Filename**: `plan.md`    **Date**:  2025‑08‑04

> Drop this file into Porto repository to implement zkEmail integration.
> Designed for LLM-assisted implementation following the tasks in §9.

---

## 0 · Background & Motivation

### 0.1  Status‑quo (Porto v0.3.x)

| Layer                | Current Implementation                                                    | Limitations                  |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| **Auth root**        | One **passkey** (WebAuthn / P‑256) registered on‑chain                   | Lose device ⇒ lose wallet.   |
| **On‑chain account** | *IthacaAccount* – EIP‑7702 with proxy pattern via LibEIP7702            | ✅ Great UX, but no recovery. |
| **Storage model**    | All state stored at EOA via deterministic slots                          | Works fine.                  |
| **Gas management**   | Orchestrator handles atomic execution and gas compensation               | Works well.                  |

### 0.2  Upgrade goals

1. **Email‑based recovery** with zero trusted backend using zkEmail.
2. Allow **multiple passkeys** per wallet with device naming UX.
3. Keep the gasless UX (sponsored L2 txs via Orchestrator).
4. **Maintain existing architecture** - extend IthacaAccount, don't replace.
5. **Preserve all features** - Orchestrator, GuardedExecutor, key management.

### 0.3  Design choice summary

* Use **zkEmail** (DKIM‑verified zero‑knowledge proofs) so *e‑mail = root‑of‑trust*.
* Create **IthacaAccountV2** in new `contracts/accountV2/` directory.
* **Extend existing storage pattern** - use same slot derivation approach.
* Store email hash and device UIDs in EOA storage for seamless upgrades.
* Device names stored off-chain, mapped via UID for privacy.

---

## 1 · High‑Level Architecture

```
EOA  (user's legacy address)
└─ code: 0xef 01 00 <proxyAddr>   ← stored by 7702 set‑code tx

proxyAddr  (EIP7702Proxy via LibEIP7702)
└─ delegatecall → IthacaAccountV2 (extends IthacaAccount)

IthacaAccountV2  (~20‑23 KB)
    · Inherits from IthacaAccount (all existing functionality)
    · execute()                    – enhanced with email-gated operations
    · EmailModuleLib               – zkEmail verification helpers
    · Enhanced Key struct          – adds `keyId` for device naming
    · Additional storage in AccountStorage:
        - emailHash: bytes32        – one-time settable email hash
        - lastEmailNonce: uint64    – monotonic email proof nonce
        - emailProofExpiry: uint40  – rate limiting for operations

Orchestrator (unchanged)
    · Handles gas compensation and atomic execution
    · Compatible with V2 accounts via same interface
```

Maintains single delegate hop pattern, extends existing storage, seamless upgrade path.

---

## 2 · Storage Layout Details

```solidity
// Extends existing AccountStorage struct
struct AccountStorageV2 {
    // ── Inherited from IthacaAccount ──
    LibBytes.BytesStorage label;
    mapping(uint192 => LibStorage.Ref) nonceSeqs;
    EnumerableSetLib.Bytes32Set keyHashes;
    mapping(bytes32 => LibBytes.BytesStorage) keyStorage;
    mapping(bytes32 => LibStorage.Bump) keyExtraStorage;
    
    // ── New fields for zkEmail ──
    bytes32 emailHash;              // keccak256(email), one-time settable
    uint64 lastEmailNonce;          // monotonic counter for email proofs
    uint40 emailProofExpiry;        // timestamp for rate limiting
    uint8 keysAddedThisWeek;        // rate limit counter
}

// Enhanced Key struct (backward compatible via encoding)
struct KeyV2 {
    uint40 expiry;              // unix ts, 0 = never
    KeyType keyType;            // enum {P256, WebAuthnP256, Secp256k1, External}
    bool isSuperAdmin;          // admin privileges
    bytes32 keyId;              // NEW: random UID for device naming
    bytes publicKey;            // public key data
}

// Storage slot derivation (maintains compatibility)
function _getAccountStorageV2() internal pure returns (AccountStorageV2 storage $) {
    uint256 s = uint72(bytes9(keccak256("ITHACA_ACCOUNT_STORAGE")));
    assembly { $.slot := s }
}
```

> **Note**: Storage layout extends existing pattern. Keys use same encoding with additional keyId field appended for V2 keys.

---

## 3 · External Dependencies & Installation (Foundry)

| Package                                                                               | Purpose                                               | Install command                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| [`zk-email-verify`](https://github.com/zkemail/zk-email-verify)                       | DKIM registry + Groth16 verifier contracts            | `forge install zkemail/zk-email-verify --no-commit`            |
| [`ether-email-auth-contracts`](https://github.com/zkemail/ether-email-auth-contracts) | Thin `EmailAuth.sol` wrapper exposing `verifyProof()` | `forge install zkemail/ether-email-auth-contracts --no-commit` |
| [`Solady`](https://github.com/vectorized/solady)                                      | BytesStorage, P256, EIP‑712 helpers                   | `forge install vectorized/solady --no-commit`                  |

### 3.1  Foundry `remappings`

```toml
# foundry.toml
remappings = [
  "@zk-email-verify/=lib/zk-email-verify/packages/contracts/",
  "@zk-email-auth/=lib/ether-email-auth-contracts/src/",
  "solady/=lib/solady/src/"
]
```

Running `forge build` now compiles the Groth16 verifier into your artifacts; end‑to‑end tests use it directly.

---

## 4 · Smart‑Contract API (external)

```solidity
// ── Email Management ──
/// One‑time e‑mail root registration. Takes Groth16 proof + email.
function setEmail(bytes calldata proof, string calldata email) external;

/// Get the registered email hash (returns 0 if not set)
function getEmailHash() external view returns (bytes32);

// ── Key Management (Email-Gated) ──
/// Add a new passkey with device ID. Requires fresh email proof.
function addPasskeyWithEmail(
    KeyV2 calldata key,
    bytes calldata emailProof
) external returns (bytes32 keyHash);

/// Revoke a passkey. Requires email proof.
function revokePasskeyWithEmail(
    bytes32 keyHash,
    bytes calldata emailProof
) external;

// ── Enhanced Views ──
/// Get all keys with their device IDs
function getKeysWithIds() external view returns (
    KeyV2[] memory keys,
    bytes32[] memory keyHashes
);

// ── Backwards Compatibility ──
/// Original authorize/revoke functions remain for super admin operations
function authorize(Key calldata key) external;
function revoke(bytes32 keyHash) external;
```

### 4.1  Challenge String Format

```text
Subject: PORTO-AUTH-<6-digit-code>
Body: PORTO|<chainId>|<eoa>|<action>|<keyHash>|<nonce>|<timestamp>|<keyId>

Where:
- action: "setEmail" | "addKey" | "revokeKey"
- keyHash: bytes32 (0x0 for setEmail)
- nonce: uint64 (must be > lastEmailNonce)
- timestamp: uint40 (must be recent, < 15 minutes)
- keyId: bytes32 (random UID for new keys, 0x0 for other actions)
```

### 4.2  Rate Limiting

- Max 5 passkey additions per week per account
- Email proof valid for 15 minutes
- Nonce must be strictly increasing

---

## 5 · zkEmail "Reply & Send" Flow

1. **Backend** sends an email to `user@example.com`:
   *Subject*: `PORTO‑AUTH 284716`
   *Body*: challenge line (see §4.1).
2. **User** clicks **Reply** and **Send** – the mail client automatically quotes the original body and keeps the subject.
3. **Relayer** monitors inbox via IMAP / Gmail API → grabs raw MIME.
4. **Proof** generated:

   * desktop → client‑side (WebAssembly) < 30 s
   * mobile Safari → server‑side fallback.
5. **Meta‑transaction** submitted to Base:

   * `setEmail()` (first‑time) **or** `addPasskey()` / `revokePasskey()`.
6. **IthacaAccountV2** verifies proof with `EmailAuth.verifyProof()` (≈ 350k gas) then updates storage.

---

## 6 · Implementation Tasks (LLM todo list)

> Every step is codable by an LLM with context of this file.

### 6.1  Contracts ( `/contracts/accountV2/` )

| Task | Path & File                    | Notes                                     |
| ---- | ------------------------------ | ----------------------------------------- |
| 1    | `accountV2/IthacaAccountV2.sol`  | Extends IthacaAccount, adds email functions |
| 2    | `accountV2/lib/EmailModuleLib.sol` | zkEmail proof verification wrapper   |
| 3    | `accountV2/interfaces/IIthacaAccountV2.sol` | Interface with new functions |
| 4    | `accountV2/test/IthacaAccountV2.t.sol` | Test email flows, storage migration |
| 5    | `accountV2/test/StorageMigration.t.sol` | Verify storage compatibility |

**Key Implementation Notes**:
- IthacaAccountV2 inherits from IthacaAccount
- Override `_getAccountStorage()` to return extended struct
- Add email-gated variants of authorize/revoke
- Maintain backward compatibility with V1 keys
- Use same storage slot derivation pattern

### 6.2  Relayer ( `/infrastructure/zkEmailRelayer` )

| File           | Purpose                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `index.ts`     | watch `verify@porto.app` via IMAP, run proof gen (snarkjs / wasm), post meta‑tx via wallet private key. |
| `challenge.ts` | helper to compose outbound mail.                                                                        |

### 6.3  Front‑End Updates

#### Dialog App (`/apps/dialog`)
- Update `account_verifyEmail.tsx` to handle zkEmail proof generation
- Enhance `VerifyEmail.tsx` component:
  - Show proof generation progress
  - Handle "Reply sent" polling state
  - Display email verification code
- Add device discovery flow ("Already logged in?" button)

#### ID App (`/apps/id`)  
- Update `_layout.email.verify.tsx` for zkEmail flow
- Enhance `Dashboard.tsx`:
  - Display devices with custom names (from off-chain DB)
  - Add/revoke device management UI
  - Show rate limiting status
- Add recovery flow components

#### SDK Updates (`/src`)
- Update `RpcSchema.ts` with new methods:
  - `wallet_setEmail`
  - `wallet_addPasskeyWithEmail`
  - `wallet_revokePasskeyWithEmail`
  - `wallet_getKeysWithIds`
- Extend `Key.ts` module:
  - Add `keyId` field to Key type
  - Support device name resolution
- Update `Account.ts` for email-based auth

### 6.4  Foundry scripts & Infrastructure

**Deployment Scripts**:
- `script/DeployIthacaV2.s.sol` – Deploy V2 implementation
- `script/UpgradeToV2.s.sol` – Upgrade existing accounts
- `script/DeployZkEmailVerifier.s.sol` – Deploy zkEmail contracts

**Device Name Service** (`/infrastructure/deviceNameService/`):
- Simple key-value store: `keyId` → device name
- Privacy-preserving (no PII on-chain)
- REST API for frontend integration
- Backed by PostgreSQL or Redis

**Transaction Sponsorship**:
- Extend existing Orchestrator sponsorship
- Monitor email verification transactions
- Sponsor on Base L2 for low costs

---

## 7 · Timeline (7 weeks)

1. **Week 1** – Contract scaffolding & storage unit tests.
2. **Week 2** – Integrate zkEmail verifier; verify sample proof vector.
3. **Week 3** – Passkey module migration; remove registry.
4. **Week 4** – Relayer MVP + SES/Gmail setup.
5. **Week 5** – Front‑end hooks & UX polish.
6. **Week 6** – Mobile proof benchmark; calldata compress; sponsor pipeline.
7. **Week 7** – Audit, main‑net deploy, docs, demo video.

---

## 8 · Security Checklist

* [ ] `forge build --sizes` runtime code < 24 576 bytes.
* [ ] Storage roots keccak‑tagged; no collision with v0.3.x state.
* [ ] Nonce monotonic (`uint64 lastEmailNonce`).
* [ ] Challenge timestamp < 900 s old.
* [ ] `setEmail()` callable **once**.
* [ ] Proof gas ≤ 400k; sponsorship budget OK.
* [ ] Audit Groth16 verifier byte‑code link matches circuit commit hash.

---

## 9 · Success Criteria

| Metric                        | Target                                       |
| ----------------------------- | -------------------------------------------- |
| Recovery success rate         | > 99% of test users recover with email only. |
| Passkey add/revoke gas (Base) | < 0.003 USD sponsored.                       |
| Proof generation desktop      | < 30 s (Intel i5 2019).                      |
| Proof generation mobile       | < 60 s via server fallback.                  |
| Audit                         | 0 critical, 0 high issues.                   |
| Code size                     | ≤ 23 kB runtime (safety margin).             |

---

## 10 · Porto-Specific Integration Notes

### 10.1 Existing Infrastructure
- IthacaAccount uses EIP-7702 with LibEIP7702 proxy pattern
- Orchestrator handles gas compensation and atomic execution
- Storage uses deterministic slots at EOA level
- GuardedExecutor provides execution safety
- Key management supports multiple key types

### 10.2 Key Integration Points
1. **Contracts**: Create V2 in new `contracts/accountV2/` directory
2. **Storage**: Extend AccountStorage struct maintaining slot compatibility
3. **Orchestrator**: Works unchanged with V2 accounts
4. **SDK**: Enhance existing modules with email support
5. **Dialog**: Build on existing email verification UI

### 10.3 Migration Strategy
1. Deploy IthacaAccountV2 implementation
2. Use `upgradeProxyAccount()` for seamless upgrades
3. Existing keys remain valid, email becomes optional recovery
4. Storage migration handled automatically via extended struct
5. Orchestrator continues to work without modification

### 10.4 UX Features to Preserve
- **Device Naming**: Random keyId stored on-chain, names off-chain
- **Device Discovery**: "Already logged in?" checks existing passkeys
- **Rate Limiting**: Max 5 devices/week enforced on-chain
- **Email Privacy**: Only hash stored, never raw email
- **Sponsored Transactions**: All operations remain gasless on L2

---

### Appendices

**A. GitHub reference links**

* zkEmail verifier & DKIM registry:
  [https://github.com/zkemail/zk-email-verify](https://github.com/zkemail/zk-email-verify)
* Email‑auth wrapper (sol):
  [https://github.com/zkemail/ether-email-auth-contracts](https://github.com/zkemail/ether-email-auth-contracts)
* Solady utils:
  [https://github.com/vectorized/solady](https://github.com/vectorized/solady)

---

> End of file – everything above is self‑contained context for automated refactoring.