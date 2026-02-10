"use client";
import React from "react";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";

export default function PaymentsPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [orders, setOrders] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [orderId, setOrderId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");

  const refresh = async () => {
    if (!org) return;
    const [o, p] = await Promise.all([
      supabase.from("sales_orders").select("id, created_at, revenue, paid_amount, status, customers(name), materials(name)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("payments").select("*, sales_orders(created_at), customers(name), materials(name)").eq("org_id", org.id).order("created_at", { ascending: false }),
    ]);
    setOrders(o.data ?? []);
    setPayments(p.data ?? []);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const addPayment = async () => {
    if (!org) return;
    if (!orderId) return toast.push({ type: "error", message: "请选择订单" });
    const a = Number(amount);
    if (!a || a <= 0) return toast.push({ type: "error", message: "金额必须大于 0" });
    const payDate = date || new Date().toISOString().slice(0, 10);

    const { error } = await supabase.rpc("add_payment", {
      p_org_id: org.id,
      p_order_id: orderId,
      p_amount: a,
      p_payment_date: payDate
    });
    if (error) return toast.push({ type: "error", message: "记录回款失败：" + error.message });
    toast.push({ type: "success", message: "已记录回款" });
    setAmount(""); setDate(""); setOrderId("");
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  const exportRows = payments.map((p: any) => ({
    payment_date: p.payment_date,
    amount: p.amount,
    order_created_at: p.sales_orders?.created_at,
    customer: p.sales_orders?.customers?.name,
    material: p.sales_orders?.materials?.name
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title="回款记录"
        desc="支持部分回款：系统会自动更新订单的“已收金额/状态”，并在看板里按回款比例计算可分利润。"
        right={<Button variant="ghost" onClick={() => downloadCsv("payments.csv", exportRows)}>导出CSV</Button>}
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">选择订单（最近200条）</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {new Date(o.created_at).toLocaleDateString()} · {o.customers?.name ?? ""} · {o.materials?.name ?? ""} · 状态:{o.status} · 已收:{Number(o.paid_amount).toFixed(0)}/{Number(o.revenue).toFixed(0)}
                </option>
              ))}
            </Select>
            <Input placeholder="回款金额" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button onClick={addPayment}>确认回款</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">回款日期</th>
                  <th>金额</th>
                  <th>订单时间</th>
                  <th>客户</th>
                  <th>型号</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-black/5">
                    <td className="py-2">{p.payment_date}</td>
                    <td className="font-medium">{Number(p.amount).toFixed(2)}</td>
                    <td className="text-xs">{p.sales_orders?.created_at ? new Date(p.sales_orders.created_at).toLocaleString() : "-"}</td>
                    <td>{p.sales_orders?.customers?.name ?? "-"}</td>
                    <td>{p.sales_orders?.materials?.name ?? "-"}</td>
                  </tr>
                ))}
                {!payments.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={5}>暂无回款记录</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
