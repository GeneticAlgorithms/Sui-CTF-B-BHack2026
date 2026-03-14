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
const STAKING_POOL_ID = process.env.STAKING_POOL_ID ?? '0x9cd5b5fe69a62761859536720b9b07c48a1e43b95d8c291855d9fc6779a3b494';
const STAKE_RECEIPT_TYPE = `${CTF_PACKAGE_ID}::staking::StakeReceipt`;

(async () => {
	if (!STAKING_POOL_ID) {
		console.log('Set STAKING_POOL_ID (shared StakingPool). Find it from the package deploy tx on Sui Explorer.');
		return;
	}

	const sender = keypair.getPublicKey().toSuiAddress();
	const { objects: receipts } = await suiClient.listOwnedObjects({
		owner: sender,
		type: STAKE_RECEIPT_TYPE,
	});

	if (receipts?.length) {
		// Try to claim: use both return values (Flag, Coin) in transferObjects to avoid UnusedValueWithoutDrop.
		const receiptId = receipts[0].objectId;
		const txClaim = new Transaction();
		const [flag, coin] = txClaim.moveCall({
			target: `${CTF_PACKAGE_ID}::staking::claim_flag`,
			arguments: [
				txClaim.object(STAKING_POOL_ID),
				txClaim.object(receiptId),
				txClaim.object(CLOCK_OBJECT_ID),
			],
		});
		txClaim.transferObjects([flag, coin], txClaim.pure.address(sender));
		const claimResult = await suiClient.signAndExecuteTransaction({
			signer: keypair,
			transaction: txClaim,
			include: { effects: true, objectTypes: true },
		});
		if (claimResult.$kind === "Transaction") {
			const digest = (claimResult as { Transaction: { digest?: string } }).Transaction.digest;
			const flagId = getFlagObjectIdFromResult(claimResult);
			if (flagId) {
				recordFlag("staking", digest ?? "", flagId);
				console.log("Staking flag captured:", flagId);
			} else {
				console.log("Claim tx succeeded. Digest:", digest);
			}
		} else {
			const err = (claimResult as { FailedTransaction?: { effects?: unknown } }).FailedTransaction?.effects;
			console.log("Claim failed (maybe <168h staked?). After 168h, run pnpm staking again. Error:", err);
			console.log("Receipt ID:", receiptId);
		}
		return;
	}

	// No receipt: stake 1 SUI (must transfer the returned StakeReceipt to sender)
	const txStake = new Transaction();
	const [coin] = txStake.splitCoins(txStake.gas, [MIN_STAKE_MIST]);
	const receipt = txStake.moveCall({
		target: `${CTF_PACKAGE_ID}::staking::stake`,
		arguments: [txStake.object(STAKING_POOL_ID), coin, txStake.object(CLOCK_OBJECT_ID)],
	});
	txStake.transferObjects([receipt], txStake.pure.address(sender));
	const stakeResult = await suiClient.signAndExecuteTransaction({
		signer: keypair,
		transaction: txStake,
		include: { effects: true },
	});
	if (stakeResult.$kind !== "Transaction") {
		console.log("Stake failed:", stakeResult.FailedTransaction?.effects);
		return;
	}
	const effects = stakeResult.Transaction.effects as { changedObjects?: Array<{ objectId?: string; idOperation?: string }> } | undefined;
	const created = effects?.changedObjects?.find((c) => c.idOperation === "Created");
	const receiptId = created?.objectId;
	console.log('Staked. Receipt:', receiptId ?? 'check effects');
	console.log('Wait 168 hours (1 week), then run: pnpm staking');
})();
