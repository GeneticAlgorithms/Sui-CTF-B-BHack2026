import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import { recordFlag, getFlagObjectIdFromResult } from "./record-flag.ts";

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const CTF_PACKAGE_ID = '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03';
const CLOCK_OBJECT_ID = '0x6';
const MIN_STAKE_MIST = 1_000_000_000n; // 1 SUI
const STAKING_POOL_ID = process.env.STAKING_POOL_ID ?? '';
const STAKE_RECEIPT_TYPE = `${CTF_PACKAGE_ID}::staking::StakeReceipt`;

(async () => {
	if (!STAKING_POOL_ID) {
		console.log('Set STAKING_POOL_ID (shared StakingPool). Find it from the package deploy tx on Sui Explorer.');
		return;
	}

	const sender = keypair.getPublicKey().toSuiAddress();
	const { data: receipts } = await suiClient.listOwnedObjects({
		owner: sender,
		type: STAKE_RECEIPT_TYPE,
	});

	if (receipts?.length) {
		// We have a receipt: update it to accrue time, then claim if eligible
		const receiptId = receipts[0].objectId;
		const tx = new Transaction();
		const updated = tx.moveCall({
			target: `${CTF_PACKAGE_ID}::staking::update_receipt`,
			arguments: [tx.object(receiptId), tx.object(CLOCK_OBJECT_ID)],
		});
		tx.moveCall({
			target: `${CTF_PACKAGE_ID}::staking::claim_flag`,
			arguments: [tx.object(STAKING_POOL_ID), updated, tx.object(CLOCK_OBJECT_ID)],
		});
		try {
			const result = await suiClient.signAndExecuteTransaction({
				signer: keypair,
				transaction: tx,
				include: { effects: true, objectTypes: true },
			});
			if (result.result?.effects?.status?.status === 'success') {
				const digest = result.result.digest;
				console.log('Flag claimed. Digest:', digest);
				const flagId = getFlagObjectIdFromResult(result);
				if (digest && flagId) {
					recordFlag('staking', digest, flagId);
					console.log('Flag ID saved to FLAGS/:', flagId);
				}
				return;
			}
		} catch (e) {
			console.log('Claim failed (need 168+ hours staked). Error:', (e as Error).message);
		}
	}

	// No receipt or claim failed: stake 1 SUI
	const txStake = new Transaction();
	const [coin] = txStake.splitCoins(txStake.gas, [MIN_STAKE_MIST]);
	txStake.moveCall({
		target: `${CTF_PACKAGE_ID}::staking::stake`,
		arguments: [txStake.object(STAKING_POOL_ID), coin, txStake.object(CLOCK_OBJECT_ID)],
	});
	const stakeResult = await suiClient.signAndExecuteTransaction({
		signer: keypair,
		transaction: txStake,
	});
	if (stakeResult.result?.effects?.status?.status !== 'success') {
		console.log('Stake failed:', stakeResult.result?.effects?.status);
		return;
	}
	const created = stakeResult.result?.effects?.created;
	const receiptId = created?.find((r: { reference?: { objectId?: string } }) => r.reference?.objectId)?.reference?.objectId;
	console.log('Staked. Receipt:', receiptId ?? 'check effects');
	console.log('Wait 168 hours (1 week), then run: pnpm staking');
})();
