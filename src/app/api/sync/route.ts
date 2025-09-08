import { NextRequest, NextResponse } from "next/server";

// TODO: Implement sync endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Sync endpoint" });
}
