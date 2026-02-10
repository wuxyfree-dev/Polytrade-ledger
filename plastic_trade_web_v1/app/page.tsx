import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-3xl bg-white shadow-soft border border-black/5 p-8">
        <h1 className="text-2xl font-semibold">塑料贸易经营系统 v1</h1>
        <p className="mt-2 text-sm text-black/60">
          入库 → 开单出库 → 回款 → 分红/流动资金 → 可视化看板（多设备同步）
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="rounded-2xl bg-black text-white px-4 py-2 text-sm font-medium">登录</Link>
          <Link href="/signup" className="rounded-2xl bg-white border border-black/10 px-4 py-2 text-sm font-medium">注册</Link>
        </div>
        <p className="mt-6 text-xs text-black/50">
          提示：第一次登录后，会引导你创建“组织（你的生意）”，后续所有数据都挂在组织下面，便于你以后给合伙人看数据。
        </p>
      </div>
    </main>
  );
}
