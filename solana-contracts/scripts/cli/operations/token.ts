import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAccount,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import type { Config } from "../types";
import { getProgram } from "../program";
import { question } from "../utils";

/**
 * Derive Associated Token Account (ATA) address for a wallet and mint
 */
export async function deriveTokenAccount(config: Config): Promise<void> {
  console.log("\n========================================");
  console.log("Derive Token Account Address");
  console.log("========================================");

  const ownerInput = await question("Wallet Address (leave empty for your wallet): ");
  const owner = ownerInput
    ? new PublicKey(ownerInput)
    : config.keypair.publicKey;

  const mintInput = await question(
    `Token Mint Address [${NATIVE_MINT.toBase58()} for wSOL]: `
  );
  const mint = mintInput ? new PublicKey(mintInput) : NATIVE_MINT;

  const ata = await getAssociatedTokenAddress(mint, owner);

  console.log("\n========================================");
  console.log("Result");
  console.log("========================================");
  console.log(`Owner: ${owner.toBase58()}`);
  console.log(`Token Mint: ${mint.toBase58()}`);
  console.log(`Associated Token Account: ${ata.toBase58()}`);

  // Check if account exists
  const program = getProgram(config);
  const connection = program.provider.connection;

  try {
    const accountInfo = await getAccount(connection, ata);
    console.log(`\nAccount Status: EXISTS`);
    console.log(`Balance: ${accountInfo.amount.toString()} (raw)`);
    if (mint.equals(NATIVE_MINT)) {
      console.log(
        `Balance: ${Number(accountInfo.amount) / LAMPORTS_PER_SOL} SOL`
      );
    }
  } catch {
    console.log(`\nAccount Status: DOES NOT EXIST`);
    console.log("Use 'Create Token Account' or 'Wrap SOL' to create it.");
  }
}

/**
 * Create an Associated Token Account for the user
 */
export async function createTokenAccount(config: Config): Promise<void> {
  const program = getProgram(config);
  const connection = program.provider.connection;

  console.log("\n========================================");
  console.log("Create Token Account");
  console.log("========================================");

  const ownerInput = await question("Owner Wallet Address (leave empty for your wallet): ");
  const owner = ownerInput
    ? new PublicKey(ownerInput)
    : config.keypair.publicKey;

  const mintInput = await question(
    `Token Mint Address [${NATIVE_MINT.toBase58()} for wSOL]: `
  );
  const mint = mintInput ? new PublicKey(mintInput) : NATIVE_MINT;

  const ata = await getAssociatedTokenAddress(mint, owner);

  console.log(`\nOwner: ${owner.toBase58()}`);
  console.log(`Token Mint: ${mint.toBase58()}`);
  console.log(`Associated Token Account: ${ata.toBase58()}`);

  // Check if account already exists
  try {
    await getAccount(connection, ata);
    console.log("\nToken account already exists!");
    return;
  } catch {
    // Account doesn't exist, proceed to create
  }

  const confirm = await question("\nCreate this token account? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nCreating token account...");

  try {
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        config.keypair.publicKey, // payer
        ata, // associated token account
        owner, // owner
        mint // mint
      )
    );

    const tx = await program.provider.sendAndConfirm!(transaction, [
      config.keypair,
    ]);
    console.log(`\nTransaction: ${tx}`);
    console.log(`Token Account Created: ${ata.toBase58()}`);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

/**
 * Wrap SOL into wSOL (native mint)
 */
