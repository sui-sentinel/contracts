#!/usr/bin/env bun

import { spawn } from "bun";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import bs58 from "bs58";

const NETWORK_URLS: Record<string, string> = {
  testnet: "https://api.testnet.solana.com",
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};


interface Args {
  network: "testnet" | "devnet" | "mainnet";
  build: boolean;
  deploy: boolean;
  help: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    network: "devnet",
    build: false,
    deploy: false,
    help: false,
  };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--network" || arg === "-n") {
      const value = argv[++i];
      if (!value || !["testnet", "devnet", "mainnet"].includes(value)) {
        console.error(
          "Error: --network must be one of: testnet, devnet, mainnet"
        );
        process.exit(1);
      }
      args.network = value as Args["network"];
    } else if (arg === "--build" || arg === "-b") {
      args.build = true;
    } else if (arg === "--deploy" || arg === "-d") {
      args.deploy = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
Sui Sentinel Solana CLI

Usage:
  bun run scripts/cli.ts [options]

Options:
  -n, --network <network>  Target network (testnet, devnet, mainnet) [default: devnet]
  -b, --build              Build the program before deploying
  -d, --deploy             Deploy the program to the specified network
  -h, --help               Show this help message

Examples:
  bun run scripts/cli.ts --network testnet --build --deploy
  bun run scripts/cli.ts -n mainnet -d
  bun run scripts/cli.ts --build

Environment Variables (from .env.local):
  ADMIN_ADDRESS            Phantom wallet address (for verification)
  ADMIN_PRIVATE_KEY        Phantom wallet private key (base58 encoded)
`);
}

async function runCommand(
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<{ success: boolean; output: string }> {
  console.log(`\n> ${command} ${args.join(" ")}\n`);

  const proc = spawn({
    cmd: [command, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  return {
    success: exitCode === 0,
    output: stdout + stderr,
  };
}

function loadEnv(): { address: string; privateKey: string } {
  const address = process.env.ADMIN_ADDRESS;
  const privateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!address || !privateKey) {
    console.error("Error: ADMIN_ADDRESS and ADMIN_PRIVATE_KEY must be set in .env.local");
    process.exit(1);
  }

  return { address, privateKey };
}

async function createKeypairFile(privateKeyBase58: string): Promise<string> {
  const keypairPath = join(import.meta.dir, "..", ".keypair.json");

  try {
    const privateKeyBytes = bs58.decode(privateKeyBase58);
    const keypairArray = Array.from(privateKeyBytes);
    writeFileSync(keypairPath, JSON.stringify(keypairArray));
    return keypairPath;
  } catch (error) {
    console.error("Error: Invalid private key format");
    process.exit(1);
  }
}

async function buildProgram(): Promise<boolean> {
  console.log("\n========================================");
  console.log("Building Sui Sentinel program...");
  console.log("========================================");

  const result = await runCommand("anchor", ["build"]);
  return result.success;
}

async function deployProgram(
  network: string,
  keypairPath: string
): Promise<boolean> {
  const rpcUrl = NETWORK_URLS[network];

  console.log("\n========================================");
  console.log(`Deploying to ${network}...`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log("========================================");

  // Check balance first
  console.log("\nChecking wallet balance...");
  const balanceResult = await runCommand("solana", [
    "balance",
    "--url",
    rpcUrl,
    "--keypair",
    keypairPath,
  ]);

  if (!balanceResult.success) {
    console.error("Failed to check balance");
    return false;
  }

  // Deploy the program
  const programPath = join(
    import.meta.dir,
    "..",
    "target",
    "deploy",
    "sui_sentinel.so"
  );

  const programKeypairPath = join(
    import.meta.dir,
    "..",
    "target",
    "deploy",
    "sui_sentinel-keypair.json"
  );

  if (!existsSync(programPath)) {
    console.error(`\nError: Program binary not found at ${programPath}`);
    console.error("Run with --build flag to build the program first");
    return false;
  }

  if (!existsSync(programKeypairPath)) {
    console.error(`\nError: Program keypair not found at ${programKeypairPath}`);
    console.error("Run with --build flag to generate the program keypair");
    return false;
  }

  console.log("\nDeploying program...");
  const deployResult = await runCommand("solana", [
    "program",
    "deploy",
    programPath,
    "--url",
    rpcUrl,
    "--keypair",
    keypairPath,
    "--program-id",
    programKeypairPath,
  ]);

  return deployResult.success;
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.build && !args.deploy) {
    console.log("No action specified. Use --build and/or --deploy");
    console.log("Run with --help for more information");
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("Sui Sentinel Solana Deployment CLI");
  console.log("========================================");
  console.log(`Network: ${args.network}`);

  let keypairPath: string | null = null;

  if (args.deploy) {
    const { address, privateKey } = loadEnv();
    console.log(`Admin Address: ${address}`);
    keypairPath = await createKeypairFile(privateKey);
  }

  try {
    if (args.build) {
      const buildSuccess = await buildProgram();
      if (!buildSuccess) {
        console.error("\nBuild failed!");
        process.exit(1);
      }
      console.log("\nBuild successful!");
    }

    if (args.deploy && keypairPath) {
      const deploySuccess = await deployProgram(args.network, keypairPath);
      if (!deploySuccess) {
        console.error("\nDeployment failed!");
        process.exit(1);
      }
      console.log("\nDeployment successful!");
      console.log(`Program deployed to ${args.network}`);
    }
  } finally {
    // Clean up keypair file
    if (keypairPath && existsSync(keypairPath)) {
      unlinkSync(keypairPath);
    }
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
