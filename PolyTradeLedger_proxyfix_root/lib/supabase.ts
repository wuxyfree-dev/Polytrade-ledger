import { createClient } from "@supabase/supabase-js";

/**
 * 关键点：有些网络环境无法直连 *.supabase.co（注册/登录会一直转圈超时）。
 * 
 * 解决思路：浏览器端把 Supabase Base URL 改成“当前站点域名”，
 * 让前端只请求 Vercel 域名；再由 Next.js 服务器路由去代理转发到真实 Supabase。
 * 
 * - 浏览器端：window.location.origin  ->  https://你的vercel域名
 * - 代理路由：/auth/v1/*  与 /rest/v1/*
 */
const supabaseUrl =
  typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnon) {
  // 在 Next.js 运行时抛错比默默失败更友好
  // eslint-disable-next-line no-console
  console.warn("Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Realtime 需要 WebSocket，Vercel 的 Route Handler 不支持 WebSocket 反代。
  // 本项目默认不依赖 Realtime；如后续需要可改为轮询或单独部署 Realtime 代理。
});
