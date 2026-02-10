import { NextRequest } from "next/server";
import { proxyToSupabase, runtime, dynamic } from "@/lib/supabaseProxy";

export { runtime, dynamic };

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxyToSupabase(req, "/auth/v1", ctx.params.path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxyToSupabase(req, "/auth/v1", ctx.params.path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxyToSupabase(req, "/auth/v1", ctx.params.path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxyToSupabase(req, "/auth/v1", ctx.params.path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxyToSupabase(req, "/auth/v1", ctx.params.path);
}
