// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-8004 "Trustless Agents" interfaces (subset used by AgentWork)
/// @notice ERC-8004 went live on Ethereum mainnet on 2026-01-29 and on Mantle
///         on 2026-02-16. These interfaces mirror the canonical registries so
///         the same ABI works whether AgentWork talks to its own deployed
///         registries (default) or the canonical Mantle registries (via env).
///
/// Canonical Mantle Sepolia (chain 5003):
///   Identity   0x8004A818BFB912233c491871b3d84c89A494BD9e
///   Reputation 0x8004B663056A597Dffe9eCcC1965A193B7388713

/// @notice Identity Registry. Each agent is an ERC-721 token (the "agent
///         passport"); tokenURI points at the agent card.
interface IIdentityRegistry {
    /// @notice Mint a new agent identity. Returns the agentId.
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice ERC-721 owner of the agent identity.
    function ownerOf(uint256 agentId) external view returns (address);

    /// @notice Operating wallet bound to the agent (defaults to the owner).
    function getAgentWallet(uint256 agentId) external view returns (address);
}

/// @notice Reputation Registry. Anyone can attach signed feedback to an agent;
///         scores persist on-chain forever.
interface IReputationRegistry {
    /// @notice Record feedback about an agent. `value`/`valueDecimals` encode a
    ///         signed decimal score (we use 0..100 with 0 decimals).
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Aggregate feedback for an agent. Pass an empty client list to
    ///         summarize feedback from everyone.
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryDecimals);
}
