"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const onLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.push({ type: "error", message: "登录失败：" + error.message });
    toast.push({ type: "success", message: "登录成功" });
    router.push("/app");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl bg-white shadow-soft border border-black/5 p-8">
        <h1 className="text-xl font-semibold">登录</h1>
        <div className="mt-6 space-y-3">
          <div>
            <div className="text-xs text-black/60 mb-1">邮箱</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <div className="text-xs text-black/60 mb-1">密码</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={onLogin} disabled={loading} className="w-full">{loading ? "登录中..." : "登录"}</Button>
          <div className="text-xs text-black/50">
            还没有账号？<a href="/signup" className="underline">去注册</a>
          </div>
        </div>
      </div>
    </main>
  );
}
