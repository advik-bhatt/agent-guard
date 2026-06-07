/* eslint-disable */
// Offline Solidity compile check using the bundled solc (no binary download).
// Useful in restricted/CI environments where Hardhat can't fetch the compiler.
//   node scripts/compileCheck.cjs
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.join(__dirname, "..", "contracts");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const sources = {
  "TaskEscrow.sol": { content: read("TaskEscrow.sol") },
  "AgentIdentityRegistry.sol": { content: read("AgentIdentityRegistry.sol") },
  "AgentReputationRegistry.sol": { content: read("AgentReputationRegistry.sol") },
  "interfaces/IERC8004.sol": { content: read("interfaces/IERC8004.sol") },
};

function findImports(p) {
  const norm = p.replace(/^\.\//, "");
  for (const candidate of [path.join(root, norm), path.join(root, "interfaces", path.basename(p))]) {
    if (fs.existsSync(candidate)) return { contents: fs.readFileSync(candidate, "utf8") };
  }
  return { error: "File not found: " + p };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

console.log("solc", solc.version());
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === "error");

if (errors.length) {
  console.error("\nCOMPILE ERRORS:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  process.exit(1);
}

const names = [];
for (const file of Object.keys(out.contracts || {})) {
  for (const name of Object.keys(out.contracts[file])) names.push(name);
}
const warnings = (out.errors || []).filter((e) => e.severity === "warning");
console.log(`\nCompiled OK → ${names.join(", ")}`);
if (warnings.length) console.log(`(${warnings.length} warning(s))`);
