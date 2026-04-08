import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  PublicKey,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import bs58 from "bs58";
import type { Config, RegisterAgentRequest, RegisterAgentResponse } from "../types";
import { TEE_ENDPOINTS } from "../config";
import { getProgram } from "../program";
import { question } from "../utils";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");

export async function registerAgent(config: Config): Promise<void> {
  const program = getProgram(config);

  // Ask for request body JSON filename
  const defaultFilename = "register_agent_req_body.json";
  const filenameInput = await question(`Request body JSON filename (in data folder) [${defaultFilename}]: `);
  const filename = filenameInput || defaultFilename;
  const filePath = join(DATA_DIR, filename);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    return;
  }

  // Read and parse the request body JSON file
  let requestBody: RegisterAgentRequest;
  try {
    const fileContent = readFileSync(filePath, "utf-8");
    requestBody = JSON.parse(fileContent);
  } catch (e: any) {
    console.error("Error parsing JSON:", e.message);
    return;
  }

  console.log("\n========================================");
  console.log("Request Body");
  console.log("========================================");
  console.log(`Creator: ${requestBody.creator}`);
  console.log(`Model Provider: ${requestBody.model_provider}`);
  console.log(`Model Name: ${requestBody.model_name}`);
  console.log(`Cost per Message: ${requestBody.cost_per_message}`);
  console.log(`System Prompt: ${requestBody.system_prompt.substring(0, 50)}...`);
  console.log(`Attack Goal: ${requestBody.attack_goal.substring(0, 50)}...`);

  // Call TEE endpoint
  const teeEndpoint = TEE_ENDPOINTS[config.network];
  console.log(`\nCalling TEE endpoint: ${teeEndpoint}`);

  let teeResponse: RegisterAgentResponse;
  try {
    const response = await fetch(teeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: TEE endpoint returned ${response.status}: ${errorText}`);
      return;
    }

    teeResponse = await response.json();
    console.log("TEE response received successfully!");

    // Save response to file for reference
    const responseFilePath = join(DATA_DIR, "register_agent_response.json");
    writeFileSync(responseFilePath, JSON.stringify(teeResponse, null, 2));
    console.log(`Response saved to: ${responseFilePath}`);
  } catch (e: any) {
    console.error("Error calling TEE endpoint:", e.message);
    return;
  }

  // Validate response structure
  if (!teeResponse.response || !teeResponse.signature) {
    console.error("Error: Invalid response structure. Expected 'response' and 'signature' fields.");
    return;
  }

  const { response: teeResponseData, signature } = teeResponse;
  const { data } = teeResponseData;

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
  console.log(`Intent: ${teeResponseData.intent}`);
  console.log(`Timestamp: ${teeResponseData.timestamp}`);
  console.log(`Agent ID: ${data.agent_id}`);
  console.log(`Cost per Message: ${data.cost_per_message}`);
  console.log(`Prompt Hash: ${Buffer.from(promptHash).toString("hex")}`);
  console.log(`Creator: ${bs58.encode(Uint8Array.from(data.creator))}`);
  console.log(`Signature: ${signature.substring(0, 32)}...`);

  // Ask for token mint
  const tokenMintInput = await question("\nToken Mint Address: ");
  const tokenMint = new PublicKey(tokenMintInput);

  // Timestamp is already in seconds
  const timestampSeconds = teeResponseData.timestamp;

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

  console.log("\nStep 1: Registering agent...");

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
      Buffer.from([teeResponseData.intent]), // intent (1 byte)
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

    // Step 1: Call register_agent (creates agent account only)
    // Note: prompt_hash is [u8; 32] (fixed array) -> pass as number[]
    //       signature is Vec<u8> (bytes) -> pass as Buffer
    const tx1 = await program.methods
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
        creator: config.keypair.publicKey,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .preInstructions([ed25519Instruction])
      .rpc();

    console.log(`Transaction 1 (register_agent): ${tx1}`);
    console.log("Agent account created successfully!");

    // Step 2: Initialize vault accounts
    console.log("\nStep 2: Initializing vault accounts...");

    const tx2 = await program.methods
      .initAgentVaults()
      .accounts({
        agent: agentPda,
        tokenMint: tokenMint,
        agentVault: agentVaultPda,
        agentFeesVault: agentFeesVaultPda,
        payer: config.keypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Transaction 2 (init_agent_vaults): ${tx2}`);
    console.log("\nAgent registered successfully!");
    console.log(`Agent PDA: ${agentPda.toBase58()}`);
    console.log(`Agent Vault: ${agentVaultPda.toBase58()}`);
    console.log(`Agent Fees Vault: ${agentFeesVaultPda.toBase58()}`);
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.logs) {
      console.error("\nTransaction logs:");
      e.logs.forEach((log: string) => console.error(log));
    }
  }
}

