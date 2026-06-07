// Human-readable ABIs (ethers v6) for the on-chain calls AgentWork makes.
export const ESCROW_ABI = [
  "function postTask(string description) payable returns (uint256)",
  "function claimTask(uint256 id, uint256 agentId)",
  "function submitWork(uint256 id, string result)",
  "function verifyAndPay(uint256 id, bool approved, uint8 score)",
  "function taskCount() view returns (uint256)",
  "function scoreThreshold() view returns (uint8)",
  "event TaskPosted(uint256 indexed id, address indexed poster, uint256 bounty, string description)",
  "event Paid(uint256 indexed id, address indexed worker, uint256 amount)",
];

export const REPUTATION_ABI = [
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryDecimals)",
  "function feedbackCount(uint256 agentId) view returns (uint256)",
];

export const IDENTITY_ABI = [
  "function ownerOf(uint256 agentId) view returns (address)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
];
