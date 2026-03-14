# CTF Flag Object IDs (B@B Hacks 2026)

## How to capture flags and submit on DeepSurge

1. **Run a challenge script** (from `scripts/`):
   - **Moving Window:** `pnpm moving-window` — run during **0–5 min** or **30–35 min** of any hour (UTC).
   - **Merchant:** `pnpm merchant` — need testnet USDC.
   - **Lootboxes:** set `EXPLOIT_PACKAGE_ID`, then `pnpm lootboxes` — need USDC.
   - **Staking:** `pnpm staking` — stakes first; after 168h run again to claim (claim path may need manual PTB).
   - **Sabotage Arena:** `pnpm sabotage-arena` — register then 12 builds (10 min apart).

2. **When a run succeeds**, the script writes the flag here:
   - **captured_flags.txt** — new line: `challenge` `flag_object_id` `tx_digest`
   - **\<challenge\>.txt** — e.g. `moving_window.txt` with the flag object ID and digest.

3. **On DeepSurge (CTF tab):**
   - **CTF GITHUB REPO:** `https://github.com/GeneticAlgorithms/Sui-CTF-B-BHack2026`
   - **CTF SUI ADDRESS:** `0xc633b51298fda012ff64671f88b930c5d5a69681c17e785c20b796e68f583d6c`
   - **CTF FLAG OBJECT IDS:** Click **"+ ADD FLAG"** and paste each **flag object ID** from `captured_flags.txt` (second column) or from the per-challenge `.txt` file.

4. **If you don’t have the file yet:** After a successful tx, open the **transaction digest** on [Sui Explorer (testnet)](https://suiscan.xyz/testnet), find **Created** objects, and copy the object ID of the **Flag** (type `...::flag::Flag`).
