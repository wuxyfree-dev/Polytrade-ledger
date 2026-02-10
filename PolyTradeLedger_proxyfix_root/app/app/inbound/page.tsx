"use client";
import React from "react";
import { PageTitle } from "@/components/PageTitle";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useOrg } from "@/components/OrgProvider";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";

export default function InboundPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [materials, setMaterials] = React.useState<any[]>([]);
  const [batches, setBatches] = React.useState<any[]>([]);
  const [materialId, setMaterialId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unitCost, setUnitCost] = React.useState("");
  const [batchCode, setBatchCode] = React.useState("");

  const refresh = async () => {
    if (!org) return;
    const [{ data: mats }, { data: bs }] = await Promise.all([
      supabase.from("materials").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("inventory_batches").select("*, materials(name)").eq("org_id", org.id).order("created_at", { ascending: false }),
    ]);
    setMaterials(mats ?? []);
    setBatches(bs ?? []);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const add = async () => {
    if (!org) return;
    if (!materialId) return toast.push({ type: "error", message: "请选择型号" });
    const q = Number(qty);
    const c = Number(unitCost);
    if (!q || q <= 0) return toast.push({ type: "error", message: "数量必须大于 0" });
    if (!c || c <= 0) return toast.push({ type: "error", message: "单位成本必须大于 0" });

    const { error } = await supabase.from("inventory_batches").insert({
      org_id: org.id,
      material_id: materialId,
      batch_code: batchCode.trim() || null,
      quantity_total: q,
      quantity_left: q,
      unit_cost: c,
      total_cost: q * c,
    });
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "入库成功" });
    setQty(""); setUnitCost(""); setBatchCode("");
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="入库批次"
        desc="建议：每次进货建一个批次。开单时直接选择批次，系统会自动扣库存并按批次成本计算利润。"
        right={<Button variant="ghost" onClick={() => downloadCsv("batches.csv", batches.map((b: any) => ({...b, material: b.materials?.name})))}>导出CSV</Button>}
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">选择型号</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Input placeholder="批次号（可选，如 2026-02-10-01）" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
            <Input placeholder="数量（例如 1 吨=1000）" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input placeholder="单位成本（元/单位）" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <Button onClick={add}>确认入库</Button>
          </div>
          <div className="text-xs text-black/45 mt-3">
            小提示：数量单位你自己定（kg / 包 / 吨都行），只要整套系统保持一致。
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
                  <th>批次</th>
                  <th>总量</th>
                  <th>剩余</th>
                  <th>单位成本</th>
                  <th>批次成本</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{b.materials?.name ?? "-"}</td>
                    <td>{b.batch_code ?? "-"}</td>
                    <td>{b.quantity_total}</td>
                    <td className={b.quantity_left <= 0 ? "text-black/40" : ""}>{b.quantity_left}</td>
                    <td>{b.unit_cost}</td>
                    <td>{Number(b.total_cost).toFixed(2)}</td>
                  </tr>
                ))}
                {!batches.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={6}>暂无入库批次</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
