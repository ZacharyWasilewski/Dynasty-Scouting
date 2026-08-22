import { NextResponse } from "next/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? { ...user, isAdmin: isAdminUser(user) } : null });
}
