/**
 * One-time setup: derive keypair from your seed phrase and write keypair.json
 * so all CTF scripts use your wallet (e.g. 0xc633...).
 *
 * Run from scripts/:
 *   MNEMONIC="word1 word2 word3 ..." pnpm set-keypair-from-mnemonic
 *
 * Uses default path m/44'/784'/0'/0'/0' (first Sui account).
 * Never commit keypair.json or share your mnemonic.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { writeToFile } from "./helpers.ts";

const mnemonic = process.env.MNEMONIC?.trim();
if (!mnemonic) {
  console.error("Set MNEMONIC (your 12/24 word seed phrase) and run again:");
  console.error('  MNEMONIC="word1 word2 ..." pnpm set-keypair-from-mnemonic');
  process.exit(1);
}

const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
const publicAddress = keypair.getPublicKey().toSuiAddress();
const privateKey = keypair.getSecretKey();

await writeToFile(
  "keypair.json",
  JSON.stringify({ publicAddress, privateKey }, null, 2)
);
console.log("keypair.json updated for address:", publicAddress);
console.log("View: https://suiscan.xyz/testnet/account/" + publicAddress);
