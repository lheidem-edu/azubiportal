/**
 * Lädt die Umgebungsvariablen für Skripte außerhalb von Next.js
 * (Migration, Seed, Worker) in derselben Reihenfolge wie Next.js selbst.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
