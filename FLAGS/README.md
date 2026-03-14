# CTF Flag Object IDs (B@B Hacks 2026)

Submit these **Flag Object IDs** on **DeepSurge CTF Submission** (B@B Hacks 2026) under **CTF FLAG OBJECT IDS** (click "+ ADD FLAG" for each).

When you run a challenge script and capture a flag, the script writes the flag object ID here automatically:

- **captured_flags.txt** — tab-separated: `challenge`, `flag_object_id`, `tx_digest`
- **\<challenge\>.txt** — one file per challenge (e.g. `moving_window.txt`) with the flag object ID and digest

## Challenges

| Challenge       | Script              | Notes |
|-----------------|---------------------|--------|
| moving_window   | `pnpm moving-window` | Run during 0–5 or 30–35 min of any hour (UTC) |
| merchant        | `pnpm merchant`     | Requires testnet USDC |
| lootboxes       | `pnpm lootboxes`    | Requires deployed exploit + USDC |
| staking         | `pnpm staking`      | Requires STAKING_POOL_ID; stake then wait 168h |
| sabotage_arena  | `pnpm sabotage-arena` | Requires ARENA_ID |

Copy each flag object ID from `captured_flags.txt` or the challenge `.txt` file into DeepSurge.
