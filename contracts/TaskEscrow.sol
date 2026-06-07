// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry, IReputationRegistry} from "./interfaces/IERC8004.sol";

/// @title TaskEscrow
/// @notice Trustless payroll for AI agents. A poster escrows MNT against a task;
///         only an agent with a valid ERC-8004 identity can claim it; payment is
///         released only when a second agent's verdict clears the quality bar;
///         and every verdict is written to the ERC-8004 Reputation Registry so
///         the worker accrues a permanent, portable reputation. No human in the
///         settlement loop.
contract TaskEscrow {
    enum Status {
        None,
        Open,
        Claimed,
        Submitted,
        Completed,
        Failed
    }

    struct Task {
        uint256 id;
        address poster;
        address worker;
        uint256 workerAgentId; // ERC-8004 agentId of the claiming worker
        uint256 bounty; // MNT held in escrow
        Status status;
        uint8 score; // verifier score 0..100
        string description;
        string result;
    }

    IIdentityRegistry public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;

    /// @notice Score (0..100) at or above which the bounty is released.
    uint8 public immutable scoreThreshold;

    uint256 public taskCount;
    mapping(uint256 => Task) public tasks;

    uint256 private _locked = 1;

    event TaskPosted(uint256 indexed id, address indexed poster, uint256 bounty, string description);
    event TaskClaimed(uint256 indexed id, address indexed worker, uint256 indexed agentId);
    event WorkSubmitted(uint256 indexed id, string result);
    event Verdict(uint256 indexed id, bool approved, uint8 score);
    event Paid(uint256 indexed id, address indexed worker, uint256 amount);
    event ReputationWritten(uint256 indexed id, uint256 indexed agentId, uint8 score);
    event ReputationWriteFailed(uint256 indexed id, uint256 indexed agentId);

    error BadState();
    error NotWorker();
    error InvalidIdentity();
    error ZeroBounty();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _identityRegistry, address _reputationRegistry, uint8 _scoreThreshold) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        scoreThreshold = _scoreThreshold;
    }

    /// @notice Post a task, escrowing the attached MNT as the bounty.
    function postTask(string calldata description) external payable returns (uint256 id) {
        if (msg.value == 0) revert ZeroBounty();
        id = ++taskCount;
        Task storage t = tasks[id];
        t.id = id;
        t.poster = msg.sender;
        t.bounty = msg.value;
        t.status = Status.Open;
        t.description = description;
        emit TaskPosted(id, msg.sender, msg.value, description);
    }

    /// @notice Claim an open task. Reverts unless the caller controls a valid
    ///         ERC-8004 agent identity — this is the on-chain "is this a real,
    ///         registered agent?" gate.
    function claimTask(uint256 id, uint256 agentId) external {
        Task storage t = tasks[id];
        if (t.status != Status.Open) revert BadState();

        // Identity check against the ERC-8004 registry.
        address owner = identityRegistry.ownerOf(agentId);
        address wallet = identityRegistry.getAgentWallet(agentId);
        if (msg.sender != owner && msg.sender != wallet) revert InvalidIdentity();

        t.worker = msg.sender;
        t.workerAgentId = agentId;
        t.status = Status.Claimed;
        emit TaskClaimed(id, msg.sender, agentId);
    }

    /// @notice Worker submits the completed work on-chain.
    function submitWork(uint256 id, string calldata result) external {
        Task storage t = tasks[id];
        if (t.status != Status.Claimed) revert BadState();
        if (msg.sender != t.worker) revert NotWorker();
        t.result = result;
        t.status = Status.Submitted;
        emit WorkSubmitted(id, result);
    }

    /// @notice Record the verifier's verdict. Releases the bounty iff approved
    ///         (score >= threshold), and writes the score to the ERC-8004
    ///         Reputation Registry either way so reputation reflects real
    ///         performance. Reputation write is best-effort and never blocks pay.
    function verifyAndPay(uint256 id, bool approved, uint8 score) external nonReentrant {
        Task storage t = tasks[id];
        if (t.status != Status.Submitted) revert BadState();

        t.score = score;
        bool pass = approved && score >= scoreThreshold;
        emit Verdict(id, pass, score);

        if (pass) {
            uint256 amount = t.bounty;
            t.bounty = 0;
            t.status = Status.Completed;
            (bool ok, ) = payable(t.worker).call{value: amount}("");
            require(ok, "PAY_FAIL");
            emit Paid(id, t.worker, amount);
        } else {
            t.status = Status.Failed;
        }

        _writeReputation(id, t.workerAgentId, score);
    }

    /// @notice Poster can reclaim the bounty of a failed task.
    function refund(uint256 id) external nonReentrant {
        Task storage t = tasks[id];
        if (t.status != Status.Failed) revert BadState();
        if (msg.sender != t.poster) revert NotWorker();
        uint256 amount = t.bounty;
        t.bounty = 0;
        (bool ok, ) = payable(t.poster).call{value: amount}("");
        require(ok, "REFUND_FAIL");
    }

    function getTask(uint256 id) external view returns (Task memory) {
        return tasks[id];
    }

    function _writeReputation(uint256 id, uint256 agentId, uint8 score) private {
        try
            reputationRegistry.giveFeedback(
                agentId,
                int128(uint128(score)),
                0,
                "quality",
                "agentwork",
                "",
                "",
                bytes32(0)
            )
        {
            emit ReputationWritten(id, agentId, score);
        } catch {
            emit ReputationWriteFailed(id, agentId);
        }
    }
}
