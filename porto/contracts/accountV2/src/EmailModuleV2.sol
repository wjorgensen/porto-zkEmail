// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./ZKEmailVerifierV2.sol";

/// @title EmailModuleV2
/// @author Porto Team
/// @notice Email module with Groth16 zkEmail proof verification
/// @dev Integrates with ZKEmailVerifierV2 which uses the circuit verifier
contract EmailModuleV2 {
    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          CONSTANTS                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @dev Action identifiers for email operations
    bytes32 private constant ACTION_SET_EMAIL = bytes32("setEmail");
    bytes32 private constant ACTION_ADD_KEY = bytes32("addKey");
    bytes32 private constant ACTION_REVOKE_KEY = bytes32("revokeKey");

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                        CUSTOM ERRORS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @custom:error Invalid proof components provided
    error InvalidProofData();
    /// @custom:error Verification with the circuit failed
    error VerificationFailed();
    /// @custom:error Email not verified for account
    error EmailNotVerified();

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                           STRUCTS                            */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice ZK Email proof data structure with Groth16 components
    /// @dev Contains the proof components and public inputs for circuit verification
    struct ZKEmailProof {
        uint256[2] a;            // Groth16 proof component a (G1 point)
        uint256[2][2] b;         // Groth16 proof component b (G2 point)
        uint256[2] c;            // Groth16 proof component c (G1 point)
        uint256[11] publicInputs; // The 11 public inputs expected by circuit
        string emailAddress;     // Email address being verified
    }

    /// @notice Verification result structure
    /// @dev Simplified to just track verification status and email
    struct VerificationResult {
        bool isValid;
        string emailAddress;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                     VERIFICATION LOGIC                       */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Verifies email proof for account registration
    /// @dev Forwards the proof to ZKEmailVerifierV2 for circuit verification
    /// @param proof The ZK email proof containing Groth16 components
    /// @param verifier The address of the ZKEmailVerifierV2 contract
    /// @return result The verification result
    function verifyEmailForRegistration(
        ZKEmailProof calldata proof,
        address verifier
    ) external returns (VerificationResult memory result) {
        // Validate proof has required components
        _validateProofData(proof);
        
        // Create proof structure for verifier
        ZKEmailVerifierV2.EmailProof memory verifierProof = ZKEmailVerifierV2.EmailProof({
            proof: ZKEmailVerifierV2.Groth16Proof({
                a: proof.a,
                b: proof.b,
                c: proof.c
            }),
            publicInputs: proof.publicInputs
        });
        
        // Call verifier contract with proof
        try ZKEmailVerifierV2(verifier).verifyEmailProof(
            verifierProof,
            proof.emailAddress
        ) returns (bool success) {
            if (!success) {
                revert VerificationFailed();
            }
        } catch {
            revert VerificationFailed();
        }
        
        // Return successful verification result
        result = VerificationResult({
            isValid: true,
            emailAddress: proof.emailAddress
        });
    }


    /// @notice Checks if an email is verified for an account
    /// @dev Queries the verifier contract for verification status
    /// @param verifier The address of the ZKEmailVerifierV2 contract
    /// @param account The account to check
    /// @return isVerified Whether the email is verified
    /// @return emailAddress The verified email address
    function getVerifiedEmail(
        address verifier,
        address account
    ) external view returns (bool isVerified, string memory emailAddress) {
        ZKEmailVerifierV2.VerifiedEmail memory verified = ZKEmailVerifierV2(verifier).getVerifiedEmail(account);
        
        isVerified = bytes(verified.emailAddress).length > 0;
        emailAddress = verified.emailAddress;
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                    INTERNAL FUNCTIONS                        */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /// @notice Validates the proof data structure
    /// @dev Ensures all proof components are present
    function _validateProofData(ZKEmailProof calldata proof) private pure {
        // Check that email address is provided
        if (bytes(proof.emailAddress).length == 0) revert InvalidProofData();
        
        // Proof components a, b, c and publicInputs are fixed-size arrays
        // so they cannot be empty, but we validate the values aren't all zero
        bool hasValidProof = false;
        
        // Check if at least one component is non-zero
        unchecked {
            if (proof.a[0] != 0 || proof.a[1] != 0) hasValidProof = true;
            if (proof.c[0] != 0 || proof.c[1] != 0) hasValidProof = true;
        }
        
        if (!hasValidProof) revert InvalidProofData();
    }
}