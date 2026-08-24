/**
 * TypeScript-Prüfung mit vorheriger Aufräumrunde.
 *
 * Liegt das Projekt in einem von iCloud synchronisierten Ordner (unter macOS
 * betrifft das „Dokumente" standardmäßig), legt die Synchronisierung bei
 * Konflikten Kopien wie `routes.d 2.ts` an. Die von Next.js erzeugten
 * Typdateien deklarieren dann dieselben Namen doppelt und die Prüfung meldet
 * Fehler, die es im Quelltext gar nicht gibt.
 */
import { readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const DUPLICATE = /.+ \d+\.(ts|tsx|mts)$/;

function removeDuplicates(dir) {
  if (!existsSync(dir)) return [];
  const removed = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removed.push(...removeDuplicates(path));
    else if (DUPLICATE.test(entry.name)) {
      rmSync(path);
      removed.push(path);
    }
  }
  return removed;
}

const removed = [...removeDuplicates(".next/types"), ...removeDuplicates(".next/dev/types")];
if (removed.length > 0) {
  console.log(`${removed.length} Synchronisierungskopie(n) entfernt.`);
}

const result = spawnSync("npx", ["tsc", "--noEmit", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
