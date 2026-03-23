# Publishing Guide

This document explains how to publish this Move package to Sui networks and how to resolve common issues.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Publishing to Testnet](#publishing-to-testnet)
- [Common Errors & Solutions](#common-errors--solutions)
  - [PublishUpgradeMissingDependency](#publishupgrademissingdependency)

---

## Prerequisites

1. Install the Sui CLI: https://docs.sui.io/build/install
2. Configure your environment for testnet:
   ```bash
   sui client switch --env testnet
   ```
3. Ensure you have testnet SUI tokens for gas fees (get from https://faucet.sui.io/)

---

## Publishing to Testnet

### Step 1: Build the package

```bash
sui move build
```

### Step 2: Publish

```bash
sui client publish --skip-dependency-verification
```

**Note:** The `--skip-dependency-verification` flag may be needed if you have on-chain dependencies that don't match the local source exactly.

---

## Common Errors & Solutions

### PublishUpgradeMissingDependency

**Error Message:**
```
Error executing transaction '...': PublishUpgradeMissingDependency in command 0
```

**Cause:**
This error occurs when you try to publish a package that depends on another package, but the dependency is specified as a **local path** rather than an **on-chain address**. Sui requires all dependencies to be already published on-chain when you publish.

**Example problematic `Move.toml`:**
```toml
[dependencies]
enclave = { local = "../enclave" }  # ❌ Local path won't work for publishing
Sui = { git = "https://github.com/MystenLabs/sui.git", ... }
```

**Solution:**

1. **Find the published package address**
   
   Check the dependency's `Published.toml` file for the testnet address:
   ```bash
   cat ../enclave/Published.toml
   ```
   
   Output example:
   ```toml
   [published.testnet]
   chain-id = "4c78adac"
   published-at = "0xe3317997d10fd03ed8fc7eab44b2b25be3bef37b2519c6e6beb81e078e0a68db"
   ```

2. **Update your `Move.toml`**
   
   Change the dependency from a local path to the on-chain address:
   
   ```toml
   [dependencies]
   # For testnet
   enclave = { r.testnet = "0xe3317997d10fd03ed8fc7eab44b2b25be3bef37b2519c6e6beb81e078e0a68db" }
   
   # For mainnet (when ready)
   # enclave = { r.mainnet = "0x..." }
   
   Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework/", rev = "mainnet-v1.48.4" }
   ```

3. **Rebuild and publish**
   
   ```bash
   sui move build
   sui client publish --skip-dependency-verification
   ```

**Key Points:**

| Dependency Type | Use For | Example |
|----------------|---------|---------|
| Local path (`local = "..."`) | Local development, testing | `enclave = { local = "../enclave" }` |
| On-chain address (`r.testnet`, `r.mainnet`) | Publishing to network | `enclave = { r.testnet = "0x..." }` |

---

## After Publishing

Once published, update your `Published.toml` or create one to track the deployed addresses:

```toml
[published.testnet]
chain-id = "4c78adac"
published-at = "0x..."
original-id = "0x..."
version = 1
```

This helps you and others know where the package is deployed on each network.
