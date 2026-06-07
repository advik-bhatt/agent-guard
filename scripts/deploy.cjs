/* eslint-disable */
// Deploys the AgentWork stack to Mantle Sepolia.
//
//   - If ERC8004_IDENTITY_ADDRESS / ERC8004_REPUTATION_ADDRESS are set in .env,
//     TaskEscrow is wired to those (e.g. Mantle's canonical ERC-8004 registries).
//   - Otherwise we deploy our own ERC-8004-compatible registries first.
//
// Writes addresses to .deployed.json and prints the lines to copy into .env.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const threshold = Number(process.env.VERIFIER_THRESHOLD || 65);

  console.log(`\nDeploying AgentWork → chainId ${net.chainId}`);
  console.log(`Deployer: ${deployer.address}\n`);

  let identityAddr = process.env.ERC8004_IDENTITY_ADDRESS;
  let reputationAddr = process.env.ERC8004_REPUTATION_ADDRESS;

  if (identityAddr && reputationAddr) {
    console.log("Using canonical ERC-8004 registries from .env:");
    console.log(`  Identity:   ${identityAddr}`);
    console.log(`  Reputation: ${reputationAddr}`);
  } else {
    console.log("Deploying ERC-8004-compatible registries…");
    const Identity = await ethers.getContractFactory("AgentIdentityRegistry");
    const identity = await Identity.deploy();
    await identity.waitForDeployment();
    identityAddr = await identity.getAddress();
    console.log(`  AgentIdentityRegistry   → ${identityAddr}`);

    const Reputation = await ethers.getContractFactory("AgentReputationRegistry");
    const reputation = await Reputation.deploy();
    await reputation.waitForDeployment();
    reputationAddr = await reputation.getAddress();
    console.log(`  AgentReputationRegistry → ${reputationAddr}`);
  }

  console.log("\nDeploying TaskEscrow…");
  const Escrow = await ethers.getContractFactory("TaskEscrow");
  const escrow = await Escrow.deploy(identityAddr, reputationAddr, threshold);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`  TaskEscrow              → ${escrowAddr}`);

  const out = {
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    identityRegistry: identityAddr,
    reputationRegistry: reputationAddr,
    taskEscrow: escrowAddr,
    scoreThreshold: threshold,
  };
  fs.writeFileSync(path.join(__dirname, "..", ".deployed.json"), JSON.stringify(out, null, 2));

  console.log("\nSaved .deployed.json. Add these to .env:");
  console.log(`CONTRACT_ADDRESS=${escrowAddr}`);
  console.log(`IDENTITY_REGISTRY_ADDRESS=${identityAddr}`);
  console.log(`REPUTATION_REGISTRY_ADDRESS=${reputationAddr}`);
  console.log("\nNext: npm run register\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
