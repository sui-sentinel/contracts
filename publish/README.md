# PCR Update Guide

This document describes the steps to update PCR (Platform Configuration Register) values when your AWS Nitro Enclave is modified or redeployed.

## Overview

PCRs are cryptographic measurements of the enclave's state:
- **PCR0**: Enclave image file
- **PCR1**: Enclave kernel
- **PCR2**: Enclave application

When you rebuild or redeploy your enclave, these values change and must be updated on-chain for the protocol to recognize and trust the new enclave.

## Prerequisites

Before starting, ensure you have:
1. Sui CLI installed and configured
2. Admin private key set in your `.env` file
3. Access to the enclave's `/get_attestation` endpoint
4. The `Cap` object ID for your deployed contracts

## Step-by-Step PCR Update Process

### Step 1: Get New PCR Values from Enclave

Query your running enclave to get the new attestation document containing updated PCR values:

```bash
curl -s http://<YOUR_ENCLAVE_URL>/get_attestation | jq -r '.attestation'
```

To extract PCR values from the attestation, you can use AWS nitro-cli or parse the attestation document.

### Step 2: Update Configuration File

Update the PCR values in the network-specific config file:

**For Testnet** (`scripts/testnet.config.json`):
```json
{
  "PCR0": "<NEW_PCR0_VALUE>",
  "PCR1": "<NEW_PCR1_VALUE>",
  "PCR2": "<NEW_PCR2_VALUE>",
  ...
}
```

**For Mainnet** (`scripts/mainnet.config.json`):
```json
{
  "PCR0": "<NEW_PCR0_VALUE>",
  "PCR1": "<NEW_PCR1_VALUE>",
  "PCR2": "<NEW_PCR2_VALUE>",
  ...
}
```

### Step 3: Update PCRs On-Chain

Use the `script.ts` to update PCR values:

```bash
bun run scripts/script.ts update-pcrs --network testnet
```

Or for mainnet:
```bash
bun run scripts/script.ts update-pcrs --network mainnet
```

You can also override PCR values via command line:
```bash
bun run scripts/script.ts update-pcrs \
  --network testnet \
  --pcr0 <NEW_PCR0> \
  --pcr1 <NEW_PCR1> \
  --pcr2 <NEW_PCR2>
```

> **Note**: The config version will automatically increment when PCRs are updated.

### Step 4: Verify PCR Update

Verify the update was successful:

```bash
# Print current config to verify values
bun run scripts/script.ts print-config --network testnet

# Or query the EnclaveConfig object directly
sui client object <ENCLAVE_CONFIG_OBJECT_ID> --json | jq '.content.fields'
```

Confirm:
- `pcrs` field contains the new values
- `version` has been incremented

### Step 5: Register New Enclave Instance

After updating PCRs, you must register a new enclave instance with the updated config:

```bash
bun run scripts/script.ts register-enclave --network testnet
```

This will:
1. Fetch the attestation from the enclave (using `ENCLAVE_URL` from config)
2. Verify the PCRs match the updated config
3. Create a new `Enclave` object

If you already have the attestation hex, you can pass it directly:
```bash
bun run scripts/script.ts register-enclave \
  --network testnet \
  --attestation-hex <ATTESTATION_HEX>
```

**Note the new Enclave Object ID** from the transaction output - you'll need it for the next step.

### Step 6: Set Canonical Enclave (Optional)

If your app requires setting a canonical enclave:

```bash
bun run scripts/script.ts set-canonical-enclave \
  --network testnet \
  --enclave-object-id <NEW_ENCLAVE_OBJECT_ID>
```

Or update the config file first:
```bash
# Update ENCLAVE_OBJECT_ID in testnet.config.json
# Then run:
bun run scripts/script.ts set-canonical-enclave --network testnet
```

### Step 7: Destroy Old Enclave Objects (Optional)

Old enclave objects with previous config versions can be destroyed to clean up:

```bash
sui client call \
  --package <ENCLAVE_PACKAGE_ID> \
  --module enclave \
  --function destroy_old_enclave \
  --type-args "<APP_PACKAGE_ID>::<MODULE_NAME>::<OTW_NAME>" \
  --args \
    <OLD_ENCLAVE_OBJECT_ID> \
    <ENCLAVE_CONFIG_OBJECT_ID> \
  --gas-budget 100000000
```

> **Note**: Only the owner of the enclave object can destroy it.

## Script Commands Reference

| Command | Description |
|---------|-------------|
| `update-pcrs` | Update PCR values in EnclaveConfig using Cap object |
| `register-enclave` | Register a new enclave instance with attestation |
| `set-canonical-enclave` | Set the canonical enclave for the **first time** (only when none exists) |
| `update-canonical-enclave` | **Update** to a new canonical enclave (use after PCR update) |
| `print-config` | Display the current configuration |

