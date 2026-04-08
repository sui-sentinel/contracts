import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import type { Config, NetworkType } from "./types";

export const NETWORK_URLS: Record<NetworkType, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

export const TEE_ENDPOINTS: Record<NetworkType, string> = {
  devnet: "https://tee-solana.suisentinel.xyz/devnet/register-agent",
  testnet: "https://tee-solana.suisentinel.xyz/testnet/register-agent",
  mainnet: "https://tee-solana.suisentinel.xyz/mainnet/register-agent",
};

export function getProgramIdEnvKey(network: NetworkType): string {
  return `${network.toUpperCase()}_PROGRAM_ID`;
}

export function loadConfig(network: NetworkType): Config {
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
