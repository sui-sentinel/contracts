import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { deriveDynamicFieldID } from '@mysten/sui/utils';
import { PublishSingleton } from './publish';

describe("Publish package", () => {
    let client: SuiClient;

    beforeAll(async () => {
        client = new SuiClient({ url: getFullnodeUrl('localnet') });
        await PublishSingleton.publish(client);
    });

    it("Publishes package", () => {
        let resp = PublishSingleton.publishResponse();
        expect(resp.effects?.status.status).toBe('success');
    });

    it("Freezer has TreasuryCap", async () => {
        const packageId = PublishSingleton.packageId();
        const freezer = PublishSingleton.freezer();
        if (!freezer) {
            throw new Error("Expected Freezer object-change");
        }
        expect(freezer.owner).toBe('Immutable');
        const tCap = PublishSingleton.treasuryCap();
        if (!tCap) {
            throw new Error("Expected TreasuryCap object-change");
        }
        if (typeof tCap.owner !== 'object' || !('ObjectOwner' in tCap.owner)) {
            throw new Error("Expected TreasuryCap to have an object-owner");
        }
        const tcapKeyType = `${packageId}::silver::TreasuryCapKey`;
        const dofType = `0x2::dynamic_object_field::Wrapper<${tcapKeyType}>`;
        const dofName = bcs.struct(dofType, {
            name: bcs.struct(tcapKeyType, { dummy_field: bcs.bool() })
        }).serialize({ name: { dummy_field: false } }).toBytes();
        const dynamicFieldId = deriveDynamicFieldID(freezer.objectId, dofType, dofName);
        expect(tCap.owner.ObjectOwner).toBe(dynamicFieldId);
    });

    it("Package is not upgradable", () => {
        let resp = PublishSingleton.publishResponse();
        let upgradeCap = resp.objectChanges?.find((chng) =>
            chng.type === 'created' && chng.objectType.endsWith('2::package::UpgradeCap')
        );
        expect(upgradeCap).toBeUndefined();
    });
});
