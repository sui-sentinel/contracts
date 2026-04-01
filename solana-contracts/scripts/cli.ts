#!/usr/bin/env bun

import { spawn } from "bun";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// IDL import
import IDL from "../target/idl/sui_sentinel.json";

const NETWORK_URLS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

type NetworkType = "devnet" | "testnet" | "mainnet";

interface Config {
  network: NetworkType;
  programId: string;
  rpcUrl: string;
  keypair: Keypair;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function selectOption(prompt: string, options: string[]): Promise<number> {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));

  while (true) {
    const answer = await question(`\nSelect (1-${options.length}): `);
    const num = parseInt(answer);
    if (num >= 1 && num <= options.length) {
      return num - 1;
    }
    console.log("Invalid selection. Please try again.");
  }
}

function getProgramIdEnvKey(network: NetworkType): string {
  return `${network.toUpperCase()}_PROGRAM_ID`;
}

function loadConfig(network: NetworkType): Config {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: ADMIN_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  const programIdKey = getProgramIdEnvKey(network);
  const programId = process.env[programIdKey];
  if (!programId) {
    console.error(`Error: ${programIdKey} not set in .env.local`);
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));

  return {
    network,
    programId,
    rpcUrl: NETWORK_URLS[network],
    keypair,
  };
}

function getProgram(config: Config): Program {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const wallet = new Wallet(config.keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  return new Program(IDL as any, provider);
}

async function runCommand(
  command: string,
  args: string[]
): Promise<{ success: boolean; output: string }> {
  console.log(`\n> ${command} ${args.join(" ")}\n`);

  const proc = spawn({
    cmd: [command, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  return { success: exitCode === 0, output: stdout + stderr };
}

// ============================================================================
// Deploy Operation
// ============================================================================

async function deployProgram(network: NetworkType): Promise<void> {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: ADMIN_PRIVATE_KEY not set in .env.local");
    return;
  }

  const keypairPath = join(import.meta.dir, "..", ".keypair.json");
  const programPath = join(import.meta.dir, "..", "target", "deploy", "sui_sentinel.so");
  const programKeypairPath = join(import.meta.dir, "..", "target", "deploy", "sui_sentinel-keypair.json");

  try {
    // Create temp keypair file
    const keypairBytes = bs58.decode(privateKey);
    writeFileSync(keypairPath, JSON.stringify(Array.from(keypairBytes)));

    // Check if program is built
    if (!existsSync(programPath)) {
      console.log("\nProgram not built. Building now...");
      const buildResult = await runCommand("anchor", ["build"]);
      if (!buildResult.success) {
        console.error("Build failed!");
        return;
      }
    }

    // Check balance
    const rpcUrl = NETWORK_URLS[network];
    console.log(`\nDeploying to ${network}...`);
    console.log(`RPC URL: ${rpcUrl}`);

    await runCommand("solana", ["balance", "--url", rpcUrl, "--keypair", keypairPath]);

    // Deploy
    const deployResult = await runCommand("solana", [
      "program", "deploy", programPath,
      "--url", rpcUrl,
      "--keypair", keypairPath,
      "--program-id", programKeypairPath,
    ]);

    if (deployResult.success) {
      // Get program ID from keypair
      const programKeypairData = JSON.parse(readFileSync(programKeypairPath, "utf-8"));
      const programKeypair = Keypair.fromSecretKey(Uint8Array.from(programKeypairData));
      console.log(`\nDeployment successful!`);
      console.log(`Program ID: ${programKeypair.publicKey.toBase58()}`);
      console.log(`\nAdd this to your .env.local:`);
      console.log(`${getProgramIdEnvKey(network)}=${programKeypair.publicKey.toBase58()}`);
    }
  } finally {
    if (existsSync(keypairPath)) {
      unlinkSync(keypairPath);
    }
  }
}

// ============================================================================
// Admin Operations
// ============================================================================

async function initialize(config: Config): Promise<void> {
  const program = getProgram(config);

  const protocolWalletInput = await question("Protocol Wallet Address: ");
  const protocolWallet = new PublicKey(protocolWalletInput);

  console.log("\nInitializing protocol...");
  try {
    const tx = await program.methods
      .initialize(protocolWallet)
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Protocol initialized successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function setEnclavePubkey(config: Config): Promise<void> {
  const program = getProgram(config);

  const pubkeyHex = await question("Enclave Public Key (64 hex chars or base58): ");

  let pubkeyBytes: number[];
  if (pubkeyHex.length === 64) {
    // Hex format
    pubkeyBytes = Array.from(Buffer.from(pubkeyHex, "hex"));
  } else {
    // Try base58
    try {
      pubkeyBytes = Array.from(bs58.decode(pubkeyHex));
    } catch {
      console.error("Invalid public key format. Use 64 hex chars or base58.");
      return;
    }
  }

  if (pubkeyBytes.length !== 32) {
    console.error("Public key must be 32 bytes");
    return;
  }

  console.log("\nSetting enclave public key...");
  try {
    const tx = await program.methods
      .setEnclavePubkey(pubkeyBytes)
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Enclave public key set successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function updateEnclavePubkey(config: Config): Promise<void> {
  const program = getProgram(config);

  const pubkeyHex = await question("New Enclave Public Key (64 hex chars or base58): ");

  let pubkeyBytes: number[];
  if (pubkeyHex.length === 64) {
    pubkeyBytes = Array.from(Buffer.from(pubkeyHex, "hex"));
  } else {
    try {
      pubkeyBytes = Array.from(bs58.decode(pubkeyHex));
    } catch {
      console.error("Invalid public key format.");
      return;
    }
  }

  if (pubkeyBytes.length !== 32) {
    console.error("Public key must be 32 bytes");
    return;
  }

  console.log("\nUpdating enclave public key...");
  try {
    const tx = await program.methods
      .updateEnclavePubkey(pubkeyBytes)
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Enclave public key updated successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function updateFeeRatios(config: Config): Promise<void> {
  const program = getProgram(config);

  console.log("\nFee ratios are in basis points (100 = 1%, 10000 = 100%)");
  console.log("Total must equal 10000 (100%)");

  const agentBalanceFee = await question("Agent Balance Fee (default 5000 = 50%): ");
  const creatorFee = await question("Creator Fee (default 4000 = 40%): ");
  const protocolFee = await question("Protocol Fee (default 1000 = 10%): ");

  const agentBps = new BN(agentBalanceFee || "5000");
  const creatorBps = new BN(creatorFee || "4000");
  const protocolBps = new BN(protocolFee || "1000");

  console.log("\nUpdating fee ratios...");
  try {
    const tx = await program.methods
      .updateFeeRatios(agentBps, creatorBps, protocolBps)
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Fee ratios updated successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function updateProtocolWallet(config: Config): Promise<void> {
  const program = getProgram(config);

  const newWallet = await question("New Protocol Wallet Address: ");

  console.log("\nUpdating protocol wallet...");
  try {
    const tx = await program.methods
      .updateProtocolWallet(new PublicKey(newWallet))
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Protocol wallet updated successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function transferAdmin(config: Config): Promise<void> {
  const program = getProgram(config);

  const newAdmin = await question("New Admin Address: ");

  const confirm = await question(`Transfer admin to ${newAdmin}? (yes/no): `);
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nTransferring admin role...");
  try {
    const tx = await program.methods
      .transferAdmin(new PublicKey(newAdmin))
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Admin role transferred successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function updateDynamicFeeSettings(config: Config): Promise<void> {
  const program = getProgram(config);

  console.log("\nDynamic fee settings (in basis points)");

  const feeIncrease = await question("Fee Increase per Attack (default 100 = 1%): ");
  const maxMultiplier = await question("Max Fee Multiplier (default 30000 = 3x): ");

  const feeIncreaseBps = new BN(feeIncrease || "100");
  const maxMultiplierBps = new BN(maxMultiplier || "30000");

  console.log("\nUpdating dynamic fee settings...");
  try {
    const tx = await program.methods
      .updateDynamicFeeSettings(feeIncreaseBps, maxMultiplierBps)
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Dynamic fee settings updated successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function pauseProtocol(config: Config): Promise<void> {
  const program = getProgram(config);

  const confirm = await question("Pause the protocol? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nPausing protocol...");
  try {
    const tx = await program.methods
      .pauseProtocol()
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Protocol paused successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function unpauseProtocol(config: Config): Promise<void> {
  const program = getProgram(config);

  console.log("\nUnpausing protocol...");
  try {
    const tx = await program.methods
      .unpauseProtocol()
      .accounts({
        admin: config.keypair.publicKey,
      })
      .rpc();
    console.log(`Transaction: ${tx}`);
    console.log("Protocol unpaused successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

// ============================================================================
// View Operations
// ============================================================================

async function viewProtocolConfig(config: Config): Promise<void> {
  const program = getProgram(config);

  console.log("\nFetching protocol config...");
  try {
    const [protocolConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      new PublicKey(config.programId)
    );

    const protocolConfig = await program.account.protocolConfig.fetch(protocolConfigPda);

    console.log("\n========================================");
    console.log("Protocol Configuration");
    console.log("========================================");
    console.log(`Admin: ${protocolConfig.admin.toBase58()}`);
    console.log(`Protocol Wallet: ${protocolConfig.protocolWallet.toBase58()}`);
    console.log(`Agent Balance Fee: ${protocolConfig.agentBalanceFee.toString()} bps`);
    console.log(`Creator Fee: ${protocolConfig.creatorFee.toString()} bps`);
    console.log(`Protocol Fee: ${protocolConfig.protocolFee.toString()} bps`);
    console.log(`Fee Increase per Attack: ${protocolConfig.feeIncreaseBps.toString()} bps`);
    console.log(`Max Fee Multiplier: ${protocolConfig.maxFeeMultiplierBps.toString()} bps`);
    console.log(`Is Paused: ${protocolConfig.isPaused}`);
    console.log(`Total Agents: ${protocolConfig.totalAgents.toString()}`);

    if (protocolConfig.enclavePubkey) {
      const pubkeyHex = Buffer.from(protocolConfig.enclavePubkey).toString("hex");
      console.log(`Enclave Pubkey: ${pubkeyHex}`);
    } else {
      console.log(`Enclave Pubkey: Not set`);
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

// ============================================================================
// Main Menu
// ============================================================================

const OPERATIONS = [
  { name: "Deploy Program", fn: null, requiresProgramId: false },
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

    if (operation.name === "Exit") {
      console.log("\nGoodbye!");
      break;
    }

    if (operation.name === "Deploy Program") {
      await deployProgram(network);
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

  rl.close();
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});
