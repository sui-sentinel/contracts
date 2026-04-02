#!/usr/bin/env bun

import { spawn } from "bun";
import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

// TEE Response types
interface RegisterAgentResponse {
  response: {
    intent: number;
    timestamp: number; // Unix timestamp in seconds
    data: {
      agent_id: string;
      cost_per_message: number;
      prompt_hash: number[]; // SHA-256 hash of the system prompt (32 bytes)
      is_defeated: boolean;
      creator: number[];
    };
  };
  signature: string;
}

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

  // Create a copy of the IDL with the correct program address from config
  const idlWithAddress = {
    ...IDL,
    address: config.programId,
  };

  return new Program(idlWithAddress as any, provider);
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
// Deploy Operations
// ============================================================================

const LIB_RS_PATH = join(import.meta.dir, "..", "programs", "sui-sentinel", "src", "lib.rs");
const PROGRAM_KEYPAIR_PATH = join(import.meta.dir, "..", "target", "deploy", "sui_sentinel-keypair.json");
const PROGRAM_SO_PATH = join(import.meta.dir, "..", "target", "deploy", "sui_sentinel.so");

function getProgramIdFromKeypair(): string | null {
  if (!existsSync(PROGRAM_KEYPAIR_PATH)) {
    return null;
  }
  const keypairData = JSON.parse(readFileSync(PROGRAM_KEYPAIR_PATH, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  return keypair.publicKey.toBase58();
}

function getDeclaredProgramId(): string | null {
  if (!existsSync(LIB_RS_PATH)) {
    return null;
  }
  const content = readFileSync(LIB_RS_PATH, "utf-8");
  const match = content.match(/declare_id!\("([^"]+)"\)/);
  return match ? match[1] : null;
}

function updateDeclaredProgramId(newProgramId: string): boolean {
  if (!existsSync(LIB_RS_PATH)) {
    return false;
  }
  const content = readFileSync(LIB_RS_PATH, "utf-8");
  const updated = content.replace(
    /declare_id!\("[^"]+"\)/,
    `declare_id!("${newProgramId}")`
  );
  writeFileSync(LIB_RS_PATH, updated);
  return true;
}

async function syncProgramIds(): Promise<{ programId: string; synced: boolean } | null> {
  console.log("\n========================================");
  console.log("Syncing Program IDs");
  console.log("========================================");

  const keypairProgramId = getProgramIdFromKeypair();
  const declaredProgramId = getDeclaredProgramId();

  console.log(`Program Keypair ID: ${keypairProgramId || "Not found"}`);
  console.log(`Declared ID (lib.rs): ${declaredProgramId || "Not found"}`);

  if (!keypairProgramId) {
    console.log("\nNo program keypair found. Generating new one...");
    const result = await runCommand("anchor", ["keys", "list"]);
    if (!result.success) {
      console.error("Failed to generate program keypair");
      return null;
    }
    const newKeypairId = getProgramIdFromKeypair();
    if (!newKeypairId) {
      console.error("Failed to read generated keypair");
      return null;
    }
    console.log(`Generated new Program ID: ${newKeypairId}`);

    if (declaredProgramId !== newKeypairId) {
      console.log(`Updating declare_id! to: ${newKeypairId}`);
      updateDeclaredProgramId(newKeypairId);
      return { programId: newKeypairId, synced: true };
    }
    return { programId: newKeypairId, synced: false };
  }

  if (declaredProgramId !== keypairProgramId) {
    console.log(`\nMismatch detected! Updating declare_id! to match keypair...`);
    updateDeclaredProgramId(keypairProgramId);
    console.log(`Updated declare_id! to: ${keypairProgramId}`);
    return { programId: keypairProgramId, synced: true };
  }

  console.log("\nProgram IDs are in sync!");
  return { programId: keypairProgramId, synced: false };
}

async function buildProgram(forceRebuild: boolean = false): Promise<boolean> {
  console.log("\n========================================");
  console.log("Building Program");
  console.log("========================================");

  if (!forceRebuild && existsSync(PROGRAM_SO_PATH)) {
    const rebuild = await question("Program already built. Rebuild? (yes/no): ");
    if (rebuild.toLowerCase() !== "yes") {
      console.log("Skipping build.");
      return true;
    }
  }

  console.log("\nRunning anchor build...");
  const result = await runCommand("anchor", ["build"]);

  if (result.success) {
    console.log("Build successful!");
    return true;
  } else {
    console.error("Build failed!");
    return false;
  }
}

async function deployProgram(network: NetworkType): Promise<void> {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: ADMIN_PRIVATE_KEY not set in .env.local");
    return;
  }

  const keypairPath = join(import.meta.dir, "..", ".keypair.json");

  try {
    // Create temp keypair file for payer
    const keypairBytes = bs58.decode(privateKey);
    writeFileSync(keypairPath, JSON.stringify(Array.from(keypairBytes)));

    // Step 1: Sync program IDs
    const syncResult = await syncProgramIds();
    if (!syncResult) {
      console.error("Failed to sync program IDs");
      return;
    }

    // Step 2: Build (force rebuild if IDs were synced)
    const buildSuccess = await buildProgram(syncResult.synced);
    if (!buildSuccess) {
      return;
    }

    // Step 3: Check balance
    const rpcUrl = NETWORK_URLS[network];
    console.log("\n========================================");
    console.log(`Deploying to ${network}`);
    console.log("========================================");
    console.log(`RPC URL: ${rpcUrl}`);
    console.log(`Program ID: ${syncResult.programId}`);

    console.log("\nChecking wallet balance...");
    await runCommand("solana", ["balance", "--url", rpcUrl, "--keypair", keypairPath]);

    // Step 4: Check if program already exists (for upgrade)
    console.log("\nChecking if program exists on-chain...");
    const showResult = await runCommand("solana", [
      "program", "show", syncResult.programId, "--url", rpcUrl
    ]);

    const isUpgrade = showResult.success && showResult.output.includes("Program Id:");

    if (isUpgrade) {
      console.log("\nProgram exists. This will be an UPGRADE.");
      const confirm = await question("Proceed with upgrade? (yes/no): ");
      if (confirm.toLowerCase() !== "yes") {
        console.log("Cancelled.");
        return;
      }
    } else {
      console.log("\nProgram does not exist. This will be an initial DEPLOY.");
      const confirm = await question("Proceed with deployment? (yes/no): ");
      if (confirm.toLowerCase() !== "yes") {
        console.log("Cancelled.");
        return;
      }
    }

    // Step 5: Deploy/Upgrade
    console.log(`\n${isUpgrade ? "Upgrading" : "Deploying"} program...`);
    const deployResult = await runCommand("solana", [
      "program", "deploy", PROGRAM_SO_PATH,
      "--url", rpcUrl,
      "--keypair", keypairPath,
      "--program-id", PROGRAM_KEYPAIR_PATH,
    ]);

    if (deployResult.success) {
      console.log("\n========================================");
      console.log("Deployment Successful!");
      console.log("========================================");
      console.log(`Program ID: ${syncResult.programId}`);
      console.log(`Network: ${network}`);

      // Check if env var needs updating
      const envKey = getProgramIdEnvKey(network);
      const currentEnvId = process.env[envKey];
      if (currentEnvId !== syncResult.programId) {
        console.log(`\nUpdate your .env.local:`);
        console.log(`${envKey}=${syncResult.programId}`);
      } else {
        console.log(`\n.env.local already has correct ${envKey}`);
      }
    } else {
      console.error("\nDeployment failed!");
    }
  } finally {
    if (existsSync(keypairPath)) {
      unlinkSync(keypairPath);
    }
  }
}

async function showProgramStatus(network: NetworkType): Promise<void> {
  console.log("\n========================================");
  console.log("Program Status");
  console.log("========================================");

  const keypairProgramId = getProgramIdFromKeypair();
  const declaredProgramId = getDeclaredProgramId();
  const envKey = getProgramIdEnvKey(network);
  const envProgramId = process.env[envKey];

  console.log(`\nProgram Keypair ID: ${keypairProgramId || "Not found"}`);
  console.log(`Declared ID (lib.rs): ${declaredProgramId || "Not found"}`);
  console.log(`Env ID (${envKey}): ${envProgramId || "Not set"}`);

  // Check sync status
  const allMatch = keypairProgramId &&
                   keypairProgramId === declaredProgramId &&
                   keypairProgramId === envProgramId;

  if (allMatch) {
    console.log("\nStatus: All program IDs are in sync!");
  } else {
    console.log("\nStatus: Program IDs are OUT OF SYNC!");
    if (keypairProgramId !== declaredProgramId) {
      console.log("  - Keypair and declare_id! mismatch");
    }
    if (keypairProgramId !== envProgramId) {
      console.log("  - Keypair and .env.local mismatch");
    }
  }

  // Check on-chain status
  if (envProgramId) {
    const rpcUrl = NETWORK_URLS[network];
    console.log(`\nChecking on-chain status for ${network}...`);
    await runCommand("solana", ["program", "show", envProgramId, "--url", rpcUrl]);
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
// Agent Operations
// ============================================================================

async function registerAgent(config: Config): Promise<void> {
  const program = getProgram(config);

  // Ask for JSON filename
  const filename = await question("JSON filename (in data folder): ");
  const filePath = join(import.meta.dir, "data", filename);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    return;
  }

  // Read and parse the JSON file
  let teeResponse: RegisterAgentResponse;
  try {
    const fileContent = readFileSync(filePath, "utf-8");
    teeResponse = JSON.parse(fileContent);
  } catch (e: any) {
    console.error("Error parsing JSON:", e.message);
    return;
  }

  // Validate response structure
  if (!teeResponse.response || !teeResponse.signature) {
    console.error("Error: Invalid response structure. Expected 'response' and 'signature' fields.");
    return;
  }

  const { response, signature } = teeResponse;
  const { data } = response;

  // Use prompt_hash directly from the response
  const promptHash = data.prompt_hash;
  if (promptHash.length !== 32) {
    console.error(`Error: prompt_hash must be 32 bytes, got ${promptHash.length}`);
    return;
  }

  // Display parsed data
  console.log("\n========================================");
  console.log("TEE Response Data");
  console.log("========================================");
  console.log(`Intent: ${response.intent}`);
  console.log(`Timestamp: ${response.timestamp}`);
  console.log(`Agent ID: ${data.agent_id}`);
  console.log(`Cost per Message: ${data.cost_per_message}`);
  console.log(`Prompt Hash: ${Buffer.from(promptHash).toString("hex")}`);
  console.log(`Creator: ${bs58.encode(Uint8Array.from(data.creator))}`);
  console.log(`Signature: ${signature.substring(0, 32)}...`);

  // Ask for token mint
  const tokenMintInput = await question("\nToken Mint Address: ");
  const tokenMint = new PublicKey(tokenMintInput);

  // Timestamp is already in seconds
  const timestampSeconds = response.timestamp;

  // Convert signature from hex to Buffer
  const signatureBuffer = Buffer.from(signature, "hex");
  if (signatureBuffer.length !== 64) {
    console.error(`Error: Signature must be 64 bytes, got ${signatureBuffer.length}`);
    return;
  }

  // Derive PDAs
  const programId = new PublicKey(config.programId);

  const [protocolConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );

  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(data.agent_id)],
    programId
  );

  const [agentVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_vault"), agentPda.toBuffer()],
    programId
  );

  const [agentFeesVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_fees"), agentPda.toBuffer()],
    programId
  );

  console.log("\nDerived Accounts:");
  console.log(`Protocol Config: ${protocolConfigPda.toBase58()}`);
  console.log(`Agent PDA: ${agentPda.toBase58()}`);
  console.log(`Agent Vault: ${agentVaultPda.toBase58()}`);
  console.log(`Agent Fees Vault: ${agentFeesVaultPda.toBase58()}`);

  const confirm = await question("\nProceed with registration? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nRegistering agent...");

  try {
    // Fetch enclave pubkey from protocol config
    const protocolConfig = await (program.account as any).protocolConfig.fetch(protocolConfigPda);
    if (!protocolConfig.enclavePubkey) {
      console.error("Error: Enclave public key not set in protocol config");
      return;
    }
    const enclavePubkey = Uint8Array.from(protocolConfig.enclavePubkey);

    // Convert promptHash to Buffer for Anchor
    const promptHashBuffer = Buffer.from(promptHash);

    // Build the message that was signed (same as contract)
    // Message format: intent || timestamp || agent_id || cost_per_message || prompt_hash || creator
    const message = Buffer.concat([
      Buffer.from([response.intent]), // intent (1 byte)
      Buffer.from(new BigInt64Array([BigInt(timestampSeconds)]).buffer), // timestamp (8 bytes LE)
      Buffer.from(data.agent_id), // agent_id
      Buffer.from(new BigUint64Array([BigInt(data.cost_per_message)]).buffer), // cost_per_message (8 bytes LE)
      promptHashBuffer, // prompt_hash (32 bytes)
      Buffer.from(data.creator), // creator (32 bytes)
    ]);

    // Create Ed25519 instruction for signature verification
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: enclavePubkey,
      message: message,
      signature: signatureBuffer,
    });

    // Call register_agent with preInstructions
    // Note: prompt_hash is [u8; 32] (fixed array) -> pass as number[]
    //       signature is Vec<u8> (bytes) -> pass as Buffer
    const tx = await program.methods
      .registerAgent(
        data.agent_id,
        new BN(data.cost_per_message),
        Array.from(promptHashBuffer),
        new BN(timestampSeconds),
        signatureBuffer
      )
      .accounts({
        protocolConfig: protocolConfigPda,
        agent: agentPda,
        tokenMint: tokenMint,
        agentVault: agentVaultPda,
        agentFeesVault: agentFeesVaultPda,
        creator: config.keypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .preInstructions([ed25519Instruction])
      .rpc();

    console.log(`Transaction: ${tx}`);
    console.log("Agent registered successfully!");
    console.log(`Agent PDA: ${agentPda.toBase58()}`);
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.logs) {
      console.error("\nTransaction logs:");
      e.logs.forEach((log: string) => console.error(log));
    }
  }
}

// ============================================================================
// Main Menu
// ============================================================================

const OPERATIONS = [
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

    const operation = OPERATIONS[opIndex] as { name: string; fn: any; requiresProgramId: boolean; special?: string };

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

  rl.close();
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});
