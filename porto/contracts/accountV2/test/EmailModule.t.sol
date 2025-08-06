// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {EmailModule} from "../src/EmailModule.sol";

contract MockVerifier {
    function verifyEmailProof(EmailModule.EmailProof memory) external pure returns (bool) {
        return true;
    }
}

contract EmailModuleTest is Test {
    EmailModule public module;
    MockVerifier public verifier;
    
    function setUp() public {
        module = new EmailModule();
        verifier = new MockVerifier();
    }
    
    function test_verifyEmailAndRegister_gas() public {
        // Create test proof
        EmailModule.EmailProof memory proof = EmailModule.EmailProof({
            domainName: "user@example.com",
            publicKeyHash: bytes32(0),
            timestamp: block.timestamp,
            maskedCommand: string(abi.encodePacked(
                "PORTO|",
                vm.toString(block.chainid),
                "|0x1234567890123456789012345678901234567890|setEmail|0x0000000000000000000000000000000000000000000000000000000000000000|1|",
                vm.toString(block.timestamp),
                "|0x0000000000000000000000000000000000000000000000000000000000000000"
            )),
            emailNullifier: bytes32(0),
            accountSalt: bytes32(0),
            isCodeExist: false,
            proof: ""
        });
        
        bytes memory encodedProof = abi.encode(proof);
        bytes32 expectedEmailHash = keccak256(bytes("user@example.com"));
        address expectedEoa = 0x1234567890123456789012345678901234567890;
        
        // Test gas usage
        uint256 gasBefore = gasleft();
        EmailModule.ParsedChallenge memory challenge = module.verifyEmailAndRegister(
            encodedProof,
            address(verifier),
            expectedEmailHash,
            expectedEoa
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        // Log gas usage
        emit log_named_uint("Gas used for verifyEmailAndRegister", gasUsed);
        
        // Verify results
        assertEq(challenge.action, bytes32("setEmail"));
        assertEq(challenge.nonce, 1);
    }
    
    function test_deployment_size() public {
        // Get deployment bytecode size
        uint256 size;
        address addr = address(module);
        assembly {
            size := extcodesize(addr)
        }
        emit log_named_uint("EmailModule deployment size (bytes)", size);
        emit log_named_uint("EmailModule deployment size (KB)", size / 1024);
    }
}