// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EmailModule} from "../../src/EmailModule.sol";

contract MockVerifier {
    bool public alwaysValid = true;
    
    function setAlwaysValid(bool _valid) external {
        alwaysValid = _valid;
    }
    
    // Match the exact signature expected by EmailModule
    function verifyEmailProof(
        EmailModule.EmailProof memory
    ) external view returns (bool) {
        return alwaysValid;
    }
}