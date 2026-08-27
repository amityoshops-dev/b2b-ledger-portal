import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = process.env.BACKEND_API_URL || "https://b2b-virtual-account-engine.onrender.com";
  const endpoint = path.join("/");
  
  const response = await fetch(`${backendUrl}/api/v1/${endpoint}`, {
    cache: "no-store",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendUrl = process.env.BACKEND_API_URL || "https://b2b-virtual-account-engine.onrender.com";
  const endpoint = path.join("/");
  const body = await req.json();

  const response = await fetch(`${backendUrl}/api/v1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
