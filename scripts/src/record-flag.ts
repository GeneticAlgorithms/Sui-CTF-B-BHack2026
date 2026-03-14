import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

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
      ? readFileSync(allPath, "utf8") + line
      : "challenge\tflag_object_id\ttx_digest\n" + line;
    writeFileSync(allPath, content);
    writeFileSync(join(FLAGS_DIR, `${challenge}.txt`), `${flagObjectId}\n${digest}`);
  } catch (e) {
    console.warn("Could not write FLAGS:", e);
  }
}

export function getFlagObjectIdFromResult(result: unknown): string | null {
  const r = result as {
    result?: {
      effects?: {
        changedObjects?: Array<{
          objectId?: string;
          object_id?: string;
          outputState?: number;
          output_state?: number;
          objectType?: string;
          object_type?: string;
        }>;
      };
    };
  };
  const list = r?.result?.effects?.changedObjects;
  if (!Array.isArray(list)) return null;
  for (const obj of list) {
    const type = obj.objectType ?? obj.object_type;
    if (type && String(type).includes("Flag")) {
      const id = obj.objectId ?? obj.object_id;
      if (id) return id;
    }
  }
  const created = list.find(
    (o) => o.outputState === 1 || o.output_state === 1
  );
  return created ? (created.objectId ?? created.object_id) ?? null : null;
}
