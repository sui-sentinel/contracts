import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { ADMIN_KEYPAIR } from '../src/consts';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

type Network = 'testnet' | 'devnet' | 'mainnet';

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, 'script.config.json');

type ScriptConfigFile = {
    PCR0: string;
    PCR1: string;
    PCR2: string;
    ENCLAVE_URL: string;
    MODULE_NAME: string;
    OTW_NAME: string;
    ENCLAVE_PACKAGE_ID: string;
    CAP_OBJECT_ID: string;
    ENCLAVE_CONFIG_OBJECT_ID: string;
    APP_PACKAGE_ID: string;
    AGENT_REGISTRY: string;
    PROTOCOL_CONFIG_ID: string;
    ENCLAVE_OBJECT_ID: string;
    CLOCK_OBJECT_ID: string;
    GAS_BUDGET: number;
};

function loadConfigFile(configPath: string): ScriptConfigFile {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ScriptConfigFile;
}

function usage() {
    console.log(`
Usage: ts-node scripts/script.ts <command> [options]

Commands:
  update-pcrs
  register-enclave
  set-canonical-enclave
  print-config

Common options:
  --network <testnet|devnet|mainnet>   (default: testnet)
  --gas-budget <number>               (default: from config file)
  --config <path>                     (default: ${DEFAULT_CONFIG_PATH})

Config options (override defaults or env vars):
  --pcr0 <hex> --pcr1 <hex> --pcr2 <hex>
  --enclave-url <url>
  --module-name <name> --otw-name <name>
  --enclave-package-id <id>
  --app-package-id <id>
  --cap-object-id <id>
  --enclave-config-object-id <id>
  --protocol-config-id <id>
  --enclave-object-id <id>
  --clock-object-id <id>
  --attestation-hex <hex>             (register-enclave only)
`);
}

function normalizeHex(raw: string): string {
    const trimmed = raw.trim();
    const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
        throw new Error(`Invalid hex string: ${raw}`);
    }
    return hex.toLowerCase();
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function normalizeObjectId(raw: string): string {
    const trimmed = raw.trim();
    return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

function getConfig(values: Record<string, unknown>) {
    const configPath = (values.config as string | undefined) ?? DEFAULT_CONFIG_PATH;
    const fileConfig = loadConfigFile(configPath);
    return {
        network: (values.network ?? process.env.NETWORK ?? 'testnet') as Network,
        pcr0: (values.pcr0 ?? process.env.PCR0 ?? fileConfig.PCR0) as string,
        pcr1: (values.pcr1 ?? process.env.PCR1 ?? fileConfig.PCR1) as string,
        pcr2: (values.pcr2 ?? process.env.PCR2 ?? fileConfig.PCR2) as string,
        enclaveUrl: (values['enclave-url'] ?? process.env.ENCLAVE_URL ?? fileConfig.ENCLAVE_URL) as string,
        moduleName: (values['module-name'] ?? process.env.MODULE_NAME ?? fileConfig.MODULE_NAME) as string,
        otwName: (values['otw-name'] ?? process.env.OTW_NAME ?? fileConfig.OTW_NAME) as string,
        enclavePackageId: normalizeObjectId(
            (values['enclave-package-id'] ?? process.env.ENCLAVE_PACKAGE_ID ?? fileConfig.ENCLAVE_PACKAGE_ID) as string,
        ),
        appPackageId: normalizeObjectId(
            (values['app-package-id'] ?? process.env.APP_PACKAGE_ID ?? fileConfig.APP_PACKAGE_ID) as string,
        ),
        capObjectId: normalizeObjectId(
            (values['cap-object-id'] ?? process.env.CAP_OBJECT_ID ?? fileConfig.CAP_OBJECT_ID) as string,
        ),
        enclaveConfigObjectId: normalizeObjectId(
            (values['enclave-config-object-id'] ?? process.env.ENCLAVE_CONFIG_OBJECT_ID ?? fileConfig.ENCLAVE_CONFIG_OBJECT_ID) as string,
        ),
        protocolConfigId: normalizeObjectId(
            (values['protocol-config-id'] ?? process.env.PROTOCOL_CONFIG_ID ?? fileConfig.PROTOCOL_CONFIG_ID) as string,
        ),
        enclaveObjectId: normalizeObjectId(
            (values['enclave-object-id'] ?? process.env.ENCLAVE_OBJECT_ID ?? fileConfig.ENCLAVE_OBJECT_ID) as string,
        ),
        clockObjectId: normalizeObjectId(
            (values['clock-object-id'] ?? process.env.CLOCK_OBJECT_ID ?? fileConfig.CLOCK_OBJECT_ID) as string,
        ),
        gasBudget: Number(values['gas-budget'] ?? process.env.GAS_BUDGET ?? fileConfig.GAS_BUDGET),
        attestationHex: values['attestation-hex'] as string | undefined,
    };
}

async function getClient(network: Network) {
    return new SuiClient({ url: getFullnodeUrl(network) });
}

async function executeTransaction(client: SuiClient, transaction: Transaction) {
    return client.signAndExecuteTransaction({
        transaction,
        signer: ADMIN_KEYPAIR,
        options: {
            showObjectChanges: true,
            showEffects: true,
        },
    });
}

async function updatePcrs(config: ReturnType<typeof getConfig>) {
    const tx = new Transaction();
    tx.setGasBudget(config.gasBudget);

    tx.moveCall({
        target: `${config.enclavePackageId}::enclave::update_pcrs`,
        typeArguments: [`${config.appPackageId}::${config.moduleName}::${config.otwName}`],
        arguments: [
            tx.object(config.enclaveConfigObjectId),
            tx.object(config.capObjectId),
            tx.pure.vector('u8', hexToBytes(normalizeHex(config.pcr0))),
            tx.pure.vector('u8', hexToBytes(normalizeHex(config.pcr1))),
            tx.pure.vector('u8', hexToBytes(normalizeHex(config.pcr2))),
        ],
    });

    const client = await getClient(config.network);
    const resp = await executeTransaction(client, tx);
    console.log(JSON.stringify(resp, null, 2));
}

async function registerEnclave(config: ReturnType<typeof getConfig>) {
    const attestationHex =
        config.attestationHex ??
        (await (async () => {
            const url = new URL('/get_attestation', config.enclaveUrl);
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`Failed to fetch attestation: ${resp.status} ${resp.statusText}`);
            }
            const payload = (await resp.json()) as { attestation?: string };
            if (!payload.attestation) {
                throw new Error('Attestation missing in response payload.');
            }
            return payload.attestation;
        })());

    const tx = new Transaction();
    tx.setGasBudget(config.gasBudget);

    const attestationBytes = hexToBytes(normalizeHex(attestationHex));
    const attestationArg = tx.pure.vector('u8', attestationBytes);
    const nitroAttestation = tx.moveCall({
        target: '0x2::nitro_attestation::load_nitro_attestation',
        arguments: [attestationArg, tx.object(config.clockObjectId)],
    });

    tx.moveCall({
        target: `${config.enclavePackageId}::enclave::register_enclave`,
        typeArguments: [`${config.appPackageId}::${config.moduleName}::${config.otwName}`],
        arguments: [tx.object(config.enclaveConfigObjectId), nitroAttestation],
    });

    const client = await getClient(config.network);
    const resp = await executeTransaction(client, tx);
    console.log(JSON.stringify(resp, null, 2));
}

