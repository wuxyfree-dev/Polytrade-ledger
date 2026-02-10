import { NextRequest, NextResponse } from "next/server";

// 通过 Next.js 作为反向代理，把浏览器对 /auth/v1 与 /rest/v1 的请求转发到真实 Supabase。
// 这样前端就不需要直接访问 *.supabase.co（避免某些网络环境下被墙/被拦导致超时）。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUpstream() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing SUPABASE_URL/SUPABASE_ANON_KEY env vars (or NEXT_PUBLIC equivalents). ");
  }
  return { url, anon };
}

function stripHopByHopHeaders(headers: Headers) {
  const h = new Headers(headers);
  // hop-by-hop
  [
    "host",
    "connection",
    "content-length",
    "accept-encoding",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-for",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "origin",
    "referer",
  ].forEach((k) => h.delete(k));
  return h;
}

export async function proxyToSupabase(req: NextRequest, base: "/auth/v1" | "/rest/v1", tail: string[]) {
  const { url: upstreamUrl, anon } = getUpstream();
  const path = tail.join("/");
  const target = new URL(`${upstreamUrl}${base}/${path}`);
  target.search = req.nextUrl.search;

  const headers = stripHopByHopHeaders(req.headers);
  // Supabase 需要 apikey；supabase-js 通常也会带 Authorization。
  headers.set("apikey", anon);
  if (!headers.get("authorization")) headers.set("authorization", `Bearer ${anon}`);

  const method = req.method.toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");

  const upstreamRes = await fetch(target, {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    // 不让 Next.js 做缓存
    cache: "no-store",
  });

  const resHeaders = new Headers(upstreamRes.headers);
  // 避免浏览器/平台对一些 header 的奇怪限制
  resHeaders.delete("content-encoding");

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  });
}
