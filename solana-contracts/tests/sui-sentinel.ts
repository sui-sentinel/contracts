import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SuiSentinel } from "../target/types/sui_sentinel";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import * as nacl from "tweetnacl";

describe("sui-sentinel", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SuiSentinel as Program<SuiSentinel>;

  // Test accounts
  const admin = Keypair.generate();
  const protocolWallet = Keypair.generate();
  const agentCreator = Keypair.generate();
  const attacker = Keypair.generate();

  // Enclave keypair (simulating TEE)
  const enclaveKeypair = Keypair.generate();

  // Token mint
  let tokenMint: PublicKey;
  let adminTokenAccount: PublicKey;
  let protocolWalletTokenAccount: PublicKey;
  let creatorTokenAccount: PublicKey;
  let attackerTokenAccount: PublicKey;

  // PDAs
  let protocolConfigPda: PublicKey;
  let protocolConfigBump: number;

  const agentId = "test-agent-001";

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;

    await Promise.all([
      provider.connection.requestAirdrop(admin.publicKey, airdropAmount),
      provider.connection.requestAirdrop(protocolWallet.publicKey, airdropAmount),
      provider.connection.requestAirdrop(agentCreator.publicKey, airdropAmount),
      provider.connection.requestAirdrop(attacker.publicKey, airdropAmount),
    ]);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Derive protocol config PDA
    [protocolConfigPda, protocolConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );

    // Create token mint
    tokenMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9 // decimals
    );

    // Create token accounts
    adminTokenAccount = await createAccount(
      provider.connection,
      admin,
      tokenMint,
      admin.publicKey
    );

    protocolWalletTokenAccount = await createAccount(
      provider.connection,
      admin,
      tokenMint,
      protocolWallet.publicKey
    );

    creatorTokenAccount = await createAccount(
      provider.connection,
      admin,
      tokenMint,
      agentCreator.publicKey
    );

    attackerTokenAccount = await createAccount(
      provider.connection,
      admin,
      tokenMint,
      attacker.publicKey
    );

    // Mint tokens to test accounts
    const mintAmount = 1000_000_000_000; // 1000 tokens with 9 decimals
    await mintTo(
      provider.connection,
      admin,
      tokenMint,
      creatorTokenAccount,
      admin,
      mintAmount
    );

    await mintTo(
      provider.connection,
      admin,
      tokenMint,
      attackerTokenAccount,
      admin,
      mintAmount
    );
  });

  describe("Protocol Initialization", () => {
    it("should initialize the protocol config", async () => {
      await program.methods
        .initialize(protocolWallet.publicKey)
        .accounts({
          protocolConfig: protocolConfigPda,
          admin: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.protocolConfig.fetch(protocolConfigPda);

      expect(config.admin.toString()).to.equal(admin.publicKey.toString());
      expect(config.protocolWallet.toString()).to.equal(protocolWallet.publicKey.toString());
      expect(config.agentBalanceFee.toNumber()).to.equal(5000);
      expect(config.creatorFee.toNumber()).to.equal(4000);
      expect(config.protocolFee.toNumber()).to.equal(1000);
      expect(config.isPaused).to.equal(false);
      expect(config.enclavePubkey).to.equal(null);
    });

    it("should set the enclave public key", async () => {
      const enclavePubkeyBytes = Array.from(enclaveKeypair.publicKey.toBytes());

      await program.methods
        .setEnclavePubkey(enclavePubkeyBytes)
        .accounts({
          protocolConfig: protocolConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.protocolConfig.fetch(protocolConfigPda);
      expect(config.enclavePubkey).to.deep.equal(enclavePubkeyBytes);
    });
  });

  describe("Admin Functions", () => {
    it("should update fee ratios", async () => {
      await program.methods
        .updateFeeRatios(
          new anchor.BN(4000), // agent balance
          new anchor.BN(5000), // creator
          new anchor.BN(1000)  // protocol
        )
        .accounts({
          protocolConfig: protocolConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      const config = await program.account.protocolConfig.fetch(protocolConfigPda);
      expect(config.agentBalanceFee.toNumber()).to.equal(4000);
      expect(config.creatorFee.toNumber()).to.equal(5000);
      expect(config.protocolFee.toNumber()).to.equal(1000);
    });

    it("should fail with invalid fee ratios", async () => {
      try {
        await program.methods
          .updateFeeRatios(
            new anchor.BN(5000),
            new anchor.BN(5000),
            new anchor.BN(1000) // Sum = 11000, invalid
          )
          .accounts({
            protocolConfig: protocolConfigPda,
            admin: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.message).to.include("InvalidFeeRatios");
      }
    });

    it("should pause and unpause protocol", async () => {
      // Pause
      await program.methods
        .pauseProtocol()
        .accounts({
          protocolConfig: protocolConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      let config = await program.account.protocolConfig.fetch(protocolConfigPda);
      expect(config.isPaused).to.equal(true);

      // Unpause
      await program.methods
        .unpauseProtocol()
        .accounts({
          protocolConfig: protocolConfigPda,
          admin: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      config = await program.account.protocolConfig.fetch(protocolConfigPda);
      expect(config.isPaused).to.equal(false);
    });
  });

  // Helper function to create Ed25519 signature instruction
  function createEd25519Instruction(
    privateKey: Uint8Array,
    message: Buffer
  ): TransactionInstruction {
    const signature = nacl.sign.detached(message, privateKey);
    const publicKey = nacl.sign.keyPair.fromSecretKey(privateKey).publicKey;

    return Ed25519Program.createInstructionWithPrivateKey({
      privateKey: privateKey,
      message: message,
    });
  }

  // Note: Full integration tests for register_agent and consume_prompt would require
  // setting up proper Ed25519 signature verification in the transaction.
  // The following are placeholder tests that demonstrate the expected flow.

  describe("Agent Registration (requires Ed25519 setup)", () => {
    it("should have correct account derivation for agent", async () => {
      const [agentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), Buffer.from(agentId)],
        program.programId
      );

      expect(agentPda).to.be.instanceOf(PublicKey);
    });
  });
});
