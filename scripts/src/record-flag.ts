import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const FLAGS_DIR = join(process.cwd(), "..", "FLAGS");

export function recordFlag(
  challenge: string,
  digest: string,
  flagObjectId: string
): void {
  try {
    if (!existsSync(FLAGS_DIR)) mkdirSync(FLAGS_DIR, { recursive: true });
    const line = `${challenge}\t${flagObjectId}\t${digest}\n`;
    const allPath = join(FLAGS_DIR, "captured_flags.txt");
    const content = existsSync(allPath)
      ? `${readFileSync(allPath, "utf8")}${line}`
      : `challenge\tflag_object_id\ttx_digest\n${line}`;
    writeFileSync(allPath, content);
    writeFileSync(join(FLAGS_DIR, `${challenge}.txt`), `${flagObjectId}\n${digest}`);
  } catch (e) {
    console.warn("Could not write FLAGS:", e);
  }
}

/** Get transaction payload: SDK returns { $kind, Transaction } or { $kind, FailedTransaction } */
function getTx(result: unknown): {
  digest?: string;
  effects?: { changedObjects?: Array<{ objectId?: string; object_id?: string; objectType?: string; object_type?: string; outputState?: string; output_state?: string; idOperation?: string; id_operation?: string }> };
  objectTypes?: Record<string, string>;
} | null {
  const r = result as { $kind?: string; Transaction?: unknown; FailedTransaction?: unknown };
  const tx = r?.$kind === "Transaction" ? r.Transaction : r?.$kind === "FailedTransaction" ? r.FailedTransaction : (result as { result?: unknown }).result;
  return (tx as Record<string, unknown>) ?? null;
}

export function getFlagObjectIdFromResult(result: unknown): string | null {
  const tx = getTx(result);
  const list = tx?.effects?.changedObjects;
  const objectTypes = tx?.objectTypes ?? {};
  if (!Array.isArray(list)) return null;
  for (const obj of list) {
    const id = obj.objectId ?? obj.object_id;
    if (!id) continue;
    const type = obj.objectType ?? obj.object_type ?? objectTypes[id];
    if (type && String(type).includes("Flag")) return id;
  }
  const created = list.find(
    (o) =>
      o.idOperation === "Created" ||
      o.id_operation === "Created" ||
      o.outputState === "ObjectWrite" ||
      o.output_state === "ObjectWrite"
  );
  if (created) {
    const id = created.objectId ?? created.object_id;
    if (id && objectTypes[id]?.includes("Flag")) return id;
    if (id) return id;
  }
  return null;
}
