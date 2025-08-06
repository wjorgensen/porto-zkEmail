// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title EmailModule
/// @author Porto Team
/// @notice Gas-optimized standalone contract for zkEmail verification in Porto accounts
/// @dev Deployed separately to reduce main account contract size
contract EmailModule {
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          CONSTANTS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @dev Maximum allowed timestamp difference (15 minutes)
    uint256 private constant MAX_TIMESTAMP_DELTA = 900;

    /// @dev Porto protocol identifier in email body
    bytes32 private constant BODY_PREFIX = bytes32("PORTO");

    /// @dev Action identifiers packed as bytes32 for gas efficiency
    bytes32 private constant ACTION_SET_EMAIL = bytes32("setEmail");
    bytes32 private constant ACTION_ADD_KEY = bytes32("addKey");
    bytes32 private constant ACTION_REVOKE_KEY = bytes32("revokeKey");

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        CUSTOM ERRORS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @custom:error InvalidBodyFormat The email body doesn't match expected format
    error InvalidBodyFormat();

    /// @custom:error InvalidChainId The chain ID in proof doesn't match current chain
    error InvalidChainId();

    /// @custom:error InvalidEOA The EOA address in proof doesn't match expected
    error InvalidEOA();

    /// @custom:error ProofExpired The proof timestamp is too old
    error ProofExpired();

    /// @custom:error InvalidNonce The nonce is not monotonically increasing
    error InvalidNonce();

    /// @custom:error InvalidAction The action specified is not recognized
    error InvalidAction();

    /// @custom:error VerificationFailed zkEmail verification failed
    error VerificationFailed();

    /// @custom:error InvalidEmailHash The email hash doesn't match expected
    error InvalidEmailHash();

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           STRUCTS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Parsed email challenge data returned to caller
    /// @custom:storage-location memory
    struct ParsedChallenge {
        bytes32 action;
        bytes32 keyHash;
        uint64 nonce;
        bytes32 keyId;
    }

    /// @notice Email proof structure for zkEmail verification
    /// @dev Matches the expected format from zkEmail verifier
    /// @custom:storage-location memory
    struct EmailProof {
        string domainName;
        bytes32 publicKeyHash;
        uint256 timestamp;
        string maskedCommand;
        bytes32 emailNullifier;
        bytes32 accountSalt;
        bool isCodeExist;
        bytes proof;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                     VERIFICATION LOGIC                       */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Verifies email proof and returns parsed data for registration
    /// @dev Main entry point for email verification during initial setup
    /// @param proof The encoded email proof
    /// @param verifier The address of the zkEmail verifier contract
    /// @param expectedEmailHash The expected email hash
    /// @param expectedEoa The expected EOA address
    /// @return challenge The parsed challenge data
    function verifyEmailAndRegister(
        bytes calldata proof,
        address verifier,
        bytes32 expectedEmailHash,
        address expectedEoa
    ) external view returns (ParsedChallenge memory challenge) {
        // Decode and verify the proof
        EmailProof memory emailProof = abi.decode(proof, (EmailProof));
        
        // Verify email hash matches
        _verifyEmailHash(emailProof.domainName, expectedEmailHash);
        
        // Call zkEmail verifier
        _callVerifier(verifier, emailProof);
        
        // Parse the challenge from maskedCommand
        (uint256 chainId, address eoa, bytes32 action, bytes32 keyHash, uint64 nonce, , bytes32 keyId) = 
            _parseChallenge(emailProof.maskedCommand);
        
        // Validate chain ID
        if (chainId != block.chainid) revert InvalidChainId();
        
        // Validate EOA
        if (eoa != expectedEoa) revert InvalidEOA();
        
        // Validate timestamp
        _validateTimestamp(emailProof.timestamp);
        
        // Validate action
        if (action != ACTION_SET_EMAIL && action != ACTION_ADD_KEY && action != ACTION_REVOKE_KEY) {
            revert InvalidAction();
        }
        
        // Return parsed challenge
        challenge = ParsedChallenge({
            action: action,
            keyHash: keyHash,
            nonce: nonce,
            keyId: keyId
        });
    }

    /// @notice Verifies email proof for non-registration actions
    /// @dev Entry point for add/revoke key operations
    /// @param proof The encoded email proof
    /// @param verifier The address of the zkEmail verifier contract
    /// @param expectedEmailHash The expected email hash
    /// @param expectedEoa The expected EOA address
    /// @param lastNonce The last nonce used by this account
    /// @return challenge The parsed challenge data
    function verifyEmailAction(
        bytes calldata proof,
        address verifier,
        bytes32 expectedEmailHash,
        address expectedEoa,
        uint64 lastNonce
    ) external view returns (ParsedChallenge memory challenge) {
        // Get base verification
        challenge = this.verifyEmailAndRegister(proof, verifier, expectedEmailHash, expectedEoa);
        
        // Additional nonce validation for actions
        if (challenge.nonce <= lastNonce) revert InvalidNonce();
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    INTERNAL FUNCTIONS                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Verifies the email hash matches expected
    /// @dev Uses inline assembly for gas efficiency
    /// @param domainName The email address from proof
    /// @param expectedHash The expected email hash
    function _verifyEmailHash(string memory domainName, bytes32 expectedHash) private pure {
        /// @solidity memory-safe-assembly
        assembly {
            let len := mload(domainName)
            let computed := keccak256(add(domainName, 0x20), len)
            
            if iszero(eq(computed, expectedHash)) {
                mstore(0x00, 0x45ed70b7) // InvalidEmailHash()
                revert(0x1c, 0x04)
            }
        }
    }

    /// @notice Calls the zkEmail verifier contract
    /// @dev Uses low-level staticcall for gas efficiency
    /// @param verifier The verifier contract address
    /// @param emailProof The email proof to verify
    function _callVerifier(address verifier, EmailProof memory emailProof) private view {
        // Encode the function call
        bytes memory callData = abi.encodeWithSignature(
            "verifyEmailProof((string,bytes32,uint256,string,bytes32,bytes32,bool,bytes))",
            emailProof
        );
        
        // Make the static call
        /// @solidity memory-safe-assembly
        assembly {
            let success := staticcall(
                gas(),
                verifier,
                add(callData, 0x20),
                mload(callData),
                0x00,
                0x20
            )
            
            // Check if call succeeded and returned true
            if or(iszero(success), iszero(mload(0x00))) {
                mstore(0x00, 0x8baa579f) // VerificationFailed()
                revert(0x1c, 0x04)
            }
        }
    }

    /// @notice Parses the challenge string from email body
    /// @dev Extracts parameters from format: PORTO|chainId|eoa|action|keyHash|nonce|timestamp|keyId
    /// @param maskedCommand The masked command from email body
    /// @return chainId The chain ID from challenge
    /// @return eoa The EOA address from challenge
    /// @return action The action identifier
    /// @return keyHash The key hash
    /// @return nonce The nonce value
    /// @return parsedTimestamp The timestamp
    /// @return keyId The key identifier
    function _parseChallenge(string memory maskedCommand) 
        private 
        pure 
        returns (
            uint256 chainId,
            address eoa,
            bytes32 action,
            bytes32 keyHash,
            uint64 nonce,
            uint256 parsedTimestamp,
            bytes32 keyId
        ) 
    {
        bytes memory commandBytes = bytes(maskedCommand);
        uint256 length = commandBytes.length;
        
        // Validate minimum length
        if (length < 100) revert InvalidBodyFormat();
        
        // Use assembly for gas-efficient parsing
        /// @solidity memory-safe-assembly
        assembly {
            let dataPtr := add(commandBytes, 0x20)
            let currentPos := 0
            let fieldIndex := 0
            let fieldStart := 0
            
            // Helper to convert ASCII digits to uint
            function parseUint(start, end, data) -> result {
                result := 0
                for { let i := start } lt(i, end) { i := add(i, 1) } {
                    let digit := byte(0, mload(add(data, i)))
                    // Ensure it's a digit (0-9)
                    if or(lt(digit, 0x30), gt(digit, 0x39)) {
                        mstore(0x00, 0xefa92c9b) // InvalidBodyFormat()
                        revert(0x1c, 0x04)
                    }
                    result := add(mul(result, 10), sub(digit, 0x30))
                }
            }
            
            // Helper to parse hex address (0x...)
            function parseAddress(start, data) -> addr {
                // Skip "0x" prefix
                let pos := add(start, 2)
                addr := 0
                
                for { let i := 0 } lt(i, 40) { i := add(i, 1) } {
                    let b := byte(0, mload(add(add(data, pos), i)))
                    let nibble := 0
                    
                    // Convert hex char to nibble
                    // 0-9
                    if and(iszero(lt(b, 0x30)), iszero(gt(b, 0x39))) {
                        nibble := sub(b, 0x30)
                    }
                    // A-F
                    if and(iszero(lt(b, 0x41)), iszero(gt(b, 0x46))) {
                        nibble := sub(b, 0x37)
                    }
                    // a-f
                    if and(iszero(lt(b, 0x61)), iszero(gt(b, 0x66))) {
                        nibble := sub(b, 0x57)
                    }
                    // Invalid hex char
                    if iszero(nibble) {
                        if iszero(and(eq(b, 0x30), eq(i, 0))) {
                            mstore(0x00, 0xefa92c9b) // InvalidBodyFormat()
                            revert(0x1c, 0x04)
                        }
                    }
                    
                    addr := or(shl(4, addr), nibble)
                }
            }
            
            // Helper to parse bytes32 value
            function parseBytes32(start, end, data) -> result {
                let len := sub(end, start)
                if gt(len, 32) { len := 32 }
                
                result := 0
                for { let i := 0 } lt(i, len) { i := add(i, 1) } {
                    let byteVal := byte(0, mload(add(add(data, start), i)))
                    result := or(shl(8, result), byteVal)
                }
                // Left-align the result
                result := shl(mul(8, sub(32, len)), result)
            }
            
            // Parse fields separated by |
            for { } lt(currentPos, length) { currentPos := add(currentPos, 1) } {
                let currentByte := byte(0, mload(add(dataPtr, currentPos)))
                
                // Check for separator |
                if eq(currentByte, 0x7c) {
                    switch fieldIndex
                    case 0 {
                        // Validate PORTO prefix
                        let prefix := parseBytes32(fieldStart, currentPos, dataPtr)
                        if iszero(eq(prefix, 0x504f52544f000000000000000000000000000000000000000000000000000000)) {
                            mstore(0x00, 0xefa92c9b) // InvalidBodyFormat()
                            revert(0x1c, 0x04)
                        }
                    }
                    case 1 {
                        // Parse chainId (numeric string)
                        chainId := parseUint(fieldStart, currentPos, dataPtr)
                    }
                    case 2 {
                        // Parse EOA address (hex string with 0x prefix)
                        eoa := parseAddress(fieldStart, dataPtr)
                    }
                    case 3 {
                        // Parse action
                        action := parseBytes32(fieldStart, currentPos, dataPtr)
                    }
                    case 4 {
                        // Parse keyHash
                        keyHash := parseBytes32(fieldStart, currentPos, dataPtr)
                    }
                    case 5 {
                        // Parse nonce (numeric string)
                        nonce := parseUint(fieldStart, currentPos, dataPtr)
                    }
                    case 6 {
                        // Parse timestamp (numeric string)
                        parsedTimestamp := parseUint(fieldStart, currentPos, dataPtr)
                    }
                    
                    fieldStart := add(currentPos, 1)
                    fieldIndex := add(fieldIndex, 1)
                }
            }
            
            // Parse last field (keyId)
            if eq(fieldIndex, 7) {
                keyId := parseBytes32(fieldStart, length, dataPtr)
            }
            
            // Validate all fields were parsed
            if iszero(eq(fieldIndex, 7)) {
                mstore(0x00, 0xefa92c9b) // InvalidBodyFormat()
                revert(0x1c, 0x04)
            }
        }
    }

    /// @notice Validates the timestamp is within allowed window
    /// @dev Ensures proof is not older than MAX_TIMESTAMP_DELTA
    /// @param proofTimestamp The timestamp from the email proof
    function _validateTimestamp(uint256 proofTimestamp) private view {
        unchecked {
            uint256 currentTime = block.timestamp;
            uint256 delta = currentTime > proofTimestamp 
                ? currentTime - proofTimestamp 
                : proofTimestamp - currentTime;
                
            if (delta > MAX_TIMESTAMP_DELTA) {
                revert ProofExpired();
            }
        }
    }
}