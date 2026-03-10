import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { ADMIN_KEYPAIR } from '../src/consts';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

type Network = 'testnet' | 'devnet' | 'mainnet';

interface UpgradeCapInfo {
    objectId: string;
    type: string;
    version: string;
    digest: string;
    packageId?: string;
    policy?: number;
    fullData: any;
}

interface UpgradeCapConfig {
    timestamp: string;
    network: Network;
    adminAddress: string;
    upgradeCaps: UpgradeCapInfo[];
}

async function fetchUpgradeCaps(client: SuiClient, adminAddress: string): Promise<UpgradeCapInfo[]> {
    console.log('⏳ Fetching all objects owned by admin...');
    const upgradeCaps: UpgradeCapInfo[] = [];
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

        for (const obj of response.data) {
            const type = obj.data?.type || '';

            // Check if it's an UpgradeCap object
            if (type.includes('::package::UpgradeCap')) {
                const objectId = obj.data?.objectId!;
                const version = obj.data?.version!;
                const digest = obj.data?.digest!;

                // Extract package ID from content if available
                const packageId = (obj.data as any)?.content?.fields?.package;
                const policy = (obj.data as any)?.content?.fields?.policy;

                upgradeCaps.push({
                    objectId,
                    type,
                    version,
                    digest,
                    packageId,
                    policy,
                    fullData: obj.data,
                });
            }
        }

        hasNextPage = response.hasNextPage;
        cursor = response.nextCursor;
    }

    return upgradeCaps;
}

function printUpgradeCaps(config: UpgradeCapConfig) {
    console.log('\n========== Upgrade Caps Summary ==========');
    console.log(`Network: ${config.network}`);
    console.log(`Admin Address: ${config.adminAddress}`);
    console.log(`Timestamp: ${config.timestamp}`);
    console.log('');
    console.log(`Total UpgradeCaps Found: ${config.upgradeCaps.length}`);
    console.log('');

    if (config.upgradeCaps.length > 0) {
        console.log('📦 UpgradeCaps (for package upgrades):');
        config.upgradeCaps.forEach((cap, i) => {
            console.log(`\n  [${i}] UpgradeCap`);
            console.log(`      Object ID: ${cap.objectId}`);
            console.log(`      Version: ${cap.version}`);
            if (cap.packageId) {
                console.log(`      Package ID: ${cap.packageId}`);
            }
            if (cap.policy !== undefined) {
                console.log(`      Policy: ${cap.policy}`);
            }
        });
        console.log('');
    } else {
        console.log('⚠️  No UpgradeCaps found for this admin address');
    }

    console.log('\n===========================================\n');
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
Usage: npx ts-node scripts/get_upgrade_caps.ts [options]

Description:
  Fetches all UpgradeCap objects owned by the admin keypair for a specific network
  and saves them to a JSON file in the logs directory.

Options:
  --network <testnet|devnet|mainnet>   Network to query (default: testnet)
  --output <path>                      Output JSON file path (default: logs/upgrade-caps-{network}-{timestamp}.json)
  --help                               Show this help message

Examples:
  npm run upgrade-caps
  npm run upgrade-caps -- --network mainnet
  npm run upgrade-caps -- --network testnet --output ./my-upgrade-caps.json
`);
        process.exit(0);
    }

    const network = (values.network as Network) || 'testnet';
    const adminAddress = ADMIN_KEYPAIR.getPublicKey().toSuiAddress();

    console.log(`🔍 Querying UpgradeCaps for admin: ${adminAddress}`);
    console.log(`🌐 Network: ${network}`);

    const client = new SuiClient({ url: getFullnodeUrl(network) });

    // Fetch upgrade caps
    const upgradeCaps = await fetchUpgradeCaps(client, adminAddress);
    console.log(`✅ Found ${upgradeCaps.length} UpgradeCap(s)`);

    // Prepare save config
    const timestamp = new Date().toISOString();
    const saveConfig: UpgradeCapConfig = {
        timestamp,
        network,
        adminAddress,
        upgradeCaps,
    };

    // Determine output path
    let outputPath = values.output as string;
    if (!outputPath) {
        const safeTimestamp = timestamp.replace(/[:.]/g, '-');
        outputPath = path.resolve(__dirname, '..', 'logs', `upgrade-caps-${network}-${safeTimestamp}.json`);
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
    printUpgradeCaps(saveConfig);
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
