import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { Config } from "../types";
import { getProgram } from "../program";
import { question } from "../utils";
import bs58 from "bs58";

export async function initialize(config: Config): Promise<void> {
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

export async function setEnclavePubkey(config: Config): Promise<void> {
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

export async function updateEnclavePubkey(config: Config): Promise<void> {
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

export async function updateFeeRatios(config: Config): Promise<void> {
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

export async function updateProtocolWallet(config: Config): Promise<void> {
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

export async function transferAdmin(config: Config): Promise<void> {
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

export async function updateDynamicFeeSettings(config: Config): Promise<void> {
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

export async function pauseProtocol(config: Config): Promise<void> {
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

export async function unpauseProtocol(config: Config): Promise<void> {
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
