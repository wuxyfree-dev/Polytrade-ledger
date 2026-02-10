"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

const items = [
  { href: "/app", label: "首页看板" },
  { href: "/app/materials", label: "塑料型号库" },
  { href: "/app/customers", label: "客户管理" },
  { href: "/app/inbound", label: "入库批次" },
  { href: "/app/orders", label: "开单/出库" },
  { href: "/app/payments", label: "回款记录" },
  { href: "/app/working-capital", label: "流动资金" },
  { href: "/app/profit-rules", label: "分红规则" },
  { href: "/app/members", label: "成员/合伙人" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const logout = async () => {
    await supabase.auth.signOut();
    toast.push({ type: "info", message: "已退出登录" });
    router.push("/");
  };

  return (
    <aside className="w-full md:w-64 shrink-0 p-4 md:p-6">
      <div className="rounded-3xl bg-white shadow-soft border border-black/5 p-4">
        <div className="font-semibold">塑料贸易 v1</div>
        <div className="text-xs text-black/50 mt-1">轻量经营系统</div>
        <nav className="mt-4 space-y-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "block rounded-2xl px-3 py-2 text-sm transition",
                pathname === it.href ? "bg-black text-white" : "hover:bg-black/5 text-black"
              )}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="mt-4 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5">
          退出登录
        </button>
      </div>
      <div className="mt-3 text-[11px] text-black/45 px-2">
        小提示：以后给合伙人看数据，只要让对方注册账号，然后你在“成员/合伙人”里加他为 viewer/editor 即可。
      </div>
    </aside>
  );
}
