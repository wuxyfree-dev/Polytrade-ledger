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

export default function MembersPage() {
  const { org, loading } = useOrg();
  const toast = useToast();

  const [members, setMembers] = React.useState<any[]>([]);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"viewer"|"editor">("viewer");

  const [activeRule, setActiveRule] = React.useState<any | null>(null);
  const [shares, setShares] = React.useState<any[]>([]);

  const refresh = async () => {
    if (!org) return;
    const [m, r] = await Promise.all([
      supabase.rpc("list_org_members_with_profiles", { p_org_id: org.id }),
      supabase.rpc("get_active_profit_rule", { p_org_id: org.id }),
    ]);
    if (m.error) toast.push({ type: "error", message: m.error.message });
    setMembers(m.data ?? []);

    const rule = r.data?.[0] ?? null;
    setActiveRule(rule);

    if (rule?.id) {
      const s = await supabase.from("profit_rule_shares").select("*, profiles:profiles!profit_rule_shares_user_id_fkey(email, display_name)").eq("rule_id", rule.id).order("created_at", { ascending: true });
      setShares(s.data ?? []);
    } else {
      setShares([]);
    }
  };

  React.useEffect(() => { if (!loading && org) refresh(); }, [loading, org]);

  const addMember = async () => {
    if (!org) return;
    if (!email.trim()) return toast.push({ type: "error", message: "请输入邮箱" });

    const { error } = await supabase.rpc("add_member_by_email", {
      p_org_id: org.id,
      p_email: email.trim(),
      p_role: role
    });
    if (error) return toast.push({ type: "error", message: "添加失败：" + error.message });

    toast.push({ type: "success", message: "已添加成员（对方需先注册账号）" });
    setEmail("");
    refresh();
  };

  const updateShare = async (id: string, ratioStr: string) => {
    const ratio = Number(ratioStr);
    if (isNaN(ratio) || ratio < 0 || ratio > 1) return;
    const { error } = await supabase.from("profit_rule_shares").update({ ratio }).eq("id", id);
    if (error) toast.push({ type: "error", message: error.message });
    else toast.push({ type: "success", message: "已更新比例" });
    refresh();
  };

  const normalizeShares = async () => {
    if (!activeRule?.id) return;
    const { error } = await supabase.rpc("normalize_profit_shares", { p_rule_id: activeRule.id });
    if (error) return toast.push({ type: "error", message: error.message });
    toast.push({ type: "success", message: "已自动归一化（总和=1）" });
    refresh();
  };

  if (loading) return <div className="text-sm text-black/60">加载中...</div>;
  if (!org) return <div className="text-sm text-black/60">未找到组织</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="成员 / 合伙人"
        desc="你是 owner。合伙人可设为 viewer（只看）或 editor（可录入）。分红比例按“当前生效的规则”设置。"
      />

      <Card>
        <CardContent>
          <div className="text-sm font-semibold">添加成员</div>
          <div className="text-xs text-black/50 mt-1">对方需要先注册账号（用邮箱注册），你才能通过邮箱把他加进组织。</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <Input placeholder="对方注册邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="viewer">viewer（只看）</option>
              <option value="editor">editor（可录入）</option>
            </Select>
            <Button onClick={addMember}>添加</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="text-sm font-semibold mb-2">当前成员</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">邮箱</th>
                  <th>昵称</th>
                  <th>角色</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.user_id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{m.email}</td>
                    <td>{m.display_name ?? "-"}</td>
                    <td>{m.role}</td>
                  </tr>
                ))}
                {!members.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={3}>暂无成员</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">分红份额（当前规则）</div>
              <div className="text-xs text-black/50 mt-1">
                {activeRule ? `当前规则：${activeRule.version_name}（生效 ${activeRule.effective_date}）` : "请先在“分红规则”创建一条规则"}
              </div>
              <div className="text-xs text-black/50 mt-1">这里的份额总和应为 1（表示“除去流动资金后的分红池”）。</div>
            </div>
            <Button variant="ghost" onClick={normalizeShares}>一键归一化</Button>
          </div>

          <div className="overflow-auto mt-3">
            <table className="w-full text-sm">
              <thead className="text-left text-black/60">
                <tr>
                  <th className="py-2">成员</th>
                  <th>邮箱</th>
                  <th>份额 ratio（0~1）</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((s: any) => (
                  <tr key={s.id} className="border-t border-black/5">
                    <td className="py-2 font-medium">{s.profiles?.display_name ?? "未命名"}</td>
                    <td className="text-xs">{s.profiles?.email ?? "-"}</td>
                    <td className="max-w-[160px]">
                      <Input
                        defaultValue={String(s.ratio)}
                        onBlur={(e) => updateShare(s.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                {!shares.length ? (
                  <tr><td className="py-8 text-center text-black/50" colSpan={3}>暂无份额（创建规则后会默认给 owner 100%）</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
