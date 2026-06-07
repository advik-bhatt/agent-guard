// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReputationRegistry} from "./interfaces/IERC8004.sol";

/// @title AgentReputationRegistry
/// @notice ERC-8004-compatible Reputation Registry. Permissionless feedback:
///         any address (including the TaskEscrow contract) can attach a signed
///         score to an agent. Scores persist forever and aggregate into a
///         running reputation — the agent's portable, on-chain credit history.
/// @dev Set ERC8004_REPUTATION_ADDRESS in .env to use Mantle's canonical
///      registry instead — the IReputationRegistry ABI is identical.
contract AgentReputationRegistry is IReputationRegistry {
    struct Feedback {
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        uint64 timestamp;
    }

    mapping(uint256 => Feedback[]) private _feedback;

    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2
    );

    /// @inheritdoc IReputationRegistry
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata, /* endpoint */
        string calldata, /* feedbackURI */
        bytes32 /* feedbackHash */
    ) external {
        _feedback[agentId].push(
            Feedback({
                client: msg.sender,
                value: value,
                valueDecimals: valueDecimals,
                tag1: tag1,
                tag2: tag2,
                timestamp: uint64(block.timestamp)
            })
        );
        emit FeedbackGiven(agentId, msg.sender, value, valueDecimals, tag1, tag2);
    }

    /// @inheritdoc IReputationRegistry
    /// @dev Empty `clientAddresses` summarizes feedback from everyone. We treat
    ///      tag1/tag2 as optional filters (empty string = match anything).
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryDecimals) {
        Feedback[] storage list = _feedback[agentId];
        int256 sum;
        uint256 n;
        bytes32 t1 = keccak256(bytes(tag1));
        bytes32 t2 = keccak256(bytes(tag2));
        bytes32 empty = keccak256(bytes(""));

        for (uint256 i; i < list.length; i++) {
            Feedback storage f = list[i];
            if (clientAddresses.length > 0 && !_contains(clientAddresses, f.client)) continue;
            if (t1 != empty && keccak256(bytes(f.tag1)) != t1) continue;
            if (t2 != empty && keccak256(bytes(f.tag2)) != t2) continue;
            sum += int256(f.value);
            n++;
        }

        if (n == 0) return (0, 0, 0);
        count = uint64(n);
        summaryValue = int128(sum / int256(n));
        summaryDecimals = 0;
    }

    /// @notice Total feedback entries recorded for an agent (unfiltered).
    function feedbackCount(uint256 agentId) external view returns (uint256) {
        return _feedback[agentId].length;
    }

    function _contains(address[] calldata haystack, address needle) private pure returns (bool) {
        for (uint256 i; i < haystack.length; i++) {
            if (haystack[i] == needle) return true;
        }
        return false;
    }
}
