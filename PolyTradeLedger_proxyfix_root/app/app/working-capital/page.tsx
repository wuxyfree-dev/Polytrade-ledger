"use client";
import React from "react";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";

export default function WorkingCapitalPage() {
  const { org, loading } = useOrg();
  const toast = useToast();

  const [logs, setLogs] = React.useState<any[]>([]);
  const [type, setType] = React.useState<"income" | "expense">("expense");
  const [amount, setAmount] = React.useState("");
  const [remark, setRemark] = React.useState("");
  const [balance, setBalance] = React.useState(0);

  const refresh = async () => {
    if (!org) return;
    const [{ data }, { data: b, error: be }] = await Promise.all([
      supabase.from("working_capital_logs").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.rpc("working_capital_balance", { p_org_id: org.id }),
    ]);
    setLogs(data ?? []);
    if (!be) setBalance(b ?? 0);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const add = async () => {
    if (!org) return;
    const a = Number(amount);
    if (!a || a <= 0) return toast.push({ type: "error", message: "金额必须大于 0" });
    const { error } = await supabase.from("working_capital_logs").insert({
      org_id: org.id,
      type,
      amount: a,
      remark: remark.trim() || null,
    });
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已记录" });
    setAmount(""); setRemark("");
    refresh();
  };

  const exportRows = logs.map((l: any) => ({
    created_at: l.created_at,
    type: l.type,
    amount: l.amount,
    remark: l.remark ?? ""
  }));

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="流动资金"
        desc="你可以把“备用金/周转金”的收入与支出都记在这里。未来做分红结算时，也会自动把提取的流动资金记一笔收入。"
        right={<Button variant="ghost" onClick={() => downloadCsv("working_capital_logs.csv", exportRows)}>导出CSV</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="font-semibold">流动资金余额</div>
            <div className="text-xs text-black/50 mt-1">income - expense</div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">¥ {Number(balance).toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </Select>
              <Input placeholder="金额" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input placeholder="备注（可选）" value={remark} onChange={(e) => setRemark(e.target.value)} />
              <Button onClick={add}>记录</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">时间</th>
                  <th>类型</th>
                  <th>金额</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-black/5">
                    <td className="py-2 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                    <td>{l.type === "income" ? "收入" : "支出"}</td>
                    <td className={l.type === "income" ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                      {Number(l.amount).toFixed(2)}
                    </td>
                    <td className="text-black/70">{l.remark ?? "-"}</td>
                  </tr>
                ))}
                {!logs.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={4}>暂无记录</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
