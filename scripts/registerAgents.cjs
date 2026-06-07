/* eslint-disable */
// Registers the worker and verifier wallets as ERC-8004 agent identities on the
// Identity Registry, then writes their agentIds to .agent-ids.json.
//
// Signer order matches hardhat.config.cjs accounts: [poster, worker, verifier].
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function loadDeployed() {
  const p = path.join(__dirname, "..", ".deployed.json");
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return {};
}

async function registerFor(identity, signer, label) {
  const uri = `ipfs://agentwork/${label}.json`;
  const tx = await identity.connect(signer).register(uri);
  const receipt = await tx.wait();

  // Pull agentId from the AgentRegistered event.
  let agentId;
  for (const log of receipt.logs) {
    try {
      const parsed = identity.interface.parseLog(log);
      if (parsed && parsed.name === "AgentRegistered") {
        agentId = parsed.args.agentId.toString();
        break;
      }
    } catch (_) {
      /* not our event */
    }
  }
  if (!agentId) agentId = (await identity.agentCount()).toString();
  console.log(`  ${label.padEnd(8)} ${signer.address} → agentId ${agentId} (tx ${tx.hash})`);
  return agentId;
}

async function main() {
  const { ethers } = hre;
  const deployed = loadDeployed();
  const identityAddr =
    process.env.IDENTITY_REGISTRY_ADDRESS ||
    process.env.ERC8004_IDENTITY_ADDRESS ||
    deployed.identityRegistry;

  if (!identityAddr) {
    throw new Error("No identity registry address. Run `npm run deploy` first.");
  }

  const signers = await ethers.getSigners();
  const [, worker, verifier] = signers;
  if (!worker || !verifier) {
    throw new Error("Need WORKER_PRIVATE_KEY and VERIFIER_PRIVATE_KEY in .env.");
  }

  const identity = await ethers.getContractAt("AgentIdentityRegistry", identityAddr);
  console.log(`\nRegistering agents on Identity Registry ${identityAddr}\n`);

  const workerAgentId = await registerFor(identity, worker, "worker");
  const verifierAgentId = await registerFor(identity, verifier, "verifier");

  fs.writeFileSync(
    path.join(__dirname, "..", ".agent-ids.json"),
    JSON.stringify({ workerAgentId, verifierAgentId, identityRegistry: identityAddr }, null, 2)
  );

  console.log("\nSaved .agent-ids.json. Add these to .env:");
  console.log(`WORKER_AGENT_ID=${workerAgentId}`);
  console.log(`VERIFIER_AGENT_ID=${verifierAgentId}`);
  console.log("\nNext: npm run dev\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
