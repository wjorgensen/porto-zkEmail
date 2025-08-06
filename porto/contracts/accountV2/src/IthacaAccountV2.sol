// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IthacaAccount} from "./base/IthacaAccount.sol";
import {EnumerableSetLib} from "solady/utils/EnumerableSetLib.sol";
import {SignatureCheckerLib} from "solady/utils/SignatureCheckerLib.sol";
import {P256} from "solady/utils/P256.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";

/// @title IthacaAccountV2
/// @author Porto Team
/// @notice Gas-optimized account extension for email registration and passkey management
/// @dev Inherits from IthacaAccount and adds one-time email registration with passkey revocation
contract IthacaAccountV2 is IthacaAccount {
    using EnumerableSetLib for EnumerableSetLib.Bytes32Set;

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        CUSTOM ERRORS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @custom:error EmailAlreadySet Thrown when attempting to set email after initial registration
    error EmailAlreadySet();
    
    /// @custom:error InvalidEmailProof Thrown when email verification fails
    error InvalidEmailProof();
    
    /// @custom:error CannotRevokeSelf Thrown when attempting to revoke own passkey
    error CannotRevokeSelf();
    
    /// @custom:error CannotRevokeLastKey Thrown when attempting to revoke the last active key
    error CannotRevokeLastKey();
    
    /// @custom:error InvalidSignature Thrown when signature verification fails
    error InvalidSignature();

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           EVENTS                             */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Emitted when email and initial passkey are registered
    /// @param account The account address
    /// @param emailHash The keccak256 hash of the email address
    /// @param keyHash The hash of the registered passkey
    /// @param keyId The device identifier for the passkey
    event EmailAndPasskeyRegistered(
        address indexed account,
        bytes32 indexed emailHash,
        bytes32 indexed keyHash,
        bytes32 keyId
    );

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           STORAGE                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @dev V2 storage struct for email and key management
    /// @dev Packed into minimal slots for gas efficiency
    struct AccountStorageV2 {
        /// @dev Email hash (keccak256 of email) - one-time settable
        bytes32 emailHash;
        /// @dev Mapping from keyHash to device ID (keyId)
        mapping(bytes32 => bytes32) keyIds;
        /// @dev Address of email verification module
        address emailModule;
    }

    /// @notice Returns V2 storage pointer
    /// @dev Uses truncated hash to reduce bytecode size
    /// @return $ Storage pointer
    function _getAccountStorageV2() internal pure returns (AccountStorageV2 storage $) {
        // Truncate to 9 bytes to reduce bytecode size
        uint256 s = uint72(bytes9(keccak256("ITHACA_ACCOUNT_V2_STORAGE")));
        /// @solidity memory-safe-assembly
        assembly {
            $.slot := s
        }
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                         CONSTRUCTOR                          */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Initializes the account with an orchestrator
    /// @param orchestrator The orchestrator address for account coordination
    constructor(address orchestrator) IthacaAccount(orchestrator) {}

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    PUBLIC FUNCTIONS                          */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Registers email and initial passkey (one-time operation)
    /// @dev Verifies email proof and stores hash permanently
    /// @param emailProof Encoded proof containing verifier and proof data
    /// @param email The email address to register
    /// @param key The initial passkey to authorize
    /// @param keyId Device identifier for the passkey
    /// @return keyHash The hash of the registered passkey
    function setEmailAndRegister(
        bytes calldata emailProof,
        string calldata email,
        Key calldata key,
        bytes32 keyId
    ) external returns (bytes32 keyHash) {
        AccountStorageV2 storage $ = _getAccountStorageV2();
        
        // Ensure email hasn't been set
        if ($.emailHash != 0) revert EmailAlreadySet();
        
        // Compute and verify email hash
        bytes32 computedEmailHash;
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            let len := email.length
            calldatacopy(ptr, email.offset, len)
            computedEmailHash := keccak256(ptr, len)
        }
        
        // Get email module (use orchestrator if not set)
        address emailModule = $.emailModule;
        if (emailModule == address(0)) emailModule = ORCHESTRATOR;
        
        // Decode verifier from proof and verify
        (address verifier, bytes memory actualProof) = abi.decode(emailProof, (address, bytes));
        
        // Call email module to verify proof
        (bool success,) = emailModule.staticcall(
            abi.encodeWithSelector(
                0x2a8f376b, // verifyEmailAndRegister(bytes,address,bytes32,address)
                actualProof,
                verifier,
                computedEmailHash,
                address(this)
            )
        );
        
        if (!success) revert InvalidEmailProof();
        
        // Store email hash
        $.emailHash = computedEmailHash;
        
        // Add the initial passkey
        keyHash = _addKey(key);
        
        // Store device ID mapping
        $.keyIds[keyHash] = keyId;
        
        emit EmailAndPasskeyRegistered(address(this), computedEmailHash, keyHash, keyId);
        emit Authorized(keyHash, key);
    }

    /// @notice Revokes a passkey using signature from another key
    /// @dev Prevents self-revocation and last-key revocation
    /// @param keyHashToRevoke The key hash to revoke
    /// @param signature Signature from a valid passkey authorizing revocation
    function revokePasskey(
        bytes32 keyHashToRevoke,
        bytes calldata signature
    ) external {
        // Create revocation message with 1-hour validity window
        bytes32 messageHash;
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, keyHashToRevoke)
            mstore(add(ptr, 0x20), address())
            mstore(add(ptr, 0x40), chainid())
            mstore(add(ptr, 0x60), div(timestamp(), 3600))
            messageHash := keccak256(ptr, 0x80)
        }
        
        // Verify signature and get signer's key hash
        bytes32 signerKeyHash = _verifySignatureAndGetKeyHash(messageHash, signature);
        
        // Security checks
        if (signerKeyHash == keyHashToRevoke) revert CannotRevokeSelf();
        if (_countActiveKeys() <= 1) revert CannotRevokeLastKey();
        
        // Revoke the key
        _removeKey(keyHashToRevoke);
        
        // Clean up device ID mapping
        delete _getAccountStorageV2().keyIds[keyHashToRevoke];
        
        emit Revoked(keyHashToRevoke);
    }

    /// @notice Sets the email verification module address
    /// @dev Can only be called by the account itself
    /// @param module The address of the email verification module
    function setEmailModule(address module) external onlyThis {
        _getAccountStorageV2().emailModule = module;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                      VIEW FUNCTIONS                          */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Returns the registered email hash
    /// @return The keccak256 hash of the email address
    function getEmailHash() external view returns (bytes32) {
        return _getAccountStorageV2().emailHash;
    }

    /// @notice Returns the device ID for a given key hash
    /// @param keyHash The key hash to query
    /// @return The device ID associated with the key
    function getKeyId(bytes32 keyHash) external view returns (bytes32) {
        return _getAccountStorageV2().keyIds[keyHash];
    }

    /// @notice Returns the email verification module address
    /// @dev Falls back to orchestrator if not explicitly set
    /// @return The email module address
    function getEmailModule() external view returns (address) {
        AccountStorageV2 storage $ = _getAccountStorageV2();
        return $.emailModule == address(0) ? ORCHESTRATOR : $.emailModule;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    INTERNAL FUNCTIONS                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Counts the number of active (non-expired) keys
    /// @dev Used to prevent revoking the last key
    /// @return count The number of active keys
    function _countActiveKeys() internal view returns (uint256 count) {
        AccountStorage storage $ = _getAccountStorage();
        uint256 total = $.keyHashes.length();
        
        unchecked {
            for (uint256 i; i < total; ++i) {
                Key memory key = getKey($.keyHashes.at(i));
                // Check if key is not expired
                if (key.expiry == 0 || block.timestamp <= key.expiry) {
                    ++count;
                }
            }
        }
    }

    /// @notice Verifies signature and returns the signer's key hash
    /// @dev Checks all registered keys for valid signature
    /// @param messageHash The message hash to verify
    /// @param signature The signature to validate
    /// @return keyHash The key hash of the valid signer
    function _verifySignatureAndGetKeyHash(
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bytes32 keyHash) {
        // Apply EIP-712 domain separation
        bytes32 digest = _hashTypedData(messageHash);
        
        AccountStorage storage $ = _getAccountStorage();
        uint256 total = $.keyHashes.length();
        
        for (uint256 i; i < total; ) {
            keyHash = $.keyHashes.at(i);
            Key memory key = getKey(keyHash);
            
            // Skip expired keys
            if (key.expiry != 0 && block.timestamp > key.expiry) {
                unchecked { ++i; }
                continue;
            }
            
            // Check signature based on key type
            bool isValid;
            if (key.keyType == KeyType.P256) {
                (bytes32 r, bytes32 s) = P256.tryDecodePointCalldata(signature);
                (bytes32 x, bytes32 y) = P256.tryDecodePoint(key.publicKey);
                isValid = P256.verifySignature(digest, r, s, x, y);
            } else if (key.keyType == KeyType.WebAuthnP256) {
                (bytes32 x, bytes32 y) = P256.tryDecodePoint(key.publicKey);
                isValid = WebAuthn.verify(
                    abi.encode(digest), false, WebAuthn.tryDecodeAuth(signature), x, y
                );
            } else if (key.keyType == KeyType.Secp256k1) {
                isValid = SignatureCheckerLib.isValidSignatureNowCalldata(
                    abi.decode(key.publicKey, (address)), digest, signature
                );
            }
            
            if (isValid) return keyHash;
            unchecked { ++i; }
        }
        
        revert InvalidSignature();
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    OVERRIDE FUNCTIONS                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Authorizes a key with optional device ID support
    /// @dev Overrides base function to support keyId extraction from calldata
    /// @param key The key to authorize
    /// @return keyHash The hash of the authorized key
    function authorize(Key memory key) public override onlyThis returns (bytes32 keyHash) {
        keyHash = super.authorize(key);
        
        // No keyId extraction in authorize to save bytecode
    }

    /// @notice Returns EIP712 domain name and version
    /// @dev Used for signature verification
    /// @return name The domain name
    /// @return version The domain version
    function _domainNameAndVersion()
        internal
        pure
        virtual
        override
        returns (string memory name, string memory version)
    {
        name = "IthacaAccount";
        version = "2.0.0";
    }
}