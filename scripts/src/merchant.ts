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
const COST_PER_FLAG = 3_849_000n; // from merchant.move

// Circle native USDC on Sui testnet (update if CTF uses a different USDC package)
const USDC_COIN_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';

(async () => {
	const sender = keypair.getPublicKey().toSuiAddress();
	const { objects: coins } = await suiClient.listCoins({
		owner: sender,
		coinType: USDC_COIN_TYPE,
	});

	if (!coins?.length) {
		console.log('No USDC found. Get testnet USDC from a faucet (e.g. Sui / Circle testnet docs).');
		return;
	}

	const total = coins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
	if (total < COST_PER_FLAG) {
		console.log(`Need at least ${COST_PER_FLAG} USDC (6 decimals). You have ${total}.`);
		return;
	}

	// Prefer a coin with exact amount; otherwise use the first coin with enough balance
	const exactCoin = coins.find((c) => BigInt(c.balance) === COST_PER_FLAG);
	const coinToUse = exactCoin ?? coins.find((c) => BigInt(c.balance) >= COST_PER_FLAG);
	if (!coinToUse) return;
	const coinId = coinToUse.objectId;

	const tx = new Transaction();

	let paymentArg: ReturnType<Transaction['object']> | ReturnType<Transaction['splitCoins']>[number];
	if (BigInt(coinToUse.balance) === COST_PER_FLAG) {
		paymentArg = tx.object(coinId);
	} else {
		const [splitCoin] = tx.splitCoins(tx.object(coinId), [COST_PER_FLAG]);
		paymentArg = splitCoin;
	}

	const flag = tx.moveCall({
		target: `${CTF_PACKAGE_ID}::merchant::buy_flag`,
		arguments: [paymentArg],
	});
	tx.transferObjects([flag], tx.pure.address(sender));

	const result = await suiClient.signAndExecuteTransaction({
		signer: keypair,
		transaction: tx,
		include: { effects: true, objectTypes: true },
	});
	const txData = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
	const digest = txData?.digest;
	console.log("Result:", digest ?? result);
	if (result.$kind === "Transaction" && digest) {
		const flagId = getFlagObjectIdFromResult(result);
		if (flagId) {
			recordFlag("merchant", digest, flagId);
			console.log("Flag ID saved to FLAGS/:", flagId);
		}
	}
})();
