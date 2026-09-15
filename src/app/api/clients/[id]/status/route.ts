import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Polled by the client detail page while provisioning is in progress. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.client.findUnique({
    where: { id: params.id },
    select: { provisionStatus: true, provisionError: true, cafeId: true, provisionedAt: true },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(c);
}
