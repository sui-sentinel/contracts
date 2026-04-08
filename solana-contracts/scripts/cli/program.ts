import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import type { Config } from "./types";
import IDL from "../../target/idl/sui_sentinel.json";

export function getProgram(config: Config): Program {
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
