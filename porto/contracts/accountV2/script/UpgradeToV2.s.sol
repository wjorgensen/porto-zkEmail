// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IthacaAccount} from "../src/base/IthacaAccount.sol";
import {IthacaAccountV2} from "../src/IthacaAccountV2.sol";

contract UpgradeToV2 is Script {
    function run() external {
        uint256 userPrivateKey = vm.envUint("USER_PRIVATE_KEY");
        address v2Implementation = vm.envAddress("V2_IMPLEMENTATION_ADDRESS");
        address emailVerifier = vm.envAddress("EMAIL_VERIFIER_ADDRESS");
        
        address payable user = payable(vm.addr(userPrivateKey));
        console2.log("Upgrading account for user:", user);
        
        vm.startBroadcast(userPrivateKey);
        
        // In production, this would be done via EIP-7702 delegation
        // For the script, we assume the user has already delegated to v2Implementation
        console2.log("V2 Implementation:", v2Implementation);
        console2.log("Note: User must send EIP-7702 transaction to delegate to V2 implementation");
        
        // Cast to V2 and set email module
        IthacaAccountV2 accountV2 = IthacaAccountV2(user);
        accountV2.setEmailModule(emailVerifier);
        console2.log("Email module set:", emailVerifier);
        
        vm.stopBroadcast();
        
        console2.log("\n=== Upgrade Complete ===");
        console2.log("User:", user);
        console2.log("V2 Implementation:", v2Implementation);
        console2.log("Email Verifier:", emailVerifier);
        console2.log("=======================\n");
        
        // Verify V2 features are available
        console2.log("Verifying V2 features...");
        bytes32 emailHash = accountV2.getEmailHash();
        console2.log("Email hash (should be 0x0):", vm.toString(emailHash));
        
        // Check existing keys are preserved
        (IthacaAccount.Key[] memory keys,) = accountV2.getKeys();
        console2.log("Number of existing keys:", keys.length);
    }
}