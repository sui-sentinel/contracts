#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { ethers } from "ethers";
import {
  getProvider,
  getWallet,
  getSentinelContract,
  getSentinelContractReadOnly,
  waitForTx,
  formatEther,
  parseEther,
  formatUnits,
  parseUnits,
} from "./contract.js";
import { getNetwork, getEnclavePublicKey, networks } from "./config.js";
import abi from "./abi.json";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name("sentinel")
  .description("CLI for interacting with the Sentinel contract")
  .version("1.0.0")
  .option("-n, --network <network>", "Network to use", "sepolia");

// ==================== Deploy Commands ====================

program
  .command("deploy")
  .description("Deploy a new Sentinel contract")
  .requiredOption("-w, --wallet <address>", "Protocol wallet address")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);
    console.log(chalk.blue(`Deploying Sentinel to ${networkConfig.name}...`));

    try {
      const wallet = getWallet(network);
      console.log(`Deployer: ${wallet.address}`);

      // Read bytecode from Foundry artifact
      const artifactPath = resolve(__dirname, "../../out/Sentinel.sol/Sentinel.json");
      const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
      const bytecode = artifact.bytecode.object;

      const factory = new ethers.ContractFactory(abi, bytecode, wallet);
      const contract = await factory.deploy(options.wallet);

      console.log(chalk.yellow(`Deploying... tx: ${networkConfig.explorer}/tx/${contract.deploymentTransaction()?.hash}`));
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      console.log(chalk.green(`\nSentinel deployed at: ${address}`));
      console.log(chalk.gray(`Add this to your .env: SENTINEL_ADDRESS=${address}`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Enclave Commands ====================

program
  .command("register-enclave")
  .description("Register the enclave public key")
  .option("-k, --key <address>", "Enclave public key address (defaults to ENCLAVE_PUBLIC_KEY from .env)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      const enclaveKey = options.key || getEnclavePublicKey();
      console.log(chalk.blue(`Registering enclave on ${networkConfig.name}...`));
      console.log(`Enclave public key: ${enclaveKey}`);

      const contract = getSentinelContract(network);
      const tx = await contract.registerEnclave(enclaveKey);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Enclave registered successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("update-enclave")
  .description("Update the enclave public key")
  .requiredOption("-k, --key <address>", "New enclave public key address")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Updating enclave on ${networkConfig.name}...`));
      console.log(`New enclave public key: ${options.key}`);

      const contract = getSentinelContract(network);
      const tx = await contract.updateEnclave(options.key);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Enclave updated successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Token Whitelist Commands ====================

program
  .command("whitelist-token")
  .description("Add a token to the whitelist")
  .requiredOption("-t, --token <address>", "Token address")
  .option("-m, --minimum <amount>", "Minimum amount (in token decimals)", "0")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Whitelisting token on ${networkConfig.name}...`));
      console.log(`Token: ${options.token}`);

      const contract = getSentinelContract(network);
      const tx = await contract.addWhitelistedToken(options.token);
      await waitForTx(tx, networkConfig);

      if (options.minimum !== "0") {
        console.log(`Setting minimum amount: ${options.minimum}`);
        const tx2 = await contract.setMinimumTokenAmount(options.token, options.minimum);
        await waitForTx(tx2, networkConfig);
      }

      console.log(chalk.green("Token whitelisted successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("remove-token")
  .description("Remove a token from the whitelist")
  .requiredOption("-t, --token <address>", "Token address")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Removing token from whitelist on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.removeWhitelistedToken(options.token);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Token removed from whitelist!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Agent Commands ====================

program
  .command("register-agent")
  .description("Register a new agent")
  .requiredOption("--agent-id <id>", "Unique agent ID")
  .requiredOption("--cost <amount>", "Cost per message (in wei)")
  .requiredOption("--prompt <prompt>", "System prompt")
  .requiredOption("--token <address>", "Token address for payments")
  .requiredOption("--initial-fund <amount>", "Initial fund amount (in wei)")
  .requiredOption("--timestamp <ms>", "Timestamp in milliseconds")
  .requiredOption("--signature <sig>", "Enclave signature (hex)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Registering agent on ${networkConfig.name}...`));
      console.log(`Agent ID: ${options.agentId}`);
      console.log(`Cost: ${options.cost}`);
      console.log(`Token: ${options.token}`);

      const contract = getSentinelContract(network);

      // Approve token spending first
      const tokenContract = new ethers.Contract(
        options.token,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        getWallet(network)
      );

      console.log("Approving token spending...");
      const approveTx = await tokenContract.approve(await contract.getAddress(), options.initialFund);
      await waitForTx(approveTx, networkConfig);

      // Register agent
      const tx = await contract.registerAgent(
        options.agentId,
        options.timestamp,
        options.cost,
        options.prompt,
        options.token,
        options.initialFund,
        options.signature
      );
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Agent registered successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("fund-agent")
  .description("Fund an existing agent")
  .requiredOption("--agent-id <id>", "Agent ID")
  .requiredOption("--amount <amount>", "Amount to fund (in wei)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Funding agent on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const agent = await contract.getAgent(options.agentId);

      // Approve token spending
      const tokenContract = new ethers.Contract(
        agent.token,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        getWallet(network)
      );

      console.log("Approving token spending...");
      const approveTx = await tokenContract.approve(await contract.getAddress(), options.amount);
      await waitForTx(approveTx, networkConfig);

      // Fund agent
      const tx = await contract.fundAgent(options.agentId, options.amount);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Agent funded successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("get-agent")
  .description("Get agent information")
  .requiredOption("--agent-id <id>", "Agent ID")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      const contract = getSentinelContract(network);
      const agent = await contract.getAgent(options.agentId);

      console.log(chalk.blue(`\nAgent: ${options.agentId}`));
      console.log(chalk.gray("─".repeat(50)));
      console.log(`Token:            ${agent.token}`);
      console.log(`Owner:            ${agent.owner}`);
      console.log(`Cost per message: ${agent.costPerMessage.toString()}`);
      console.log(`Balance:          ${agent.balance.toString()}`);
      console.log(`Accumulated fees: ${agent.accumulatedFees.toString()}`);
      console.log(`Attack count:     ${agent.attackCount.toString()}`);
      console.log(`Created at:       ${new Date(Number(agent.createdAt) * 1000).toISOString()}`);
      console.log(`System prompt:    ${agent.systemPrompt}`);

      // Get effective cost
      const effectiveCost = await contract.getEffectiveCost(options.agentId);
      console.log(`Effective cost:   ${effectiveCost.toString()}`);

      // Get withdrawal status
      const isUnlocked = await contract.isWithdrawalUnlocked(options.agentId);
      const unlockTime = await contract.getWithdrawalUnlockTimestamp(options.agentId);
      console.log(`Withdrawal unlocked: ${isUnlocked}`);
      if (!isUnlocked) {
        console.log(`Unlock time:      ${new Date(Number(unlockTime) * 1000).toISOString()}`);
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Attack Commands ====================

program
  .command("request-attack")
  .description("Request an attack on an agent")
  .requiredOption("--agent-id <id>", "Agent ID")
  .requiredOption("--amount <amount>", "Payment amount (in wei)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Requesting attack on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const agent = await contract.getAgent(options.agentId);

      // Approve token spending
      const tokenContract = new ethers.Contract(
        agent.token,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        getWallet(network)
      );

      console.log("Approving token spending...");
      const approveTx = await tokenContract.approve(await contract.getAddress(), options.amount);
      await waitForTx(approveTx, networkConfig);

      // Request attack
      const tx = await contract.requestAttack(options.agentId, options.amount);
      const receipt = await tx.wait();

      // Get attack ID from events
      const attackEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === "AttackRequested";
        } catch {
          return false;
        }
      });

      if (attackEvent) {
        const parsed = contract.interface.parseLog(attackEvent);
        console.log(chalk.green(`\nAttack requested successfully!`));
        console.log(`Attack ID: ${parsed?.args.attackId.toString()}`);
        console.log(`Nonce: ${parsed?.args.nonce.toString()}`);
      } else {
        console.log(chalk.green("Attack requested successfully!"));
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("consume-prompt")
  .description("Submit the result of an attack")
  .requiredOption("--agent-id <id>", "Agent ID")
  .requiredOption("--attack-id <id>", "Attack ID")
  .requiredOption("--success <bool>", "Whether the attack was successful")
  .requiredOption("--score <score>", "Score (0-100)")
  .requiredOption("--prompt <prompt>", "The prompt that was sent")
  .requiredOption("--agent-response <response>", "Agent response")
  .requiredOption("--jury-response <response>", "Jury response")
  .requiredOption("--fun-response <response>", "Fun response")
  .requiredOption("--timestamp <ms>", "Timestamp in milliseconds")
  .requiredOption("--signature <sig>", "Enclave signature (hex)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Consuming prompt on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const success = options.success === "true" || options.success === true;

      const tx = await contract.consumePrompt(
        options.agentId,
        success,
        options.agentResponse,
        options.juryResponse,
        options.funResponse,
        options.prompt,
        parseInt(options.score),
        options.timestamp,
        options.signature,
        options.attackId
      );
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Prompt consumed successfully!"));
      if (success) {
        console.log(chalk.yellow("Attack was successful - reward transferred!"));
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("get-attack")
  .description("Get attack information")
  .requiredOption("--attack-id <id>", "Attack ID")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;

    try {
      const contract = getSentinelContract(network);
      const attack = await contract.getAttack(options.attackId);

      if (!attack.exists) {
        console.log(chalk.yellow("Attack not found or already consumed"));
        return;
      }

      console.log(chalk.blue(`\nAttack: ${options.attackId}`));
      console.log(chalk.gray("─".repeat(50)));
      console.log(`Agent ID:    ${attack.agentId}`);
      console.log(`Attacker:    ${attack.attacker}`);
      console.log(`Paid amount: ${attack.paidAmount.toString()}`);
      console.log(`Nonce:       ${attack.nonce.toString()}`);
      console.log(`Token:       ${attack.token}`);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Owner Commands ====================

program
  .command("claim-fees")
  .description("Claim accumulated fees for an agent")
  .requiredOption("--agent-id <id>", "Agent ID")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Claiming fees on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.claimFees(options.agentId);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Fees claimed successfully!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("withdraw")
  .description("Withdraw funds from an agent (after lock period)")
  .requiredOption("--agent-id <id>", "Agent ID")
  .requiredOption("--amount <amount>", "Amount to withdraw (in wei)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Withdrawing from agent on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.withdrawFromAgent(options.agentId, options.amount);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Withdrawal successful!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== Admin Commands ====================

program
  .command("update-fees")
  .description("Update fee ratios (admin only)")
  .requiredOption("--agent-fee <bps>", "Agent balance fee in basis points")
  .requiredOption("--creator-fee <bps>", "Creator fee in basis points")
  .requiredOption("--protocol-fee <bps>", "Protocol fee in basis points")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      const total = parseInt(options.agentFee) + parseInt(options.creatorFee) + parseInt(options.protocolFee);
      if (total !== 10000) {
        throw new Error(`Fee ratios must sum to 10000 (100%), got ${total}`);
      }

      console.log(chalk.blue(`Updating fee ratios on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.updateFeeRatios(options.agentFee, options.creatorFee, options.protocolFee);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Fee ratios updated!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("update-protocol-wallet")
  .description("Update protocol wallet address (admin only)")
  .requiredOption("-w, --wallet <address>", "New protocol wallet address")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Updating protocol wallet on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.updateProtocolWallet(options.wallet);
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Protocol wallet updated!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("pause")
  .description("Pause the protocol (admin only)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Pausing protocol on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.pauseProtocol();
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Protocol paused!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("unpause")
  .description("Unpause the protocol (admin only)")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      console.log(chalk.blue(`Unpausing protocol on ${networkConfig.name}...`));

      const contract = getSentinelContract(network);
      const tx = await contract.unpauseProtocol();
      await waitForTx(tx, networkConfig);

      console.log(chalk.green("Protocol unpaused!"));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ==================== View Commands ====================

program
  .command("info")
  .description("Get contract information")
  .action(async (options, cmd) => {
    const network = cmd.parent.opts().network;
    const networkConfig = getNetwork(network);

    try {
      const contract = getSentinelContract(network);

      const enclaveKey = await contract.enclavePublicKey();
      const config = await contract.protocolConfig();
      const agentCount = await contract.agentCount();

      console.log(chalk.blue(`\nSentinel Contract Info (${networkConfig.name})`));
      console.log(chalk.gray("─".repeat(50)));
      console.log(`Address:          ${await contract.getAddress()}`);
      console.log(`Enclave Key:      ${enclaveKey}`);
      console.log(`Protocol Wallet:  ${config.protocolWallet}`);
      console.log(`Agent Count:      ${agentCount.toString()}`);
      console.log(`Is Paused:        ${config.isPaused}`);
      console.log(chalk.gray("\nFee Configuration:"));
      console.log(`  Agent Balance:  ${Number(config.agentBalanceFee) / 100}%`);
      console.log(`  Creator:        ${Number(config.creatorFee) / 100}%`);
      console.log(`  Protocol:       ${Number(config.protocolFee) / 100}%`);
      console.log(`  Fee Increase:   ${Number(config.feeIncreaseBps) / 100}% per attack`);
      console.log(`  Max Multiplier: ${Number(config.maxFeeMultiplierBps) / 10000}x`);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("networks")
  .description("List available networks")
  .action(() => {
    console.log(chalk.blue("\nAvailable Networks:"));
    console.log(chalk.gray("─".repeat(50)));
    for (const [key, net] of Object.entries(networks)) {
      console.log(`  ${chalk.green(key.padEnd(20))} ${net.name} (Chain ID: ${net.chainId})`);
    }
  });

program.parse();
