import { ethers, Contract, Wallet, JsonRpcProvider, ContractTransactionResponse } from "ethers";
import { getNetwork, getPrivateKey, getSentinelAddress, NetworkConfig } from "./config.js";
import abi from "./abi.json";

export function getProvider(networkName: string): JsonRpcProvider {
  const network = getNetwork(networkName);
  return new ethers.JsonRpcProvider(network.rpcUrl, {
    chainId: network.chainId,
    name: network.name,
  });
}

export function getWallet(networkName: string): Wallet {
  const provider = getProvider(networkName);
  const privateKey = getPrivateKey();
  return new Wallet(privateKey, provider);
}

export function getSentinelContract(networkName: string, address?: string): Contract {
  const wallet = getWallet(networkName);
  const contractAddress = address || getSentinelAddress();
  return new Contract(contractAddress, abi, wallet);
}

export function getSentinelContractReadOnly(networkName: string, address: string): Contract {
  const provider = getProvider(networkName);
  return new Contract(address, abi, provider);
}

export function getContractFactory(networkName: string) {
  const wallet = getWallet(networkName);
  return new ethers.ContractFactory(abi, getBytecode(), wallet);
}

function getBytecode(): string {
  // We'll read from the Foundry output
  const fs = require("fs");
  const path = require("path");
  const artifactPath = path.resolve(__dirname, "../../out/Sentinel.sol/Sentinel.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  return artifact.bytecode.object;
}

export async function waitForTx(tx: ContractTransactionResponse, network: NetworkConfig): Promise<string> {
  console.log(`Transaction sent: ${network.explorer}/tx/${tx.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  if (receipt && receipt.status === 1) {
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  }
  return tx.hash;
}

// Helper to format wei to ether
export function formatEther(wei: bigint): string {
  return ethers.formatEther(wei);
}

// Helper to parse ether to wei
export function parseEther(ether: string): bigint {
  return ethers.parseEther(ether);
}

// Helper to format units
export function formatUnits(value: bigint, decimals: number): string {
  return ethers.formatUnits(value, decimals);
}

// Helper to parse units
export function parseUnits(value: string, decimals: number): bigint {
  return ethers.parseUnits(value, decimals);
}
