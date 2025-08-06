// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IIthacaAccount} from "@account/interfaces/IIthacaAccount.sol";
import {IthacaAccount} from "@account/IthacaAccount.sol";

/// @title IIthacaAccountV2
/// @notice Extended interface for IthacaAccount with email registration
interface IIthacaAccountV2 is IIthacaAccount {
    
    /// @notice Set email and register initial passkey in one transaction
    /// @param emailProof The zkEmail proof
    /// @param email The email address
    /// @param key The initial passkey to register
    /// @param keyId The device ID for the initial passkey
    /// @return keyHash The hash of the registered passkey
    function setEmailAndRegister(
        bytes calldata emailProof,
        string calldata email,
        IthacaAccount.Key calldata key,
        bytes32 keyId
    ) external returns (bytes32 keyHash);
    
    /// @notice Revoke a passkey using signature from another valid passkey
    /// @param keyHashToRevoke The hash of the key to revoke
    /// @param signature The signature from a valid passkey
    function revokePasskey(
        bytes32 keyHashToRevoke,
        bytes calldata signature
    ) external;
    
    /// @notice Set the email module address
    /// @param module The address of the email verification module
    function setEmailModule(address module) external;
    
    /// @notice Get the registered email hash
    /// @return The email hash (0 if not set)
    function getEmailHash() external view returns (bytes32);
    
    /// @notice Get the device ID for a key
    /// @param keyHash The hash of the key
    /// @return The device ID
    function getKeyId(bytes32 keyHash) external view returns (bytes32);
    
    /// @notice Get the email module address
    /// @return The email module address
    function getEmailModule() external view returns (address);
}