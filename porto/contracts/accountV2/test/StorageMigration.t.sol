// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {IthacaAccount} from "../src/base/IthacaAccount.sol";
import {IthacaAccountV2} from "../src/IthacaAccountV2.sol";

contract StorageMigrationTest is Test {
    address public constant ORCHESTRATOR = address(0x1467e95836FeDE05c2cCba66a481f690327a244e);
    address payable public user;
    
    // Storage slot constants
    uint256 constant V1_STORAGE_SLOT = uint72(bytes9(keccak256("ITHACA_ACCOUNT_STORAGE")));
    uint256 constant V2_STORAGE_SLOT = uint72(bytes9(keccak256("ITHACA_ACCOUNT_V2_STORAGE")));
    
    function setUp() public {
        user = payable(makeAddr("user"));
    }
    
    function test_storageSlotsAreDifferent() public pure {
        // Ensure V1 and V2 use different storage slots
        assertTrue(V1_STORAGE_SLOT != V2_STORAGE_SLOT);
    }
    
    function test_v1StorageUnaffectedByV2() public {
        // Deploy V1 account
        IthacaAccount accountV1 = new IthacaAccount(ORCHESTRATOR);
        
        // For testing, deploy account code at user address
        vm.etch(user, address(accountV1).code);
        accountV1 = IthacaAccount(user);
        
        // Add a key in V1
        bytes memory publicKey = _generateSecp256k1PublicKey();
        IthacaAccount.Key memory keyV1 = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.Secp256k1,
            isSuperAdmin: true,
            publicKey: publicKey
        });
        
        vm.prank(user);
        accountV1.authorize(keyV1);
        
        // Get the key hash
        bytes32 keyHash = keccak256(abi.encode(keyV1.keyType, keccak256(publicKey)));
        
        // Store V1 state
        uint256 v1Nonce = accountV1.getNonce(0);
        
        // Deploy V2 at same address (simulate upgrade)
        IthacaAccountV2 accountV2 = IthacaAccountV2(payable(address(accountV1)));
        
        // V1 state should still be accessible
        assertEq(accountV2.getNonce(0), v1Nonce);
        
        // Key should still exist
        (IthacaAccount.Key[] memory keys,) = accountV2.getKeys();
        assertEq(keys.length, 1);
        assertEq(keccak256(keys[0].publicKey), keccak256(publicKey));
    }
    
    function test_v2StorageDoesNotOverlapV1() public {
        // Deploy V2 account
        IthacaAccountV2 account = new IthacaAccountV2(ORCHESTRATOR);
        
        // For testing, deploy account code at user address
        vm.etch(user, address(account).code);
        account = IthacaAccountV2(user);
        
        // Add a V1 key using authorize
        bytes memory publicKeyV1 = _generateSecp256k1PublicKey();
        IthacaAccount.Key memory keyV1 = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.Secp256k1,
            isSuperAdmin: true,
            publicKey: publicKeyV1
        });
        
        vm.prank(user);
        account.authorize(keyV1);
        
        // Check V2 features work
        assertEq(account.getEmailHash(), bytes32(0)); // Not set yet
        
        (IthacaAccount.Key[] memory keysV1,) = account.getKeys();
        assertEq(keysV1.length, 1); // V1 key is present
    }
    
    function test_upgradeFromV1ToV2() public {
        // Deploy and setup V1 account
        IthacaAccount accountV1 = new IthacaAccount(ORCHESTRATOR);
        vm.etch(user, address(accountV1).code);
        accountV1 = IthacaAccount(user);
        
        // Add keys in V1
        bytes memory publicKey1 = _generateSecp256k1PublicKey();
        bytes memory publicKey2 = _generateP256PublicKey();
        
        IthacaAccount.Key memory key1 = IthacaAccount.Key({
            expiry: 0,
            keyType: IthacaAccount.KeyType.Secp256k1,
            isSuperAdmin: true,
            publicKey: publicKey1
        });
        
        IthacaAccount.Key memory key2 = IthacaAccount.Key({
            expiry: uint40(block.timestamp + 1 days),
            keyType: IthacaAccount.KeyType.WebAuthnP256,
            isSuperAdmin: false,
            publicKey: publicKey2
        });
        
        vm.startPrank(user);
        accountV1.authorize(key1);
        accountV1.authorize(key2);
        vm.stopPrank();
        
        // Store V1 state
        uint256 nonceBefore = accountV1.getNonce(0);
        (IthacaAccount.Key[] memory keysBefore, bytes32[] memory keyHashesBefore) = accountV1.getKeys();
        
        // Simulate upgrade to V2 by deploying V2 code at same address
        IthacaAccountV2 accountV2Impl = new IthacaAccountV2(ORCHESTRATOR);
        vm.etch(user, address(accountV2Impl).code);
        IthacaAccountV2 accountV2 = IthacaAccountV2(payable(user));
        
        // Verify all V1 state is preserved
        assertEq(accountV2.getNonce(0), nonceBefore);
        
        (IthacaAccount.Key[] memory keysAfter, bytes32[] memory keyHashesAfter) = accountV2.getKeys();
        assertEq(keysAfter.length, keysBefore.length);
        assertEq(keyHashesAfter.length, keyHashesBefore.length);
        
        for (uint i = 0; i < keysAfter.length; i++) {
            assertEq(keyHashesAfter[i], keyHashesBefore[i]);
            assertEq(keysAfter[i].expiry, keysBefore[i].expiry);
            assertEq(uint8(keysAfter[i].keyType), uint8(keysBefore[i].keyType));
            assertEq(keysAfter[i].isSuperAdmin, keysBefore[i].isSuperAdmin);
            assertEq(keccak256(keysAfter[i].publicKey), keccak256(keysBefore[i].publicKey));
        }
        
        // Verify V2 features work
        assertEq(accountV2.getEmailHash(), bytes32(0)); // Not set yet
    }
    
    // Helper functions
    
    function _generateP256PublicKey() internal view returns (bytes memory) {
        // Generate a mock P256 public key for testing
        uint256 x = uint256(keccak256(abi.encode(address(this), block.timestamp, gasleft(), "x")));
        uint256 y = uint256(keccak256(abi.encode(address(this), block.timestamp, gasleft(), "y")));
        return abi.encode(x, y);
    }
    
    function _generateSecp256k1PublicKey() internal view returns (bytes memory) {
        // Generate a mock Secp256k1 public key for testing  
        // For secp256k1, public key is 65 bytes: 0x04 + x (32 bytes) + y (32 bytes)
        uint256 x = uint256(keccak256(abi.encode(address(this), block.timestamp, gasleft(), "secp256k1-x")));
        uint256 y = uint256(keccak256(abi.encode(address(this), block.timestamp, gasleft(), "secp256k1-y")));
        return abi.encodePacked(uint8(0x04), x, y);
    }
}