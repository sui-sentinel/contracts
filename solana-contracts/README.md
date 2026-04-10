# Sui Sentinel - Solana Contracts

Anchor-based Solana smart contracts for the Sui Sentinel protocol.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (v0.30+)
- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (for running scripts)

## Project Structure

```
├── programs/
│   └── sui-sentinel/
│       └── src/
│           ├── lib.rs           # Main program entry point
│           ├── state.rs         # Account structures
│           ├── errors.rs        # Custom error types
│           ├── events.rs        # Event definitions
│           └── instructions/    # Instruction handlers
├── tests/                       # Integration tests
├── scripts/                     # CLI utilities
└── Anchor.toml                  # Anchor configuration
```

## Setup

```bash
# Install dependencies
bun install

# Build the program
anchor build
```

## Deployment

### Localnet Deployment

```bash
# Start local validator (in a separate terminal)
solana-test-validator

# Configure CLI for localnet
solana config set --url localhost

# Deploy
anchor deploy
```

### Devnet Deployment

```bash
# Configure CLI for devnet
solana config set --url devnet

# Ensure you have devnet SOL
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet
```

---

## Redeployment Guide

When you make changes to the contract code and want to redeploy, you have **two options**:

### Option 1: Upgrade Existing Program (Recommended)

Use this when you want to **keep the same program ID** and preserve existing accounts/state. This is the most common approach for bug fixes and feature additions.

```bash
# 1. Build the updated program
anchor build

# 2. For localnet - simply redeploy (replaces the existing program)
anchor deploy

# 3. For devnet/mainnet - use the upgrade command
anchor upgrade target/deploy/sui_sentinel.so --program-id <PROGRAM_ID>
```

**When to use upgrade:**

- Bug fixes
- Adding new instructions
- Non-breaking changes to existing functionality
- You want existing PDAs and accounts to continue working

**Important Notes:**

- The upgrade authority must be the same wallet that originally deployed the program. Check with:
  ```bash
  solana program show <PROGRAM_ID>
  ```
- **You do NOT need to re-initialize** after an upgrade. All existing PDA accounts (protocol_config, agents, attacks, etc.) persist with their data intact. Only the executable code changes.

### Option 2: Fresh Deployment (New Program ID)

Use this when you need a **completely new program instance**. This creates new accounts and PDAs.

```bash
# 1. Generate a new program keypair
solana-keygen new -o target/deploy/sui_sentinel-keypair.json --force

# 2. Get the new program ID
solana address -k target/deploy/sui_sentinel-keypair.json
# Example output: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

# 3. Update the program ID in lib.rs
# Change: declare_id!("OLD_PROGRAM_ID");
# To:     declare_id!("NEW_PROGRAM_ID");

# 4. Update Anchor.toml with the new program ID
# Under [programs.localnet] or [programs.devnet]:
# sui_sentinel = "NEW_PROGRAM_ID"

# 5. Rebuild with the new ID
anchor build

# 6. Deploy the fresh program
anchor deploy
```

**When to use fresh deployment:**

- Breaking changes to account structures (adding/removing fields)
- Complete protocol reset needed
- Testing a new version alongside the old one
- Deploying to a network where the program doesn't exist yet

### Quick Reference: Program IDs

| Network  | Program ID                                     |
| -------- | ---------------------------------------------- |
| Localnet | `2pdFb495RGrbwiRJdin7aRmfsX4puTnoQGb7Rdd7sGDS` |
| Devnet   | `B7jZYvzq9jdWw3ReWLs4d5SSoqYZ5yKnjAkzSpStAmZe` |
| Mainnet  | `B7jZYvzq9jdWw3ReWLs4d5SSoqYZ5yKnjAkzSpStAmZe` |

### Sync Program ID Helper

If you need to sync `declare_id!` with `Anchor.toml`:

```bash
# Extract program ID from keypair and update source files
anchor keys sync
```

---

## Testing

```bash
# Run all tests
anchor test

# Run tests without redeploying (faster for iterative testing)
anchor test --skip-deploy

# Run specific test file
bun run ts-mocha -p ./tsconfig.json -t 1000000 tests/specific-test.ts
```

## CLI Scripts

The project includes CLI utilities in `scripts/cli.ts`:

```bash
# Run CLI commands
bun run scripts/cli.ts <command>
```

## Common Issues

### "Program account already exists"

This means the program ID already has a deployed program. Either:

- Use `anchor upgrade` to update the existing program
- Generate a new keypair for a fresh deployment

### "Incorrect program id for instruction"

The `declare_id!` in your code doesn't match the actual deployed program ID. Ensure:

1. `lib.rs` has the correct `declare_id!`
2. `Anchor.toml` has matching program IDs
3. Run `anchor build` after any ID changes

### "Invalid program authority"

You're trying to upgrade a program with a different wallet than the original deployer. Use the original upgrade authority wallet.

---

## Environment Configuration

The `Anchor.toml` file controls deployment configuration:

```toml
[provider]
cluster = "localnet"           # Current target cluster
wallet = "~/.config/solana/id.json"  # Wallet keypair path

[programs.localnet]
sui_sentinel = "PROGRAM_ID"    # Localnet program ID

[programs.devnet]
sui_sentinel = "PROGRAM_ID"    # Devnet program ID
```

Switch clusters by changing the `cluster` value or using:

```bash
anchor deploy --provider.cluster devnet
```

---

## Reference

**SOL Token Mint Address:** `So11111111111111111111111111111111111111112`

Solana Explorer

```
https://solscan.io/tx/2xsanTPTuJNgnHLnqukTpMeWc4vKBWnrFgeSdEiZuRRGFouZqzYcfSPdiezYNxCuf8RhzEa7cU4WXqheDCAn6w36?cluster=devnet
```

```
Attack PDA: Eraf1s7TPatwmDMvoy7UfHoPtxmRZRPfFSRPczF6T25c
Nonce: 1775804398440
Amount Paid: 1234
```

Token Account Address: 7WtdMsiGTtiA2HjmWr9RBv2RB67Xy2wLyzpwFUVhiNyx
