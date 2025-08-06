// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import {IthacaFactoryV2} from "../src/IthacaFactoryV2.sol";
import {TestToken} from "../src/TestToken.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy factory
        IthacaFactoryV2 factory = new IthacaFactoryV2();
        console.log("IthacaFactoryV2 deployed at:", address(factory));
        
        // Deploy all contracts via factory
        bytes32 salt = bytes32(uint256(1));
        address pauseAuthority = deployer; // Use deployer as pause authority for testing
        
        (
            address orchestrator,
            address zkEmailVerifier,
            address accountImplementation,
            address accountProxy,
            address simulator
        ) = factory.deployAll(pauseAuthority, salt);
        
        console.log("Orchestrator deployed at:", orchestrator);
        console.log("ZKEmailVerifier deployed at:", zkEmailVerifier);
        console.log("IthacaAccountV2 implementation deployed at:", accountImplementation);
        console.log("Account proxy deployed at:", accountProxy);
        console.log("Simulator deployed at:", simulator);
        
        // Deploy test token
        TestToken testToken = new TestToken();
        console.log("TestToken deployed at:", address(testToken));
        
        vm.stopBroadcast();
        
        // Write deployment addresses to file
        string memory json = "deployments";
        vm.serializeAddress(json, "factory", address(factory));
        vm.serializeAddress(json, "orchestrator", orchestrator);
        vm.serializeAddress(json, "zkEmailVerifier", zkEmailVerifier);
        vm.serializeAddress(json, "accountImplementation", accountImplementation);
        vm.serializeAddress(json, "accountProxy", accountProxy);
        vm.serializeAddress(json, "simulator", simulator);
        string memory finalJson = vm.serializeAddress(json, "testToken", address(testToken));
        
        vm.writeJson(finalJson, "./deployments.json");
        console.log("Deployment addresses written to deployments.json");
    }
}