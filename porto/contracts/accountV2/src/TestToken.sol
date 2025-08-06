// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "solady/tokens/ERC20.sol";

/// @title TestToken
/// @notice Simple ERC20 token for testing Porto functionality
contract TestToken is ERC20 {
    constructor() {
        // Nothing to initialize
    }

    function name() public pure override returns (string memory) {
        return "Porto Test Token";
    }

    function symbol() public pure override returns (string memory) {
        return "PTT";
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /// @notice Mint tokens to any address (for testing only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burn tokens from any address (for testing only)
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}