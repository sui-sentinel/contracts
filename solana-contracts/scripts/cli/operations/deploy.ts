import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import type { NetworkType } from "../types";
import { NETWORK_URLS, getProgramIdEnvKey } from "../config";
import { question, runCommand } from "../utils";

const ROOT_DIR = join(import.meta.dir, "..", "..", "..");
const LIB_RS_PATH = join(ROOT_DIR, "programs", "sui-sentinel", "src", "lib.rs");
const PROGRAM_KEYPAIR_PATH = join(ROOT_DIR, "target", "deploy", "sui_sentinel-keypair.json");
const PROGRAM_SO_PATH = join(ROOT_DIR, "target", "deploy", "sui_sentinel.so");

export function getProgramIdFromKeypair(): string | null {
  if (!existsSync(PROGRAM_KEYPAIR_PATH)) {
    return null;
  }
  const keypairData = JSON.parse(readFileSync(PROGRAM_KEYPAIR_PATH, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  return keypair.publicKey.toBase58();
}

export function getDeclaredProgramId(): string | null {
  if (!existsSync(LIB_RS_PATH)) {
    return null;
  }
  const content = readFileSync(LIB_RS_PATH, "utf-8");
  const match = content.match(/declare_id!\("([^"]+)"\)/);
  return match ? match[1] : null;
}

export function updateDeclaredProgramId(newProgramId: string): boolean {
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

export async function syncProgramIds(): Promise<{ programId: string; synced: boolean } | null> {
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

export async function buildProgram(forceRebuild: boolean = false): Promise<boolean> {
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

export async function deployProgram(network: NetworkType): Promise<void> {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: ADMIN_PRIVATE_KEY not set in .env.local");
    return;
  }

  const keypairPath = join(ROOT_DIR, ".keypair.json");

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

export async function showProgramStatus(network: NetworkType): Promise<void> {
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
