import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createReport, listReports } from "@/lib/reports-store";
const reportTypes = ["hazard", "police", "roadblock", "accident", "traffic", "flood"] as const;

const postSchema = z.object({
  type: z.enum(reportTypes),
  lat: z.number().min(-0.5).max(8),
  lng: z.number().min(98).max(120),
  note: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const south = searchParams.get("south");
  const west = searchParams.get("west");
  const north = searchParams.get("north");
  const east = searchParams.get("east");

  if (south && west && north && east) {
    const bounds = {
      south: Number(south),
      west: Number(west),
      north: Number(north),
      east: Number(east),
    };
    return NextResponse.json({ reports: listReports(bounds) });
  }

  return NextResponse.json({ reports: listReports() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  const report = createReport(parsed.data);
  return NextResponse.json({ report }, { status: 201 });
}
