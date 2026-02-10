"use client";
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis, PieChart, Pie, Legend } from "recharts";
import { useToast } from "@/components/ui/Toast";

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-xs text-black/55">{title}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint ? <div className="mt-1 text-xs text-black/45">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [kpi, setKpi] = React.useState<any | null>(null);
  const [profitTrend, setProfitTrend] = React.useState<any[]>([]);
  const [profitByMaterial, setProfitByMaterial] = React.useState<any[]>([]);
  const [receivables, setReceivables] = React.useState(0);

  const refresh = async () => {
    if (!org) return;
    const { data, error } = await supabase.rpc("dashboard_kpis", { p_org_id: org.id });
    if (error) {
      toast.push({ type: "error", message: "加载看板失败：" + error.message });
      return;
    }
    setKpi(data?.kpi ?? null);
    setProfitTrend(data?.profit_trend ?? []);
    setProfitByMaterial(data?.profit_by_material ?? []);
    setReceivables(data?.receivables ?? 0);
  };

  React.useEffect(() => {
    if (!loading && org) refresh();
  }, [loading, org]);

  // 说明：Realtime 依赖 WebSocket。
  // 为了兼容“无法直连 supabase.co”的网络环境，本项目默认用轮询代替实时订阅。
  React.useEffect(() => {
    if (!org) return;
    const timer = window.setInterval(() => refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [org]);

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  const wc = kpi?.working_capital_balance ?? 0;
  const totalProfit = kpi?.total_profit ?? 0;
  const distributable = kpi?.distributable_profit ?? 0;
  const inventoryValue = kpi?.inventory_value ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">老板驾驶舱</div>
        <div className="text-sm text-black/55 mt-1">{org.name} · {format(new Date(), "yyyy-MM-dd")}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="总利润（全部订单）" value={`¥ ${Number(totalProfit).toFixed(2)}`} hint="含未回款利润" />
        <StatCard title="可分利润（按已回款）" value={`¥ ${Number(distributable).toFixed(2)}`} hint="部分回款按比例计入" />
        <StatCard title="应收账款" value={`¥ ${Number(receivables).toFixed(2)}`} />
        <StatCard title="流动资金余额" value={`¥ ${Number(wc).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="font-semibold">近 30 天利润趋势</div>
            <div className="text-xs text-black/50 mt-1">按订单创建日期汇总</div>
          </CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="profit" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="font-semibold">利润构成（按型号）</div>
            <div className="text-xs text-black/50 mt-1">帮助你判断“赚哪种料”</div>
          </CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={profitByMaterial} dataKey="profit" nameKey="material" outerRadius={100} />
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">库存价值（估算）</div>
          <div className="text-xs text-black/50 mt-1">按批次剩余数量 × 单位成本</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">¥ {Number(inventoryValue).toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
