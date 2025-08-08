// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title DeploymentHelper
/// @author Porto Team
/// @notice Helper contract for deploying the zkEmail verification system
/// @dev Simplifies deployment by bundling verifier addresses and setup
contract DeploymentHelper {
    
    /// @notice Deployed addresses of the verification system
    struct DeployedContracts {
        address groth16Verifier;  // The circuit verifier contract
        address zkEmailVerifier;  // The ZKEmailVerifierV2 contract
    }
    
    /// @notice Deploys and returns the verification system addresses
    /// @dev This would typically be called during initial deployment
    /// @param _groth16Verifier Address of the pre-deployed circuit verifier
    /// @return contracts The deployed contract addresses
    function getDeploymentInfo(address _groth16Verifier) 
        external 
        pure 
        returns (DeployedContracts memory contracts) 
    {
        contracts = DeployedContracts({
            groth16Verifier: _groth16Verifier,
            zkEmailVerifier: address(0) // Set after ZKEmailVerifierV2 deployment
        });
    }
    
    /// @notice Encodes the public inputs for the circuit
    /// @dev Helper for frontend to properly format inputs
    /// @param inputs Raw input data to be encoded
    /// @return encoded The properly formatted 11-element array
    function encodePublicInputs(uint256[] calldata inputs) 
        external 
        pure 
        returns (uint256[11] memory encoded) 
    {
        require(inputs.length == 11, "Must provide exactly 11 inputs");
        
        unchecked {
            for (uint256 i = 0; i < 11; ++i) {
                encoded[i] = inputs[i];
            }
        }
    }
}