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

export default function CustomersPage() {
  const { org, loading } = useOrg();
  const toast = useToast();
  const [rows, setRows] = React.useState<any[]>([]);
  const [name, setName] = React.useState("");
  const [contact, setContact] = React.useState("");

  const refresh = async () => {
    if (!org) return;
    const { data, error } = await supabase.from("customers").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
    if (error) return toast.push({ type: "error", message: error.message });
    setRows(data ?? []);
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const add = async () => {
    if (!org) return;
    if (!name.trim()) return toast.push({ type: "error", message: "请输入客户名称" });
    const { error } = await supabase.from("customers").insert({
      org_id: org.id,
      name: name.trim(),
      contact: contact.trim() || null,
    });
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已添加客户" });
    setName(""); setContact("");
    refresh();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已删除" });
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="客户管理"
        desc="多客户管理：每张订单都绑定客户，后续看利润/应收/贡献排行会更直观。"
        right={<Button variant="ghost" onClick={() => downloadCsv("customers.csv", rows)}>导出CSV</Button>}
      />

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="客户名称（如 郑总）" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="联系方式/备注（可选）" value={contact} onChange={(e) => setContact(e.target.value)} />
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
                  <th className="py-2">客户</th>
                  <th>联系方式/备注</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.contact ?? "-"}</td>
                    <td className="text-right">
                      <Button variant="danger" size="sm" onClick={() => del(r.id)}>删除</Button>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={3}>暂无数据</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