async function setCanonicalEnclave(config: ReturnType<typeof getConfig>) {
    const tx = new Transaction();
    tx.setGasBudget(config.gasBudget);

    tx.moveCall({
        target: `${config.appPackageId}::sentinel::set_canonical_enclave`,
        arguments: [
            tx.object(config.protocolConfigId),
            tx.object(config.enclaveObjectId),
            tx.object(config.clockObjectId),
        ],
    });

    const client = await getClient(config.network);
    const resp = await executeTransaction(client, tx);
    console.log(JSON.stringify(resp, null, 2));
}

function printConfig(config: ReturnType<typeof getConfig>) {
    console.log(JSON.stringify(config, null, 2));
}

async function main() {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            network: { type: 'string' },
            'gas-budget': { type: 'string' },
            pcr0: { type: 'string' },
            pcr1: { type: 'string' },
            pcr2: { type: 'string' },
            'enclave-url': { type: 'string' },
            'module-name': { type: 'string' },
            'otw-name': { type: 'string' },
            'enclave-package-id': { type: 'string' },
            'app-package-id': { type: 'string' },
            'cap-object-id': { type: 'string' },
            'enclave-config-object-id': { type: 'string' },
            'protocol-config-id': { type: 'string' },
            'enclave-object-id': { type: 'string' },
            'clock-object-id': { type: 'string' },
            'attestation-hex': { type: 'string' },
            config: { type: 'string' },
            help: { type: 'boolean' },
        },
    });

    const command = positionals[0];
    if (!command || values.help) {
        usage();
        process.exit(command ? 0 : 1);
    }

    const config = getConfig(values);

    switch (command) {
        case 'update-pcrs':
            await updatePcrs(config);
            break;
        case 'register-enclave':
            await registerEnclave(config);
            break;
        case 'set-canonical-enclave':
            await setCanonicalEnclave(config);
            break;
        case 'print-config':
            printConfig(config);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            usage();
            process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
