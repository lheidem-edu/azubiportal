import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Zustandsprüfung für den Reverse-Proxy bzw. die Container-Orchestrierung.
 * Antwortet nur dann mit 200, wenn auch die Datenbank erreichbar ist –
 * sonst würde eine startende Instanz zu früh Anfragen bekommen.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("[health]", error);
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
