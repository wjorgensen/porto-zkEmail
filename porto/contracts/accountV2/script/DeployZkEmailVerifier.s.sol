// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IDKIMRegistry {
    function isDKIMPublicKeyHashValid(
        string memory domainName,
        bytes32 publicKeyHash
    ) external view returns (bool);
}

interface IEmailAuthVerifier {
    function verifyEmailProof(
        string memory domainName,
        bytes32 publicKeyHash,
        uint256 timestamp,
        string memory maskedCommand,
        bytes32 emailNullifier,
        bytes32 accountSalt,
        bool isCodeExist,
        bytes memory proof
    ) external view returns (bool);
}

contract DeployZkEmailVerifier is Script {
    // Addresses from zkEmail deployments
    address constant DKIM_REGISTRY_BASE = 0x0000000000000000000000000000000000000000; // TODO: Add actual address
    address constant EMAIL_AUTH_VERIFIER_BASE = 0x0000000000000000000000000000000000000000; // TODO: Add actual address
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // For production, use the zkEmail deployed contracts
        address dkimRegistry = DKIM_REGISTRY_BASE;
        address emailAuthVerifier = EMAIL_AUTH_VERIFIER_BASE;
        
        // Verify contracts are deployed
        require(dkimRegistry.code.length > 0, "DKIM Registry not deployed");
        require(emailAuthVerifier.code.length > 0, "Email Auth Verifier not deployed");
        
        vm.stopBroadcast();
        
        // Log addresses
        console2.log("\n=== zkEmail Infrastructure ===");
        console2.log("DKIM Registry:", dkimRegistry);
        console2.log("Email Auth Verifier:", emailAuthVerifier);
        console2.log("=============================\n");
        
        // Write to file
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "dkimRegistry": "', vm.toString(dkimRegistry), '",\n',
            '  "emailAuthVerifier": "', vm.toString(emailAuthVerifier), '"\n',
            '}'
        ));
        
        vm.writeFile("./zkemail-deployment.json", json);
        console2.log("zkEmail addresses written to zkemail-deployment.json");
    }
}