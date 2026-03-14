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
const COOLDOWN_MS = 600_000; // 10 min between build/attack
const SHIELD_THRESHOLD = 12;

// Get from Sui Explorer: package 0x9363..., find shared Arena object from deploy tx.
const ARENA_ID = process.env.ARENA_ID ?? '0x7cf2ab748619f5f8e25a002aa2c60a85b7a6f61220f011358a32cb11c797a923';

(async () => {
	if (!ARENA_ID) {
		console.log('Set ARENA_ID (shared Arena object). Find it from the package deploy tx on Sui Explorer.');
		return;
	}

	const sender = keypair.getPublicKey().toSuiAddress();

	// 1) Register if not already
	const txReg = new Transaction();
	txReg.moveCall({
		target: `${CTF_PACKAGE_ID}::sabotage_arena::register`,
		arguments: [txReg.object(ARENA_ID), txReg.object(CLOCK_OBJECT_ID)],
	});
	try {
		await suiClient.signAndExecuteTransaction({ signer: keypair, transaction: txReg });
		console.log('Registered.');
	} catch (e) {
		// EAlreadyRegistered is ok
	}

	// 2) Build shield to threshold (12), respecting 10 min cooldown
	for (let i = 0; i < SHIELD_THRESHOLD; i++) {
		const tx = new Transaction();
		tx.moveCall({
			target: `${CTF_PACKAGE_ID}::sabotage_arena::build`,
			arguments: [tx.object(ARENA_ID), tx.object(CLOCK_OBJECT_ID)],
		});
		try {
			const result = await suiClient.signAndExecuteTransaction({ signer: keypair, transaction: tx });
			if (result.$kind === "Transaction") {
				console.log(`Build ${i + 1}/${SHIELD_THRESHOLD} ok.`);
			}
		} catch (e) {
			console.log(`Build ${i + 1} failed (cooldown?):`, (e as Error).message);
			console.log(`Wait ${COOLDOWN_MS / 60000} min and run again to continue.`);
			return;
		}
		if (i < SHIELD_THRESHOLD - 1) {
			console.log(`Waiting ${COOLDOWN_MS / 1000}s cooldown...`);
			await new Promise((r) => setTimeout(r, COOLDOWN_MS));
		}
	}

	// 3) Claim flag
	const txClaim = new Transaction();
	txClaim.moveCall({
		target: `${CTF_PACKAGE_ID}::sabotage_arena::claim_flag`,
		arguments: [txClaim.object(ARENA_ID), txClaim.object(CLOCK_OBJECT_ID)],
	});
	const result = await suiClient.signAndExecuteTransaction({
		signer: keypair,
		transaction: txClaim,
		include: { effects: true, objectTypes: true },
	});
	if (result.$kind === "Transaction") {
		const digest = result.Transaction.digest;
		console.log("Flag claimed. Digest:", digest);
		const flagId = getFlagObjectIdFromResult(result);
		if (digest && flagId) {
			recordFlag("sabotage_arena", digest, flagId);
			console.log("Flag ID saved to FLAGS/:", flagId);
		}
	} else {
		console.log("Claim failed:", result.FailedTransaction?.effects);
	}
})();
