require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Mantle Sepolia testnet — chain 5003.
// Native gas token is MNT. Verified facts:
//   RPC:      https://rpc.sepolia.mantle.xyz
//   Explorer: https://explorer.sepolia.mantle.xyz
//   Faucet:   https://faucet.sepolia.mantle.xyz
const accounts = [
  process.env.POSTER_PRIVATE_KEY,
  process.env.WORKER_PRIVATE_KEY,
  process.env.VERIFIER_PRIVATE_KEY,
].filter(Boolean);

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    mantleSepolia: {
      url: process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts,
    },
  },
};
