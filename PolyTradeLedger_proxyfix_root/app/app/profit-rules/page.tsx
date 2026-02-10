"use client";
import React from "react";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";

export default function ProfitRulesPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [rules, setRules] = React.useState<any[]>([]);
  const [active, setActive] = React.useState<any | null>(null);

  const [versionName, setVersionName] = React.useState("v1");
  const [effectiveDate, setEffectiveDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [wcRatio, setWcRatio] = React.useState("0.30");

  const refresh = async () => {
    if (!org) return;
    const { data, error } = await supabase.from("profit_rules").select("*").eq("org_id", org.id).order("effective_date", { ascending: false });
    if (error) return toast.push({ type: "error", message: error.message });
    setRules(data ?? []);
    setActive((data ?? [])[0] ?? null);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const createRule = async () => {
    if (!org) return;
    const r = Number(wcRatio);
    if (isNaN(r) || r < 0 || r > 0.9) return toast.push({ type: "error", message: "流动资金比例建议 0~0.9" });
    const { error } = await supabase.rpc("create_profit_rule_with_default_shares", {
      p_org_id: org.id,
      p_version_name: versionName.trim() || "v1",
      p_working_capital_ratio: r,
      p_effective_date: effectiveDate
    });
    if (error) return toast.push({ type: "error", message: "创建失败：" + error.message });
    toast.push({ type: "success", message: "已创建规则（默认100%给你，可在成员页再细分）" });
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="分红规则（版本化）"
        desc="规则按“生效日期”管理，历史不被篡改。分红对象与比例在“成员/合伙人”页面调整（支持 viewer/editor）。"
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="版本名（如 2026Q1）" value={versionName} onChange={(e) => setVersionName(e.target.value)} />
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            <Input placeholder="流动资金比例（如 0.30）" value={wcRatio} onChange={(e) => setWcRatio(e.target.value)} />
            <Button onClick={createRule}>创建新规则</Button>
          </div>
          <div className="text-xs text-black/50 mt-3">
            v1 默认：分红剩余部分 100% 先给你（owner）。你加合伙人后，可以在成员页把当前规则的“分红份额”分配给他们。
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="text-sm font-semibold mb-2">已有规则</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">版本</th>
                  <th>生效日期</th>
                  <th>流动资金比例</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{r.version_name}{active?.id === r.id ? "（当前）" : ""}</td>
                    <td>{r.effective_date}</td>
                    <td>{Number(r.working_capital_ratio).toFixed(2)}</td>
                    <td className="text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!rules.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={4}>暂无规则（建议先创建一个）</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
