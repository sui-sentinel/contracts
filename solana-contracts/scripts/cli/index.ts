#!/usr/bin/env bun

import type { Config, NetworkType, Operation } from "./types";
import { loadConfig } from "./config";
import { selectOption, closeReadline } from "./utils";
import {
  // Deploy operations
  syncProgramIds,
  buildProgram,
  deployProgram,
  showProgramStatus,
  // Admin operations
  initialize,
  setEnclavePubkey,
  updateEnclavePubkey,
  updateFeeRatios,
  updateProtocolWallet,
  transferAdmin,
  updateDynamicFeeSettings,
  pauseProtocol,
  unpauseProtocol,
  // View operations
  viewProtocolConfig,
  // Agent operations
  registerAgent,
  listAllAgents,
  requestAttack,
} from "./operations";

const OPERATIONS: Operation[] = [
  { name: "--- Deploy & Build ---", fn: null, requiresProgramId: false },
  { name: "Deploy/Upgrade Program", fn: null, requiresProgramId: false, special: "deploy" },
  { name: "Build Program", fn: null, requiresProgramId: false, special: "build" },
  { name: "Sync Program IDs", fn: null, requiresProgramId: false, special: "sync" },
  { name: "Show Program Status", fn: null, requiresProgramId: false, special: "status" },
  { name: "--- Admin Operations ---", fn: null, requiresProgramId: false },
  { name: "Initialize Protocol", fn: initialize, requiresProgramId: true },
  { name: "Set Enclave Public Key", fn: setEnclavePubkey, requiresProgramId: true },
  { name: "Update Enclave Public Key", fn: updateEnclavePubkey, requiresProgramId: true },
  { name: "Update Fee Ratios", fn: updateFeeRatios, requiresProgramId: true },
  { name: "Update Protocol Wallet", fn: updateProtocolWallet, requiresProgramId: true },
  { name: "Transfer Admin", fn: transferAdmin, requiresProgramId: true },
  { name: "Update Dynamic Fee Settings", fn: updateDynamicFeeSettings, requiresProgramId: true },
  { name: "Pause Protocol", fn: pauseProtocol, requiresProgramId: true },
  { name: "Unpause Protocol", fn: unpauseProtocol, requiresProgramId: true },
  { name: "View Protocol Config", fn: viewProtocolConfig, requiresProgramId: true },
  { name: "--- Agent Operations ---", fn: null, requiresProgramId: false },
  { name: "Register Agent", fn: registerAgent, requiresProgramId: true },
  { name: "List All Agents", fn: listAllAgents, requiresProgramId: true },
  { name: "Request Attack", fn: requestAttack, requiresProgramId: true },
  { name: "Exit", fn: null, requiresProgramId: false },
];

async function main(): Promise<void> {
  console.log("\n========================================");
  console.log("  Sui Sentinel Solana CLI");
  console.log("========================================");

  // Select network
  const networkIndex = await selectOption("Select Network:", ["devnet", "testnet", "mainnet"]);
  const network = ["devnet", "testnet", "mainnet"][networkIndex] as NetworkType;

  console.log(`\nSelected network: ${network}`);
  console.log(`Admin: ${process.env.ADMIN_ADDRESS || "Not set"}`);

  while (true) {
    const opIndex = await selectOption(
      "Select Operation:",
      OPERATIONS.map((op) => op.name)
    );

    const operation = OPERATIONS[opIndex];

    // Skip separator lines
    if (operation.name.startsWith("---")) {
      continue;
    }

    if (operation.name === "Exit") {
      console.log("\nGoodbye!");
      break;
    }

    // Handle special operations (deploy, build, sync, status)
    if (operation.special) {
      try {
        switch (operation.special) {
          case "deploy":
            await deployProgram(network);
            break;
          case "build":
            await buildProgram(false);
            break;
          case "sync":
            await syncProgramIds();
            break;
          case "status":
            await showProgramStatus(network);
            break;
        }
      } catch (e: any) {
        console.error("Error:", e.message);
      }
      continue;
    }

    if (operation.requiresProgramId) {
      try {
        const config = loadConfig(network);
        console.log(`\nProgram ID: ${config.programId}`);

        if (operation.fn) {
          await operation.fn(config);
        }
      } catch (e: any) {
        console.error("Error:", e.message);
      }
    }
  }

  closeReadline();
}

main().catch((error) => {
  console.error("Error:", error);
  closeReadline();
  process.exit(1);
});