### Common Options

| Option | Description |
|--------|-------------|
| `--network <testnet\|devnet\|mainnet>` | Target network (default: testnet) |
| `--config <path>` | Path to config file (default: `<network>.config.json`) |
| `--gas-budget <number>` | Gas budget for transaction |
| `--pcr0`, `--pcr1`, `--pcr2` | Override PCR values |
| `--enclave-url <url>` | Override enclave URL |
| `--enclave-package-id <id>` | Override enclave package ID |
| `--app-package-id <id>` | Override app package ID |
| `--cap-object-id <id>` | Override Cap object ID |
| `--enclave-config-object-id <id>` | Override EnclaveConfig object ID |
| `--protocol-config-id <id>` | Override ProtocolConfig object ID |
| `--enclave-object-id <id>` | Override Enclave object ID |
| `--attestation-hex <hex>` | Pass attestation directly (for register-enclave) |

## Configuration File Format

The `testnet.config.json` and `mainnet.config.json` files contain:

```json
{
  "PCR0": "b8715f9f324b7e608ba265c3b43a2bc95bc93cd9b9129f4ad45edfe7fa548028179fe76e0977e3244a32778badd09690",
  "PCR1": "b8715f9f324b7e608ba265c3b43a2bc95bc93cd9b9129f4ad45edfe7fa548028179fe76e0977e3244a32778badd09690",
  "PCR2": "21b9efbc184807662e966d34f390821309eeac6802309798826296bf3e8bec7c10edb30948c90ba67310f7b964fc500a",
  "ENCLAVE_URL": "http://your-enclave-ip:3000",
  "MODULE_NAME": "sentinel",
  "OTW_NAME": "SENTINEL",
  "ENCLAVE_PACKAGE_ID": "0x...",
  "CAP_OBJECT_ID": "0x...",
  "ENCLAVE_CONFIG_OBJECT_ID": "0x...",
  "APP_PACKAGE_ID": "0x...",
  "AGENT_REGISTRY": "0x...",
  "PROTOCOL_CONFIG_ID": "0x...",
  "ENCLAVE_OBJECT_ID": "0x...",
  "CLOCK_OBJECT_ID": "0x6",
  "GAS_BUDGET": 100000000
}
```

## Important Considerations

### Backward Compatibility

When you update PCRs:
- The `EnclaveConfig` version increments automatically
- Old enclave objects still exist but are considered outdated
- Signatures from old enclaves may fail verification if they check config version

### Rollback Strategy

If you need to rollback to previous PCRs:
1. You cannot revert the config version number
2. You must call `update-pcrs` again with the old PCR values (version will increment again)
3. Re-register enclaves with the rolled-back config

### Security Notes

- Keep your `Cap` object secure - it has the power to update PCRs
- The `Cap` object is transferable - ensure it's stored in a secure address
- Always verify PCR values match your intended enclave build before updating

## Troubleshooting

### "EInvalidCap" Error
The Cap object you're using doesn't match the EnclaveConfig. Verify:
- You're using the correct Cap object ID in the config
- The Cap was created for the correct OTW (One-Time Witness) type

### "EInvalidPCRs" Error
The PCRs in the attestation don't match the EnclaveConfig. Verify:
- You've updated the EnclaveConfig with the new PCRs (Step 3)
- The enclave is running the expected image

### "EInvalidConfigVersion" Error
Trying to destroy an enclave that isn't outdated. Verify:
- The enclave's config version is less than the current config version
- You're using the correct EnclaveConfig object

### Config Loading Issues
If the script can't find your config:
```bash
# Specify config path explicitly
bun run scripts/script.ts update-pcrs --config ./scripts/testnet.config.json
```

## Quick Reference Commands

```bash
# Print current config
bun run scripts/script.ts print-config --network testnet

# Update PCRs
bun run scripts/script.ts update-pcrs --network testnet

# Register new enclave
bun run scripts/script.ts register-enclave --network testnet

# Set canonical enclave
bun run scripts/script.ts set-canonical-enclave --network testnet

# Get enclave attestation manually
curl -s http://<ENCLAVE_URL>/get_attestation | jq -r '.attestation'

# Query enclave config
sui client object <ENCLAVE_CONFIG_OBJECT_ID> --json

# Query enclave object
sui client object <ENCLAVE_OBJECT_ID> --json

# List Cap objects owned by admin
sui client objects --filter "<ENCLAVE_PACKAGE_ID>::enclave::Cap"

# Save admin objects summary
bun run scripts/save_admin_objects.ts --network testnet
```
