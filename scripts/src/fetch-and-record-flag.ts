import { SuiGrpcClient } from '@mysten/sui/grpc';
import { recordFlag, getFlagObjectIdFromResult } from './record-flag.ts';

const suiClient = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const digest = process.argv[2];
const challenge = process.argv[3] ?? 'merchant';

if (!digest) {
  console.log('Usage: tsx src/fetch-and-record-flag.ts <tx_digest> [challenge_name]');
  process.exit(1);
}

const response = await suiClient.getTransaction({
  digest,
  include: { effects: true, objectTypes: true },
});
const tx = (response as { Transaction?: unknown }).Transaction ?? response;
const result = { $kind: 'Transaction' as const, Transaction: tx };
const flagId = getFlagObjectIdFromResult(result);
if (flagId) {
  recordFlag(challenge, digest, flagId);
  console.log('Recorded flag:', flagId);
} else {
  const list = (tx as any).effects?.changedObjects;
  if (list?.length) {
    list.forEach((o: any, i: number) => console.log(`change ${i}:`, { objectId: o.objectId, idOperation: o.idOperation, outputState: o.outputState }));
  }
  console.log('objectTypes:', (tx as any).objectTypes);
}
