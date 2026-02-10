"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const onSignup = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      return toast.push({ type: "error", message: "注册失败：" + error.message });
    }
    // 写入 profile（RLS 允许用户写自己）
    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").upsert({ id: userId, email, display_name: displayName || null });
    }
    setLoading(false);
    toast.push({ type: "success", message: "注册成功，已登录" });
    router.push("/app");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl bg-white shadow-soft border border-black/5 p-8">
        <h1 className="text-xl font-semibold">注册</h1>
        <div className="mt-6 space-y-3">
          <div>
            <div className="text-xs text-black/60 mb-1">昵称（可选）</div>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：小妖" />
          </div>
          <div>
            <div className="text-xs text-black/60 mb-1">邮箱</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <div className="text-xs text-black/60 mb-1">密码（至少 6 位）</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={onSignup} disabled={loading} className="w-full">{loading ? "注册中..." : "注册并进入系统"}</Button>
          <div className="text-xs text-black/50">
            已有账号？<a href="/login" className="underline">去登录</a>
          </div>
        </div>
      </div>
    </main>
  );
}
