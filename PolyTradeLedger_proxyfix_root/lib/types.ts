export type OrgRole = "owner" | "editor" | "viewer";

export type Organization = { id: string; name: string; created_at: string };
export type Material = { id: string; org_id: string; name: string; origin: string | null; default_cost: number | null; created_at: string };
export type Customer = { id: string; org_id: string; name: string; contact: string | null; created_at: string };
export type Batch = {
  id: string; org_id: string; material_id: string; batch_code: string;
  quantity_total: number; quantity_left: number;
  unit_cost: number; total_cost: number;
  created_at: string;
};

export type SalesOrder = {
  id: string; org_id: string;
  customer_id: string; material_id: string; batch_id: string;
  quantity: number; unit_price: number;
  revenue: number; cost: number; profit: number;
  paid_amount: number;
  status: "unpaid" | "partial" | "paid";
  notes: string | null;
  created_at: string;
};

export type Payment = { id: string; org_id: string; sales_order_id: string; amount: number; payment_date: string; created_at: string };
export type WorkingCapitalLog = { id: string; org_id: string; type: "income"|"expense"; amount: number; remark: string | null; created_at: string };

export type ProfitRule = { id: string; org_id: string; version_name: string; working_capital_ratio: number; effective_date: string; created_at: string };
export type ProfitShare = { id: string; rule_id: string; org_id: string; user_id: string; ratio: number; created_at: string };

export type Profile = { id: string; org_id: string | null; email: string; display_name: string | null; created_at: string };
export type OrgMember = { org_id: string; user_id: string; role: OrgRole; created_at: string };

export type Settlement = { id: string; org_id: string; start_date: string; end_date: string; rule_id: string; distributable_profit: number; total_profit: number; created_at: string };
export type SettlementLine = { id: string; settlement_id: string; org_id: string; line_type: "working_capital" | "member"; user_id: string | null; ratio: number; amount: number; created_at: string };
