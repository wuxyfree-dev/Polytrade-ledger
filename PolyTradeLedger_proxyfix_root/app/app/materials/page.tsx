"use client";
import React from "react";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";

export default function MaterialsPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [rows, setRows] = React.useState<any[]>([]);
  const [name, setName] = React.useState("");
  const [origin, setOrigin] = React.useState("");
  const [defaultCost, setDefaultCost] = React.useState("");

  const refresh = async () => {
    if (!org) return;
    const { data, error } = await supabase.from("materials").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    if (error) return toast.push({ type: "error", message: error.message });
    setRows(data ?? []);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const add = async () => {
    if (!org) return;
    if (!name.trim()) return toast.push({ type: "error", message: "请输入型号名称" });
    const { error } = await supabase.from("materials").insert({
      org_id: org.id,
      name: name.trim(),
      origin: origin.trim() || null,
      default_cost: defaultCost ? Number(defaultCost) : null,
    });
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已添加" });
    setName(""); setOrigin(""); setDefaultCost("");
    refresh();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已删除" });
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="塑料型号库"
        desc="建议：把常用型号先建好（M09 / Z30S 等），后续入库与开单就只需要点选。"
        right={<Button variant="ghost" onClick={() => downloadCsv("materials.csv", rows)}>导出CSV</Button>}
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input placeholder="型号（如 M09）" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="产地/厂家（可选）" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            <Input placeholder="默认成本（可选）" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} />
            <Button onClick={add}>添加</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">型号</th>
                  <th>产地/厂家</th>
                  <th>默认成本</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.origin ?? "-"}</td>
                    <td>{r.default_cost ?? "-"}</td>
                    <td className="text-right">
                      <Button variant="danger" size="sm" onClick={() => del(r.id)}>删除</Button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={4}>暂无数据</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
