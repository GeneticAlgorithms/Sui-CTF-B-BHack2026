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

/** Window is open when (within each hour): 0–5 min OR 30–35 min (in seconds: [0,300) or [1800,2100)) */
function isInWindowSeconds(timeInHourSec: number): boolean {
	return (timeInHourSec >= 0 && timeInHourSec < 300) || (timeInHourSec >= 1800 && timeInHourSec < 2100);
}

/** Approximate: are we in the moving window based on local time? (chain time may differ slightly) */
function isInWindowLocal(): boolean {
	const now = Math.floor(Date.now() / 1000);
	const timeInHour = now % 3600;
	return isInWindowSeconds(timeInHour);
}

/** Seconds until next open window (0 if currently in window) */
function secondsUntilNextWindow(): number {
	const now = Math.floor(Date.now() / 1000);
	const timeInHour = now % 3600;
	if (isInWindowSeconds(timeInHour)) return 0;
	if (timeInHour < 1800) return 1800 - timeInHour; // wait until 30:00
	return 3600 - timeInHour; // wait until next hour
}

(async () => {
	console.log('Moving Window challenge: extract flag when the window is open.');
	console.log('Window is open at 0–5 min and 30–35 min of every hour (UTC).\n');

	// Wait until we're in (or near) a window so we don't spam failed txns
	const waitSec = secondsUntilNextWindow();
	if (waitSec > 0) {
		const waitMs = Math.min(waitSec, 600) * 1000; // wait up to 10 min
		console.log(`Not in window. Waiting ${Math.round(waitMs / 1000)}s until next window...`);
		await new Promise((r) => setTimeout(r, waitMs));
	}

	const sender = keypair.getPublicKey().toSuiAddress();
	const tx = new Transaction();
	const flag = tx.moveCall({
		target: `${CTF_PACKAGE_ID}::moving_window::extract_flag`,
		arguments: [tx.object(CLOCK_OBJECT_ID)],
	});
	tx.transferObjects([flag], tx.pure.address(sender));

	try {
		const result = await suiClient.signAndExecuteTransaction({
			signer: keypair,
			transaction: tx,
			include: { effects: true, objectTypes: true },
		});
		const txData = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
		const digest = txData?.digest;
		if (result.$kind === "Transaction" && digest) {
			console.log("Success! Flag extracted.");
			console.log("Digest:", digest);
			const flagId = getFlagObjectIdFromResult(result);
			if (flagId) {
				recordFlag("moving_window", digest, flagId);
				console.log("Flag ID saved to FLAGS/:", flagId);
			}
		} else {
			console.log("Transaction failed (window may be closed):", txData?.effects ?? result);
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('EWindowClosed') || msg.includes('Window') || msg.includes('abort')) {
			console.log('Window was closed. Run again during 0–5 min or 30–35 min of any hour (UTC).');
		} else {
			console.error(e);
		}
	}
})();
