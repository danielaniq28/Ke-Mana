import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getProfile, updateProfile } from "@/lib/user-store";

const placeSchema = z.object({
  label: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(300).optional(),
});

const patchSchema = z.object({
  home: placeSchema.nullable().optional(),
  work: placeSchema.nullable().optional(),
  locale: z.enum(["ms", "en"]).optional(),
  preferences: z
    .object({
      avoidFreeway: z.boolean().optional(),
      avoidTolls: z.boolean().optional(),
      avoidFerries: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ profile: getProfile(session.user.id) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const profile = updateProfile(session.user.id, parsed.data);
  return NextResponse.json({ profile });
}