export async function listAllAgents(config: Config): Promise<void> {
  const program = getProgram(config);

  console.log("\nFetching all agents...");
  try {
    const agents = await (program.account as any).agent.all();

    if (agents.length === 0) {
      console.log("No agents found.");
      return;
    }

    console.log(`\nFound ${agents.length} agent(s):\n`);
    console.log("========================================");

    for (const agent of agents) {
      const data = agent.account;
      console.log(`\nAgent ID: ${data.agentId}`);
      console.log(`  PDA: ${agent.publicKey.toBase58()}`);
      console.log(`  Owner: ${data.owner.toBase58()}`);
      console.log(`  Token Mint: ${data.tokenMint.toBase58()}`);
      console.log(`  Cost per Message: ${data.costPerMessage.toString()}`);
      console.log(`  Prompt Hash: ${Buffer.from(data.promptHash).toString("hex")}`);
      console.log(`  Created At: ${new Date(data.createdAt.toNumber() * 1000).toISOString()}`);
      console.log(`  Last Funded: ${data.lastFundedTimestamp.toNumber() > 0 ? new Date(data.lastFundedTimestamp.toNumber() * 1000).toISOString() : "Never"}`);
      console.log(`  Attack Count: ${data.attackCount.toString()}`);
      console.log(`  Is Defeated: ${data.isDefeated}`);
      console.log("----------------------------------------");
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

export async function requestAttack(config: Config): Promise<void> {
  const program = getProgram(config);
  const programId = new PublicKey(config.programId);

  // Get agent ID
  const agentId = await question("Agent ID to attack: ");

  // Derive agent PDA
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(agentId)],
    programId
  );

  // Fetch agent data
  let agentData;
  try {
    agentData = await (program.account as any).agent.fetch(agentPda);
  } catch (e: any) {
    console.error(`Error: Agent '${agentId}' not found`);
    return;
  }

  // Fetch protocol config
  const [protocolConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );

  let protocolConfig;
  try {
    protocolConfig = await (program.account as any).protocolConfig.fetch(protocolConfigPda);
  } catch (e: any) {
    console.error("Error: Could not fetch protocol config");
    return;
  }

  // Calculate effective cost
  const feeIncreaseBps = protocolConfig.feeIncreaseBps.toNumber();
  const maxFeeMultiplierBps = protocolConfig.maxFeeMultiplierBps.toNumber();
  const attackCount = agentData.attackCount.toNumber();
  const baseCost = agentData.costPerMessage.toNumber();

  const rawMultiplier = 10000 + (attackCount * feeIncreaseBps);
  const multiplier = Math.min(rawMultiplier, maxFeeMultiplierBps);
  const effectiveCost = Math.floor((baseCost * multiplier) / 10000);

  console.log("\n========================================");
  console.log("Attack Details");
  console.log("========================================");
  console.log(`Agent ID: ${agentId}`);
  console.log(`Agent PDA: ${agentPda.toBase58()}`);
  console.log(`Token Mint: ${agentData.tokenMint.toBase58()}`);
  console.log(`Base Cost: ${baseCost}`);
  console.log(`Attack Count: ${attackCount}`);
  console.log(`Fee Multiplier: ${(multiplier / 100).toFixed(2)}%`);
  console.log(`Effective Cost: ${effectiveCost}`);
  console.log(`Is Defeated: ${agentData.isDefeated}`);

  if (agentData.isDefeated) {
    console.log("\nWarning: This agent is already defeated!");
  }

  // Ask for attacker's token account
  const attackerTokenAccountInput = await question("\nYour Token Account Address: ");
  const attackerTokenAccount = new PublicKey(attackerTokenAccountInput);

  // Ask for protocol wallet token account
  const protocolWalletTokenAccountInput = await question("Protocol Wallet Token Account Address: ");
  const protocolWalletTokenAccount = new PublicKey(protocolWalletTokenAccountInput);

  // Generate nonce (using timestamp + random)
  const nonce = Date.now();

  // Derive PDAs
  const [agentVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_vault"), agentPda.toBuffer()],
    programId
  );

  const [agentFeesVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent_fees"), agentPda.toBuffer()],
    programId
  );

  const [attackPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("attack"),
      agentPda.toBuffer(),
      config.keypair.publicKey.toBuffer(),
      Buffer.from(new BigUint64Array([BigInt(nonce)]).buffer),
    ],
    programId
  );

  console.log("\nDerived Accounts:");
  console.log(`Agent Vault: ${agentVaultPda.toBase58()}`);
  console.log(`Agent Fees Vault: ${agentFeesVaultPda.toBase58()}`);
  console.log(`Attack PDA: ${attackPda.toBase58()}`);
  console.log(`Nonce: ${nonce}`);

  const confirm = await question("\nProceed with attack? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nRequesting attack...");
  try {
    const tx = await program.methods
      .requestAttack(new BN(nonce))
      .accounts({
        protocolConfig: protocolConfigPda,
        agent: agentPda,
        agentVault: agentVaultPda,
        agentFeesVault: agentFeesVaultPda,
        attack: attackPda,
        attackerTokenAccount: attackerTokenAccount,
        protocolWallet: protocolConfig.protocolWallet,
        protocolWalletTokenAccount: protocolWalletTokenAccount,
        attacker: config.keypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`\nTransaction: ${tx}`);
    console.log("\n========================================");
    console.log("Attack Requested Successfully!");
    console.log("========================================");
    console.log(`Attack PDA: ${attackPda.toBase58()}`);
    console.log(`Nonce: ${nonce}`);
    console.log(`Amount Paid: ${effectiveCost}`);
    console.log("\nNote: The attack account is created. Wait for the TEE to process and call consume_prompt.");
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.logs) {
      console.error("\nTransaction logs:");
      e.logs.forEach((log: string) => console.error(log));
    }
  }
}
