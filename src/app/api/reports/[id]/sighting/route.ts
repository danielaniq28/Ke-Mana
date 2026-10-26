import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sightReport } from "@/lib/reports-store";

const bodySchema = z.object({
  stillThere: z.boolean(),
  lat: z.number().min(-0.5).max(8),
  lng: z.number().min(98).max(120),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sighting" }, { status: 400 });
  }
  const result = sightReport(id, parsed.data.stillThere, {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
  });
  if ("error" in result) {
    const status = result.error === "too_far" ? 403 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
