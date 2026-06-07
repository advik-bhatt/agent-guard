// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "./interfaces/IERC8004.sol";

/// @title AgentIdentityRegistry
/// @notice ERC-8004-compatible Identity Registry. Permissionless: any wallet can
///         mint exactly the agent identities it controls. Each identity is a
///         non-transferable ERC-721-style token (the agent "passport").
/// @dev Deployed by AgentWork for the demo so the flow is self-contained and
///      reliable. Set ERC8004_IDENTITY_ADDRESS in .env to use Mantle's canonical
///      registry instead — the IIdentityRegistry ABI is identical.
contract AgentIdentityRegistry is IIdentityRegistry {
    uint256 public agentCount;

    mapping(uint256 => address) private _owner;
    mapping(uint256 => address) private _wallet;
    mapping(uint256 => string) public agentURI;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentWalletUpdated(uint256 indexed agentId, address indexed wallet);

    error NotRegistered(uint256 agentId);
    error NotOwner();

    /// @inheritdoc IIdentityRegistry
    function register(string calldata uri) external returns (uint256 agentId) {
        agentId = ++agentCount;
        _owner[agentId] = msg.sender;
        _wallet[agentId] = msg.sender;
        agentURI[agentId] = uri;
        emit AgentRegistered(agentId, msg.sender, uri);
    }

    /// @inheritdoc IIdentityRegistry
    function ownerOf(uint256 agentId) public view returns (address owner) {
        owner = _owner[agentId];
        if (owner == address(0)) revert NotRegistered(agentId);
    }

    /// @inheritdoc IIdentityRegistry
    function getAgentWallet(uint256 agentId) external view returns (address) {
        if (_owner[agentId] == address(0)) revert NotRegistered(agentId);
        return _wallet[agentId];
    }

    /// @notice Bind a separate operating wallet to an agent you own.
    function setAgentWallet(uint256 agentId, address wallet) external {
        if (_owner[agentId] != msg.sender) revert NotOwner();
        _wallet[agentId] = wallet;
        emit AgentWalletUpdated(agentId, wallet);
    }
}
