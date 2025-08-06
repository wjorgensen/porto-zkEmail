// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IthacaAccountV2} from "../src/IthacaAccountV2.sol";
import {EmailModule} from "../src/EmailModule.sol";

contract DeployIthacaV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address orchestrator = vm.envAddress("ORCHESTRATOR_ADDRESS");
        address emailVerifier = vm.envOr("EMAIL_VERIFIER_ADDRESS", address(0));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy IthacaAccountV2 implementation
        IthacaAccountV2 implementation = new IthacaAccountV2(orchestrator);
        console2.log("IthacaAccountV2 deployed at:", address(implementation));
        
        // Deploy email module if not provided
        if (emailVerifier == address(0)) {
            console2.log("Deploying email module...");
            EmailModule emailModule = new EmailModule();
            emailVerifier = address(emailModule);
            console2.log("Email module deployed at:", emailVerifier);
        }
        
        vm.stopBroadcast();
        
        // Log deployment info
        console2.log("\n=== Deployment Summary ===");
        console2.log("IthacaAccountV2 Implementation:", address(implementation));
        console2.log("Orchestrator:", orchestrator);
        console2.log("Email Verifier:", emailVerifier);
        console2.log("========================\n");
        
        // Write deployment addresses to file
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "implementation": "', vm.toString(address(implementation)), '",\n',
            '  "orchestrator": "', vm.toString(orchestrator), '",\n',
            '  "emailVerifier": "', vm.toString(emailVerifier), '"\n',
            '}'
        ));
        
        vm.writeFile("./deployment-v2.json", json);
        console2.log("Deployment addresses written to deployment-v2.json");
    }
}