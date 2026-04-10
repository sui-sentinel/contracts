import { Keypair } from "@solana/web3.js";

export type NetworkType = "devnet" | "testnet" | "mainnet";

export interface Config {
  network: NetworkType;
  programId: string;
  rpcUrl: string;
  keypair: Keypair;
}

export interface RegisterAgentRequest {
  cost_per_message: number;
  creator: string;
  model_provider: string;
  model_name: string;
  system_prompt: string;
  private_prompt: string;
  attack_goal: string;
  jury_prompt: string;
}

export interface RegisterAgentResponse {
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

export interface ConsumePromptRequest {
  agent_id: string;
  message: string;
  attack_account_pubkey: string;
}

export interface ConsumePromptResponse {
  response: {
    intent: number;
    timestamp: number;
    data: {
      agent_id: string;
      success: boolean;
      score: number;
      attacker: number[];
      nonce: number;
      message_hash: number[];
    };
  };
  signature: string;
}

export interface Operation {
  name: string;
  fn: ((config: Config) => Promise<void>) | null;
  requiresProgramId: boolean;
  special?: string;
}
