import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { PublishSingleton } from '../src/publish';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import path from 'path';
import fs from 'fs';

type Network = 'testnet' | 'devnet' | 'mainnet';
type Contract = 'app' | 'enclave' | 'sentinel-token';

const NETWORK_OPTIONS: Network[] = ['testnet', 'devnet', 'mainnet'];
const CONTRACT_OPTIONS: Contract[] = ['app', 'enclave', 'sentinel-token'];

function parseChoice<T extends string>(raw: string, options: T[], defaultIndex = 0): T {
    const trimmed = raw.trim();
    if (!trimmed) {
        return options[defaultIndex];
    }
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isInteger(numeric)) {
        const idx = numeric - 1;
        if (idx >= 0 && idx < options.length) {
            return options[idx];
        }
    }
    const match = options.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
    if (match) {
        return match;
    }
    throw new Error(`Invalid choice "${raw}".`);
}

async function promptChoice<T extends string>(question: string, options: T[], defaultIndex = 0): Promise<T> {
    const rl = createInterface({ input, output });
    try {
        while (true) {
            const menu = options
                .map((opt, idx) => `${idx + 1}) ${opt}${idx === defaultIndex ? ' (default)' : ''}`)
                .join('\n');
            const answer = await rl.question(`${question}\n${menu}\n> `);
            try {
                return parseChoice(answer, options, defaultIndex);
            } catch (err) {
                console.error((err as Error).message);
            }
        }
    } finally {
        rl.close();
    }
}

function jsonReplacer(_key: string, value: unknown) {
    return typeof value === 'bigint' ? value.toString() : value;
}

const network = await promptChoice<Network>('Select network', NETWORK_OPTIONS, 0);
const contract = await promptChoice<Contract>('Select contract to deploy', CONTRACT_OPTIONS, 0);

const client = new SuiClient({ url: getFullnodeUrl(network) });
const packagePath = path.resolve(__dirname, '..', '..', contract);

await PublishSingleton.publish(client, undefined, packagePath);

const packageId = PublishSingleton.packageId();
const publishResponse = PublishSingleton.publishResponse();

const logsDir = path.resolve(__dirname, '..', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logsDir, `${timestamp}-${network}-${contract}.json`);

const logPayload = {
    timestamp: new Date().toISOString(),
    network,
    contract,
    packagePath,
    packageId,
    publishResponse,
};

fs.writeFileSync(logPath, JSON.stringify(logPayload, jsonReplacer, 2), 'utf-8');

console.log(`Network: ${network}`);
console.log(`Contract: ${contract}`);
console.log(`Package ID: ${packageId}`);
console.log(`Log file: ${logPath}`);
