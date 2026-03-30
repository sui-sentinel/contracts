import { config } from "dotenv";
import { resolve } from "path";

// Load .env from parent directory
config({ path: resolve(process.cwd(), "../.env") });

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: number;
  explorer: string;
  explorerApi?: string;
}

export const networks: Record<string, NetworkConfig> = {
  // Ethereum
  mainnet: {
    name: "Ethereum Mainnet",
    rpcUrl: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
    chainId: 1,
    explorer: "https://etherscan.io",
    explorerApi: "https://api.etherscan.io/api",
  },
  sepolia: {
    name: "Sepolia Testnet",
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    explorerApi: "https://api-sepolia.etherscan.io/api",
  },

  // Arbitrum
  arbitrum: {
    name: "Arbitrum One",
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    explorer: "https://arbiscan.io",
    explorerApi: "https://api.arbiscan.io/api",
  },
  arbitrum_sepolia: {
    name: "Arbitrum Sepolia",
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    explorer: "https://sepolia.arbiscan.io",
    explorerApi: "https://api-sepolia.arbiscan.io/api",
  },

  // Optimism
  optimism: {
    name: "Optimism",
    rpcUrl: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    chainId: 10,
    explorer: "https://optimistic.etherscan.io",
    explorerApi: "https://api-optimistic.etherscan.io/api",
  },
  optimism_sepolia: {
    name: "Optimism Sepolia",
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
    chainId: 11155420,
    explorer: "https://sepolia-optimism.etherscan.io",
    explorerApi: "https://api-sepolia-optimistic.etherscan.io/api",
  },

  // Base
  base: {
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    chainId: 8453,
    explorer: "https://basescan.org",
    explorerApi: "https://api.basescan.org/api",
  },
  base_sepolia: {
    name: "Base Sepolia",
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    chainId: 84532,
    explorer: "https://sepolia.basescan.org",
    explorerApi: "https://api-sepolia.basescan.org/api",
  },

  // Polygon
  polygon: {
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    chainId: 137,
    explorer: "https://polygonscan.com",
    explorerApi: "https://api.polygonscan.com/api",
  },
  polygon_amoy: {
    name: "Polygon Amoy",
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    chainId: 80002,
    explorer: "https://amoy.polygonscan.com",
    explorerApi: "https://api-amoy.polygonscan.com/api",
  },

  // Avalanche
  avalanche: {
    name: "Avalanche C-Chain",
    rpcUrl: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    explorer: "https://snowtrace.io",
    explorerApi: "https://api.snowtrace.io/api",
  },
  avalanche_fuji: {
    name: "Avalanche Fuji",
    rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    explorerApi: "https://api-testnet.snowtrace.io/api",
  },

  // BSC
  bsc: {
    name: "BNB Smart Chain",
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
    chainId: 56,
    explorer: "https://bscscan.com",
    explorerApi: "https://api.bscscan.com/api",
  },
  bsc_testnet: {
    name: "BSC Testnet",
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
    chainId: 97,
    explorer: "https://testnet.bscscan.com",
    explorerApi: "https://api-testnet.bscscan.com/api",
  },
};

export function getNetwork(name: string): NetworkConfig {
  const network = networks[name];
  if (!network) {
    throw new Error(`Unknown network: ${name}. Available: ${Object.keys(networks).join(", ")}`);
  }
  return network;
}

export function getPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not set in .env file");
  }
  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

export function getEnclavePublicKey(): string {
  const enclaveKey = process.env.ENCLAVE_PUBLIC_KEY;
  if (!enclaveKey) {
    throw new Error("ENCLAVE_PUBLIC_KEY not set in .env file");
  }
  return enclaveKey.startsWith("0x") ? enclaveKey : `0x${enclaveKey}`;
}

export function getSentinelAddress(): string {
  const address = process.env.SENTINEL_ADDRESS;
  if (!address) {
    throw new Error("SENTINEL_ADDRESS not set in .env file");
  }
  return address;
}
