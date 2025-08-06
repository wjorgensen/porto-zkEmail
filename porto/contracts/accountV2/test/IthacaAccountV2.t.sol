// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {IthacaAccountV2} from "../src/IthacaAccountV2.sol";
import {IthacaAccount} from "../src/base/IthacaAccount.sol";
import {EmailModule} from "../src/EmailModule.sol";
import {MockVerifier} from "./mocks/MockVerifier.sol";

contract IthacaAccountV2Test is Test {
    IthacaAccountV2 public account;
    EmailModule public emailModule;
    MockVerifier public verifier;
    address public orchestrator;
    address payable public user;
    
    // Test email data
    string constant TEST_EMAIL = "user@example.com";
    bytes32 constant TEST_EMAIL_HASH = keccak256(bytes(TEST_EMAIL));
    bytes32 constant TEST_KEY_ID = bytes32(uint256(0xabcd));
    
    event EmailAndPasskeyRegistered(
        address indexed account,
        bytes32 indexed emailHash,
        bytes32 indexed keyHash,
        bytes32 keyId
    );
    
    event PasskeyRevoked(bytes32 indexed keyHash, bytes32 indexed revokedBy);
    
    function setUp() public {
        orchestrator = makeAddr("orchestrator");
        user = payable(makeAddr("user"));
        
        // Deploy contracts
        emailModule = new EmailModule();
        verifier = new MockVerifier();
        account = new IthacaAccountV2(orchestrator);
        
        // For testing, deploy account code at user address
        vm.etch(user, address(account).code);
        account = IthacaAccountV2(user);
        
        // Set email module
        vm.prank(user);
        account.setEmailModule(address(emailModule));
    }
    
    function test_setEmailAndRegister() public {
        // Create test key
        IthacaAccount.Key memory key = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        // Create email proof
        bytes memory proof = _createMockEmailProof();
        
        // Set email and register passkey
        bytes32 expectedKeyHash = keccak256(abi.encode(key.keyType, keccak256(key.publicKey)));
        
        vm.expectEmit(true, true, true, true);
        emit EmailAndPasskeyRegistered(address(account), TEST_EMAIL_HASH, expectedKeyHash, TEST_KEY_ID);
        
        vm.prank(user);
        bytes32 keyHash = account.setEmailAndRegister(proof, TEST_EMAIL, key, TEST_KEY_ID);
        
        // Verify results
        assertEq(keyHash, expectedKeyHash);
        assertEq(account.getEmailHash(), TEST_EMAIL_HASH);
        assertEq(account.getKeyId(keyHash), TEST_KEY_ID);
        
        // Verify key was added
        (IthacaAccount.Key[] memory keys,) = account.getKeys();
        assertEq(keys.length, 1);
        assertEq(keccak256(keys[0].publicKey), keccak256(key.publicKey));
    }
    
    function test_setEmailAndRegister_revertIfAlreadySet() public {
        // Set email first time
        IthacaAccount.Key memory key = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        bytes memory proof = _createMockEmailProof();
        vm.prank(user);
        account.setEmailAndRegister(proof, TEST_EMAIL, key, TEST_KEY_ID);
        
        // Try to set again
        vm.expectRevert(IthacaAccountV2.EmailAlreadySet.selector);
        vm.prank(user);
        account.setEmailAndRegister(proof, TEST_EMAIL, key, bytes32(uint256(0x1234)));
    }
    
    function test_revokePasskey() public {
        // Setup: Add two passkeys
        IthacaAccount.Key memory key1 = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        IthacaAccount.Key memory key2 = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        // Register first key with email
        bytes memory proof = _createMockEmailProof();
        vm.prank(user);
        bytes32 keyHash1 = account.setEmailAndRegister(proof, TEST_EMAIL, key1, TEST_KEY_ID);
        
        // Add second key normally
        vm.prank(user);
        bytes32 keyHash2 = account.authorize(key2);
        
        // Create revocation message
        bytes32 digest = keccak256(abi.encode(
            "REVOKE_PASSKEY",
            address(account),
            keyHash2,
            block.chainid,
            block.timestamp
        ));
        
        // Sign with key1 to revoke key2
        bytes memory signature = _signDigest(digest, keyHash1);
        
        // Revoke key2 using key1
        vm.expectEmit(true, true, false, false);
        emit PasskeyRevoked(keyHash2, keyHash1);
        
        vm.prank(user);
        account.revokePasskey(keyHash2, signature);
        
        // Verify key2 was revoked
        (IthacaAccount.Key[] memory keys,) = account.getKeys();
        assertEq(keys.length, 1);
    }
    
    function test_revokePasskey_revertIfSelf() public {
        // Setup: Add one passkey
        IthacaAccount.Key memory key = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        bytes memory proof = _createMockEmailProof();
        vm.prank(user);
        bytes32 keyHash = account.setEmailAndRegister(proof, TEST_EMAIL, key, TEST_KEY_ID);
        
        // Try to revoke self
        bytes32 digest = keccak256(abi.encode(
            "REVOKE_PASSKEY",
            address(account),
            keyHash,
            block.chainid,
            block.timestamp
        ));
        
        bytes memory signature = _signDigest(digest, keyHash);
        
        vm.expectRevert(IthacaAccountV2.CannotRevokeSelf.selector);
        vm.prank(user);
        account.revokePasskey(keyHash, signature);
    }
    
    function test_revokePasskey_revertIfLastKey() public {
        // Setup: Add one passkey
        IthacaAccount.Key memory key = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.P256,
            isSuperAdmin: false,
            publicKey: _generateP256PublicKey()
        });
        
        bytes memory proof = _createMockEmailProof();
        vm.prank(user);
        bytes32 keyHash = account.setEmailAndRegister(proof, TEST_EMAIL, key, TEST_KEY_ID);
        
        // Even if we could sign with a different key, can't revoke last key
        vm.expectRevert(IthacaAccountV2.CannotRevokeLastKey.selector);
        vm.prank(user);
        account.revokePasskey(keyHash, "");
    }
    
    // Helper functions
    
    function _generateP256PublicKey() internal view returns (bytes memory) {
        uint256 x = uint256(keccak256(abi.encode(address(this), block.timestamp, "x")));
        uint256 y = uint256(keccak256(abi.encode(address(this), block.timestamp, "y")));
        return abi.encode(x, y);
    }
    
    function _createMockEmailProof() internal view returns (bytes memory) {
        // Mock email proof that EmailModule will accept
        // In production, this would be a real zkEmail proof
        
        // Need to use abi.encodePacked for email to match keccak256 in contract
        string memory emailForProof = TEST_EMAIL;
        
        EmailModule.EmailProof memory emailProof = EmailModule.EmailProof({
            domainName: emailForProof,
            publicKeyHash: bytes32(0),
            timestamp: block.timestamp,
            maskedCommand: string(abi.encodePacked(
                "PORTO|",
                vm.toString(block.chainid),
                "|",
                vm.toString(user),
                "|setEmail|0x0000000000000000000000000000000000000000000000000000000000000000|1|",
                vm.toString(block.timestamp),
                "|",
                vm.toString(bytes32(TEST_KEY_ID))
            )),
            emailNullifier: bytes32(0),
            accountSalt: bytes32(0),
            isCodeExist: false,
            proof: hex"00"
        });
        // Encode with verifier address prepended
        return abi.encode(address(verifier), emailProof);
    }
    
    function _signDigest(bytes32 digest, bytes32 keyHash) internal pure returns (bytes memory) {
        // Mock signature for testing
        // In production, this would be a real signature from the passkey
        return abi.encodePacked(digest, keyHash, uint8(0));
    }
}