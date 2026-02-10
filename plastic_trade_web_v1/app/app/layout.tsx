"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { OrgProvider } from "@/components/OrgProvider";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

function CreateOrgGate({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [orgName, setOrgName] = React.useState("我的塑料贸易");
  const [checking, setChecking] = React.useState(true);
  const [hasOrg, setHasOrg] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.push("/login");
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_my_org");
      if (error) {
        console.error(error);
        setHasOrg(false);
      } else {
        setHasOrg((data?.length ?? 0) > 0);
      }
      setChecking(false);
    })();
  }, [userId, loading, router]);

  const createOrg = async () => {
    const { error } = await supabase.rpc("bootstrap_org", { org_name: orgName });
    if (error) return toast.push({ type: "error", message: "创建失败：" + error.message });
    toast.push({ type: "success", message: "创建成功！" });
    setHasOrg(true);
  };

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-black/60">加载中...</div>;
  }

  if (!hasOrg) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardContent>
            <div className="text-xl font-semibold">第一次使用：创建你的“组织（生意）”</div>
            <div className="mt-2 text-sm text-black/60">
              组织用于承载所有数据（客户、库存、订单、回款、分红）。以后你加合伙人时，就是把他加进这个组织。
            </div>
            <div className="mt-5">
              <div className="text-xs text-black/60 mb-1">组织名称</div>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <Button className="mt-4 w-full" onClick={createOrg}>创建并进入系统</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <OrgProvider>{children}</OrgProvider>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CreateOrgGate>
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </CreateOrgGate>
  );
}
