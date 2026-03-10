import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { ADMIN_KEYPAIR } from '../src/consts.js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

type Network = 'testnet' | 'devnet' | 'mainnet';

interface CategorizedObjects {
    capObjects: any[];
    enclaveConfigObjects: any[];
    enclaveObjects: any[];
    protocolConfigObjects: any[];
    agentRegistryObjects: any[];
    upgradeCaps: any[];
    coins: any[];
    otherObjects: any[];
    allObjects: any[];
}

interface SaveConfig {
    timestamp: string;
    network: Network;
    adminAddress: string;
    objects: CategorizedObjects;
}

function categorizeObjects(objects: any[]): CategorizedObjects {
    const categorized: CategorizedObjects = {
        capObjects: [],
        enclaveConfigObjects: [],
        enclaveObjects: [],
        protocolConfigObjects: [],
        agentRegistryObjects: [],
        upgradeCaps: [],
        coins: [],
        otherObjects: [],
        allObjects: objects,
    };

    for (const obj of objects) {
        const type = obj.data?.type || obj.data?.objectType || 'unknown';
        const objectId = obj.data?.objectId;
        const version = obj.data?.version;
        const digest = obj.data?.digest;

        const cleanObj = {
            objectId,
            type,
            version,
            digest,
            fullData: obj.data,
        };

        if (type.includes('::enclave::Cap<')) {
            categorized.capObjects.push(cleanObj);
        } else if (type.includes('::enclave::EnclaveConfig<')) {
            categorized.enclaveConfigObjects.push(cleanObj);
        } else if (type.includes('::enclave::Enclave<')) {
            categorized.enclaveObjects.push(cleanObj);
        } else if (type.includes('::sentinel::ProtocolConfig')) {
            categorized.protocolConfigObjects.push(cleanObj);
        } else if (type.includes('::sentinel::AgentRegistry')) {
            categorized.agentRegistryObjects.push(cleanObj);
        } else if (type.includes('::package::UpgradeCap')) {
            categorized.upgradeCaps.push(cleanObj);
        } else if (type.includes('::coin::Coin<')) {
            categorized.coins.push(cleanObj);
        } else {
            categorized.otherObjects.push(cleanObj);
        }
    }

    return categorized;
}

function printSummary(config: SaveConfig) {
    const { objects } = config;
    console.log('\n========== Admin Objects Summary ==========');
    console.log(`Network: ${config.network}`);
    console.log(`Admin Address: ${config.adminAddress}`);
    console.log(`Timestamp: ${config.timestamp}`);
    console.log('');
    console.log(`Total Objects: ${objects.allObjects.length}`);
    console.log(`  - Cap Objects: ${objects.capObjects.length}`);
    console.log(`  - EnclaveConfig Objects: ${objects.enclaveConfigObjects.length}`);
    console.log(`  - Enclave Objects: ${objects.enclaveObjects.length}`);
    console.log(`  - ProtocolConfig Objects: ${objects.protocolConfigObjects.length}`);
    console.log(`  - AgentRegistry Objects: ${objects.agentRegistryObjects.length}`);
    console.log(`  - UpgradeCaps: ${objects.upgradeCaps.length}`);
    console.log(`  - Coins: ${objects.coins.length}`);
    console.log(`  - Other Objects: ${objects.otherObjects.length}`);
    console.log('');

    // Print important objects with their IDs
    if (objects.capObjects.length > 0) {
        console.log('📝 Cap Objects (for updating PCRs):');
        objects.capObjects.forEach((obj, i) => {
            console.log(`  [${i}] Object ID: ${obj.objectId}`);
            console.log(`      Type: ${obj.type}`);
        });
        console.log('');
    }

    if (objects.enclaveConfigObjects.length > 0) {
        console.log('⚙️  EnclaveConfig Objects:');
        objects.enclaveConfigObjects.forEach((obj, i) => {
            console.log(`  [${i}] Object ID: ${obj.objectId}`);
            console.log(`      Type: ${obj.type}`);
        });
        console.log('');
    }

    if (objects.enclaveObjects.length > 0) {
        console.log('🔒 Enclave Objects:');
        objects.enclaveObjects.forEach((obj, i) => {
            console.log(`  [${i}] Object ID: ${obj.objectId}`);
            console.log(`      Type: ${obj.type}`);
        });
        console.log('');
    }

    if (objects.protocolConfigObjects.length > 0) {
        console.log('🛠️  ProtocolConfig Objects:');
        objects.protocolConfigObjects.forEach((obj, i) => {
            console.log(`  [${i}] Object ID: ${obj.objectId}`);
            console.log(`      Type: ${obj.type}`);
        });
        console.log('');
    }

    if (objects.upgradeCaps.length > 0) {
        console.log('📦 UpgradeCaps (for package upgrades):');
        objects.upgradeCaps.forEach((obj, i) => {
            console.log(`  [${i}] Object ID: ${obj.objectId}`);
            const packageId = obj.fullData?.content?.fields?.package;
            if (packageId) {
                console.log(`      Package: ${packageId}`);
            }
        });
        console.log('');
    }

    console.log('===========================================\n');
}

async function main() {
    const { values } = parseArgs({
        allowPositionals: false,
        options: {
            network: { type: 'string', default: 'testnet' },
            output: { type: 'string', default: '' },
            help: { type: 'boolean', default: false },
        },
    });

    if (values.help) {
        console.log(`
Usage: npx ts-node scripts/save_admin_objects.ts [options]

Options:
  --network <testnet|devnet|mainnet>   Network to query (default: testnet)
  --output <path>                      Output JSON file path (default: logs/admin-objects-{network}-{timestamp}.json)
  --help                               Show this help message

Examples:
  npx ts-node scripts/save_admin_objects.ts
  npx ts-node scripts/save_admin_objects.ts --network mainnet
  npx ts-node scripts/save_admin_objects.ts --output ./my-objects.json
`);
        process.exit(0);
    }

    const network = (values.network as Network) || 'testnet';
    const adminAddress = ADMIN_KEYPAIR.getPublicKey().toSuiAddress();

    console.log(`🔍 Querying objects for admin: ${adminAddress}`);
    console.log(`🌐 Network: ${network}`);

    const client = new SuiClient({ url: getFullnodeUrl(network) });

    // Query all objects owned by admin
    console.log('⏳ Fetching objects...');
    const objects = [];
    let cursor: string | null | undefined = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const response = await client.getOwnedObjects({
            owner: adminAddress,
            cursor,
            limit: 50,
            options: {
                showType: true,
                showContent: true,
                showOwner: true,
            },
        });

        objects.push(...response.data);
        hasNextPage = response.hasNextPage;
        cursor = response.nextCursor;
    }

    console.log(`✅ Found ${objects.length} objects`);

    // Categorize objects
    const categorized = categorizeObjects(objects);

    // Prepare save config
    const timestamp = new Date().toISOString();
    const saveConfig: SaveConfig = {
        timestamp,
        network,
        adminAddress,
        objects: categorized,
    };

    // Determine output path
    let outputPath = values.output as string;
    if (!outputPath) {
        const safeTimestamp = timestamp.replace(/[:.]/g, '-');
        outputPath = path.resolve(__dirname, '..', 'logs', `admin-objects-${network}-${safeTimestamp}.json`);
    } else {
        outputPath = path.resolve(outputPath);
    }

    // Ensure logs directory exists
    const logsDir = path.dirname(outputPath);
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Save to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(saveConfig, null, 2));
    console.log(`💾 Saved to: ${outputPath}`);

    // Print summary
    printSummary(saveConfig);
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
