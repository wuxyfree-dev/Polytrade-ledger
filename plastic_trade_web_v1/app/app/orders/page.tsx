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

export default function OrdersPage() {
  const { org, loading } = useOrg();
  const toast = useToast();

  const [customers, setCustomers] = React.useState<any[]>([]);
  const [materials, setMaterials] = React.useState<any[]>([]);
  const [batches, setBatches] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);

  const [customerId, setCustomerId] = React.useState("");
  const [materialId, setMaterialId] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const refresh = async () => {
    if (!org) return;
    const [c, m, o] = await Promise.all([
      supabase.from("customers").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("materials").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
      supabase.from("sales_orders").select("*, customers(name), materials(name), inventory_batches(batch_code)").eq("org_id", org.id).order("created_at", { ascending: false }),
    ]);
    setCustomers(c.data ?? []);
    setMaterials(m.data ?? []);
    setOrders(o.data ?? []);
  };

  const loadBatches = async (mid: string) => {
    if (!org || !mid) { setBatches([]); return; }
    const { data } = await supabase
      .from("inventory_batches")
      .select("*")
      .eq("org_id", org.id)
      .eq("material_id", mid)
      .gt("quantity_left", 0)
      .order("created_at", { ascending: true });
    setBatches(data ?? []);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);
  React.useEffect(() => { if (materialId) loadBatches(materialId); }, [materialId]);

  const createOrder = async () => {
    if (!org) return;
    if (!customerId) return toast.push({ type: "error", message: "请选择客户" });
    if (!materialId) return toast.push({ type: "error", message: "请选择型号" });
    if (!batchId) return toast.push({ type: "error", message: "请选择批次" });
    const q = Number(qty);
    const p = Number(unitPrice);
    if (!q || q <= 0) return toast.push({ type: "error", message: "数量必须大于 0" });
    if (!p || p <= 0) return toast.push({ type: "error", message: "销售单价必须大于 0" });

    const { error } = await supabase.rpc("create_sales_order", {
      p_org_id: org.id,
      p_customer_id: customerId,
      p_material_id: materialId,
      p_batch_id: batchId,
      p_quantity: q,
      p_unit_price: p,
      p_notes: notes.trim() || null
    });
    if (error) return toast.push({ type: "error", message: "开单失败：" + error.message });

    toast.push({ type: "success", message: "开单成功，库存已自动扣减" });
    setQty(""); setUnitPrice(""); setNotes("");
    await refresh();
    await loadBatches(materialId);
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  const exportRows = orders.map((o: any) => ({
    created_at: o.created_at,
    customer: o.customers?.name,
    material: o.materials?.name,
    batch: o.inventory_batches?.batch_code,
    quantity: o.quantity,
    unit_price: o.unit_price,
    revenue: o.revenue,
    cost: o.cost,
    profit: o.profit,
    paid_amount: o.paid_amount,
    status: o.status,
    notes: o.notes ?? ""
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title="开单 / 出库"
        desc="你只需要：选客户 → 选型号 → 选批次 → 输入数量/售价 → 点确认。系统自动扣库存、算成本、算利润。"
        right={<Button variant="ghost" onClick={() => downloadCsv("orders.csv", exportRows)}>导出CSV</Button>}
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">客户</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>

            <Select value={materialId} onChange={(e) => { setMaterialId(e.target.value); setBatchId(""); }}>
              <option value="">型号</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>

            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">批次（仅显示有库存的）</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_code ?? b.id.slice(0, 8)} · 剩余 {b.quantity_left}</option>)}
            </Select>

            <Input placeholder="数量" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input placeholder="销售单价" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            <Button onClick={createOrder}>确认开单</Button>
          </div>
          <div className="mt-3">
            <Input placeholder="备注（可选，如：送货单号/说明）" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">时间</th>
                  <th>客户</th>
                  <th>型号</th>
                  <th>批次</th>
                  <th>数量</th>
                  <th>销售价</th>
                  <th>收入</th>
                  <th>成本</th>
                  <th>利润</th>
                  <th>已收</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-black/5">
                    <td className="py-2 text-xs">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="font-medium">{o.customers?.name ?? "-"}</td>
                    <td>{o.materials?.name ?? "-"}</td>
                    <td className="text-xs">{o.inventory_batches?.batch_code ?? "-"}</td>
                    <td>{o.quantity}</td>
                    <td>{o.unit_price}</td>
                    <td>{Number(o.revenue).toFixed(2)}</td>
                    <td>{Number(o.cost).toFixed(2)}</td>
                    <td className={Number(o.profit) >= 0 ? "" : "text-red-600"}>{Number(o.profit).toFixed(2)}</td>
                    <td>{Number(o.paid_amount ?? 0).toFixed(2)}</td>
                    <td>
                      <span className={
                        "text-xs rounded-full px-2 py-1 border " +
                        (o.status === "paid"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : o.status === "partial"
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-slate-50 border-slate-200 text-slate-900")
                      }>
                        {o.status === "paid" ? "已结清" : o.status === "partial" ? "部分回款" : "未回款"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!orders.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={11}>暂无订单</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
