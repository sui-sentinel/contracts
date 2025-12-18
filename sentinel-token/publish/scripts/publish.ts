import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { bcs } from '@mysten/sui/bcs';
import { deriveDynamicFieldID } from '@mysten/sui/utils';
import { PublishSingleton } from '../src/publish';


let client = new SuiClient({ url: getFullnodeUrl('testnet') });

const instance = await PublishSingleton.publish(client);

console.log('Package ID:', PublishSingleton.packageId());