export async function wrapSol(config: Config): Promise<void> {
  const program = getProgram(config);
  const connection = program.provider.connection;

  console.log("\n========================================");
  console.log("Wrap SOL into wSOL");
  console.log("========================================");

  // Get user's SOL balance
  const solBalance = await connection.getBalance(config.keypair.publicKey);
  console.log(`Your SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);

  const amountInput = await question("\nAmount of SOL to wrap: ");
  const amount = parseFloat(amountInput);

  if (isNaN(amount) || amount <= 0) {
    console.log("Invalid amount.");
    return;
  }

  const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

  if (lamports > solBalance) {
    console.log("Insufficient SOL balance.");
    return;
  }

  const ata = await getAssociatedTokenAddress(
    NATIVE_MINT,
    config.keypair.publicKey
  );

  console.log(`\nWrapping ${amount} SOL into wSOL`);
  console.log(`wSOL Account: ${ata.toBase58()}`);

  const confirm = await question("\nProceed? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nWrapping SOL...");

  try {
    const transaction = new Transaction();

    // Check if ATA exists
    let ataExists = false;
    try {
      await getAccount(connection, ata);
      ataExists = true;
    } catch {
      // Account doesn't exist
    }

    // Create ATA if it doesn't exist
    if (!ataExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          config.keypair.publicKey,
          ata,
          config.keypair.publicKey,
          NATIVE_MINT
        )
      );
    }

    // Transfer SOL to the ATA
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: config.keypair.publicKey,
        toPubkey: ata,
        lamports,
      })
    );

    // Sync the native account to update the token balance
    transaction.add(createSyncNativeInstruction(ata));

    const tx = await program.provider.sendAndConfirm!(transaction, [
      config.keypair,
    ]);

    console.log(`\nTransaction: ${tx}`);
    console.log(`Wrapped ${amount} SOL into wSOL`);

    // Show updated balance
    const accountInfo = await getAccount(connection, ata);
    console.log(
      `wSOL Balance: ${Number(accountInfo.amount) / LAMPORTS_PER_SOL} SOL`
    );
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

/**
 * Unwrap wSOL back to SOL
 */
export async function unwrapSol(config: Config): Promise<void> {
  const program = getProgram(config);
  const connection = program.provider.connection;

  console.log("\n========================================");
  console.log("Unwrap wSOL to SOL");
  console.log("========================================");

  const ata = await getAssociatedTokenAddress(
    NATIVE_MINT,
    config.keypair.publicKey
  );

  // Check wSOL balance
  let wsolBalance: bigint;
  try {
    const accountInfo = await getAccount(connection, ata);
    wsolBalance = accountInfo.amount;
    console.log(`Your wSOL Balance: ${Number(wsolBalance) / LAMPORTS_PER_SOL} SOL`);
  } catch {
    console.log("You don't have a wSOL account.");
    return;
  }

  if (wsolBalance === BigInt(0)) {
    console.log("Your wSOL balance is 0.");
    return;
  }

  console.log(`\nThis will close your wSOL account and return all wSOL as SOL.`);
  console.log(`wSOL Account: ${ata.toBase58()}`);

  const confirm = await question("\nProceed? (yes/no): ");
  if (confirm.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    return;
  }

  console.log("\nUnwrapping wSOL...");

  try {
    const transaction = new Transaction().add(
      createCloseAccountInstruction(
        ata, // account to close
        config.keypair.publicKey, // destination for remaining SOL
        config.keypair.publicKey // owner
      )
    );

    const tx = await program.provider.sendAndConfirm!(transaction, [
      config.keypair,
    ]);

    console.log(`\nTransaction: ${tx}`);
    console.log(`Unwrapped ${Number(wsolBalance) / LAMPORTS_PER_SOL} SOL`);

    // Show updated SOL balance
    const solBalance = await connection.getBalance(config.keypair.publicKey);
    console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

/**
 * Show token balances for a wallet
 */
export async function showTokenBalances(config: Config): Promise<void> {
  const program = getProgram(config);
  const connection = program.provider.connection;

  console.log("\n========================================");
  console.log("Token Balances");
  console.log("========================================");

  const ownerInput = await question("Wallet Address (leave empty for your wallet): ");
  const owner = ownerInput
    ? new PublicKey(ownerInput)
    : config.keypair.publicKey;

  console.log(`\nWallet: ${owner.toBase58()}`);

  // Get SOL balance
  const solBalance = await connection.getBalance(owner);
  console.log(`\nSOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);

  // Get wSOL balance
  const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, owner);
  try {
    const accountInfo = await getAccount(connection, wsolAta);
    console.log(
      `wSOL Balance: ${Number(accountInfo.amount) / LAMPORTS_PER_SOL} SOL`
    );
    console.log(`wSOL Account: ${wsolAta.toBase58()}`);
  } catch {
    console.log(`wSOL Balance: 0 (no account)`);
  }
}

/**
 * Get protocol wallet token account (useful for request_attack)
 */
export async function getProtocolWalletTokenAccount(
  config: Config
): Promise<void> {
  const program = getProgram(config);
  const programId = new PublicKey(config.programId);

  console.log("\n========================================");
  console.log("Protocol Wallet Token Account");
  console.log("========================================");

  // Derive protocol config PDA
  const [protocolConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    programId
  );

  // Fetch protocol config
  let protocolConfig;
  try {
    protocolConfig = await (program.account as any).protocolConfig.fetch(
      protocolConfigPda
    );
  } catch (e: any) {
    console.error("Error: Could not fetch protocol config. Is the protocol initialized?");
    return;
  }

  const protocolWallet = protocolConfig.protocolWallet;
  console.log(`Protocol Wallet: ${protocolWallet.toBase58()}`);

  const mintInput = await question(
    `Token Mint Address [${NATIVE_MINT.toBase58()} for wSOL]: `
  );
  const mint = mintInput ? new PublicKey(mintInput) : NATIVE_MINT;

  const protocolWalletAta = await getAssociatedTokenAddress(mint, protocolWallet);

  console.log(`\nToken Mint: ${mint.toBase58()}`);
  console.log(`Protocol Wallet Token Account: ${protocolWalletAta.toBase58()}`);

  // Check if it exists
  const connection = program.provider.connection;
  try {
    const accountInfo = await getAccount(connection, protocolWalletAta);
    console.log(`\nAccount Status: EXISTS`);
    console.log(`Balance: ${accountInfo.amount.toString()} (raw)`);
  } catch {
    console.log(`\nAccount Status: DOES NOT EXIST`);
    console.log("The protocol wallet token account needs to be created first.");
  }
}
