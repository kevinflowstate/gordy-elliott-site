import { NextResponse } from "next/server";

export function dbError(error: unknown, friendly: string, status = 500) {
  console.error(friendly, error);
  return NextResponse.json({ error: friendly }, { status });
}
