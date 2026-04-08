import { PublicKey } from "@solana/web3.js";
import type { Config } from "../types";
import { getProgram } from "../program";

export async function viewProtocolConfig(config: Config): Promise<void> {
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
