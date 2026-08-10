import { NextResponse } from "next/server";
import { getProspects } from "@/lib/googleSheets";

export const revalidate = 60;

export async function GET() {
  try {
    const prospects = await getProspects();
    return NextResponse.json({ prospects });
  } catch (err) {
    return NextResponse.json(
      { prospects: [], error: err instanceof Error ? err.message : "Failed to load prospects" },
      { status: 502 }
    );
  }
}
