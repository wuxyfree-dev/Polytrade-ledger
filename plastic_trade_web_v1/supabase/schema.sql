-- Plastic Trade Dashboard v1 - Supabase schema
-- 执行顺序：直接整段执行即可

-- 需要扩展：uuid 生成
create extension if not exists "pgcrypto";

-- ========== 基础表 ==========
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type public.org_role as enum ('owner','editor','viewer');

create table if not exists public.org_members (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- 业务主数据
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  origin text,
  default_cost numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact text,
  created_at timestamptz not null default now()
);

-- 入库批次
create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  batch_code text,
  quantity_total numeric not null,
  quantity_left numeric not null,
  unit_cost numeric not null,
  total_cost numeric not null,
  created_at timestamptz not null default now()
);

-- 订单/出库
create type public.order_status as enum ('unpaid','partial','paid');

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  material_id uuid not null references public.materials(id) on delete restrict,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  quantity numeric not null,
  unit_price numeric not null,
  revenue numeric not null,
  cost numeric not null,
  profit numeric not null,
  paid_amount numeric not null default 0,
  status public.order_status not null default 'unpaid',
  notes text,
  created_at timestamptz not null default now()
);

-- 回款
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  created_at timestamptz not null default now()
);

-- 流动资金账本
create type public.wc_type as enum ('income','expense');

create table if not exists public.working_capital_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type public.wc_type not null,
  amount numeric not null,
  remark text,
  created_at timestamptz not null default now()
);

-- 分红规则（版本化）
create table if not exists public.profit_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  version_name text not null,
  working_capital_ratio numeric not null,
  effective_date date not null,
  created_at timestamptz not null default now()
);

-- 分红份额：针对某条规则，把“除去流动资金”的分红池按成员分配（总和=1）
create table if not exists public.profit_rule_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.profit_rules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ratio numeric not null,
  created_at timestamptz not null default now(),
  unique(rule_id, user_id)
);

-- 分红结算（预留：v1 先不做 UI，后续可加）
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  rule_id uuid not null references public.profit_rules(id),
  total_profit numeric not null,
  distributable_profit numeric not null,
  created_at timestamptz not null default now()
);

create type public.settlement_line_type as enum ('working_capital','member');

create table if not exists public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  line_type public.settlement_line_type not null,
  user_id uuid references public.profiles(id),
  ratio numeric not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- ========== 自动更新订单 paid_amount / status ==========
create or replace function public.recalc_order_payment(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_paid numeric;
  v_rev numeric;
begin
  select coalesce(sum(amount),0) into v_paid from public.payments where sales_order_id = p_order_id;
  select revenue into v_rev from public.sales_orders where id = p_order_id;

  update public.sales_orders
  set paid_amount = v_paid,
      status = case
        when v_paid <= 0 then 'unpaid'
        when v_paid >= v_rev then 'paid'
        else 'partial'
      end
  where id = p_order_id;
end;
$$;

create or replace function public.trg_payments_after_change()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.recalc_order_payment(coalesce(new.sales_order_id, old.sales_order_id));
  return null;
end;
$$;

drop trigger if exists payments_after_change on public.payments;
create trigger payments_after_change
after insert or update or delete on public.payments
for each row execute function public.trg_payments_after_change();

-- ========== RPC：创建订单（原子扣库存 + 自动算利润） ==========
create or replace function public.create_sales_order(
  p_org_id uuid,
  p_customer_id uuid,
  p_material_id uuid,
  p_batch_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_left numeric;
  v_unit_cost numeric;
  v_order_id uuid;
  v_revenue numeric;
  v_cost numeric;
  v_profit numeric;
begin
  if public.can_write_org(p_org_id) is false then
    raise exception 'No permission';
  end if;

  -- 校验批次属于该组织且库存足够
  select quantity_left, unit_cost
  into v_left, v_unit_cost
  from public.inventory_batches
  where id = p_batch_id and org_id = p_org_id
  for update;

  if v_left is null then
    raise exception 'Batch not found';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be > 0';
  end if;

  if v_left < p_quantity then
    raise exception 'Not enough inventory. left=% requested=%', v_left, p_quantity;
  end if;

  v_revenue := p_quantity * p_unit_price;
  v_cost := p_quantity * v_unit_cost;
  v_profit := v_revenue - v_cost;

  insert into public.sales_orders(org_id, customer_id, material_id, batch_id, quantity, unit_price, revenue, cost, profit, notes)
  values (p_org_id, p_customer_id, p_material_id, p_batch_id, p_quantity, p_unit_price, v_revenue, v_cost, v_profit, p_notes)
  returning id into v_order_id;

  update public.inventory_batches
  set quantity_left = quantity_left - p_quantity
  where id = p_batch_id;

  return v_order_id;
end;
$$;

-- RPC：添加回款（插入 payment，触发器会更新订单 paid/status）
create or replace function public.add_payment(
  p_org_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_payment_date date
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_order_org uuid;
  v_payment_id uuid;
begin
  if public.can_write_org(p_org_id) is false then
    raise exception 'No permission';
  end if;

  select org_id into v_order_org from public.sales_orders where id = p_order_id;
  if v_order_org is null then
    raise exception 'Order not found';
  end if;
  if v_order_org <> p_org_id then
    raise exception 'Order-org mismatch';
  end if;

  if p_amount <= 0 then
    raise exception 'Amount must be > 0';
  end if;

  insert into public.payments(org_id, sales_order_id, amount, payment_date)
  values (p_org_id, p_order_id, p_amount, p_payment_date)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- ========== 组织引导：第一次登录创建组织并把自己设为 owner ==========
create or replace function public.bootstrap_org(org_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_uid uuid;
  v_org_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 是否已有组织
  if exists (select 1 from public.org_members where user_id = v_uid) then
    return (select org_id from public.org_members where user_id = v_uid limit 1);
  end if;

  insert into public.organizations(name) values (org_name) returning id into v_org_id;

  insert into public.org_members(org_id, user_id, role) values (v_org_id, v_uid, 'owner');

  -- 如果 profiles 没有该用户，补一条（email 由前端注册时写入）
  insert into public.profiles(id, email)
  values (v_uid, coalesce((select email from public.profiles where id=v_uid), ''))
  on conflict (id) do nothing;

  return v_org_id;
end;
$$;

-- 获取我所在组织（用于前端判断）
create or replace function public.get_my_org()
returns table (id uuid, name text, created_at timestamptz)
language sql
security definer
as $$
  select o.id, o.name, o.created_at
  from public.organizations o
  join public.org_members m on m.org_id = o.id
  where m.user_id = auth.uid()
  order by o.created_at desc;
$$;

-- ========== 成员管理：通过邮箱添加成员 ==========
create or replace function public.add_member_by_email(p_org_id uuid, p_email text, p_role public.org_role)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
  v_target uuid;
  v_is_owner boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select (role = 'owner') into v_is_owner
  from public.org_members
  where org_id = p_org_id and user_id = v_uid;

  if coalesce(v_is_owner,false) is false then
    raise exception 'Only owner can add members';
  end if;

  select id into v_target from public.profiles where lower(email) = lower(p_email);
  if v_target is null then
    raise exception 'User not found. The user must sign up first.';
  end if;

  insert into public.org_members(org_id, user_id, role)
  values (p_org_id, v_target, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.list_org_members_with_profiles(p_org_id uuid)
returns table (user_id uuid, role public.org_role, email text, display_name text)
language sql
security definer
as $$
  select m.user_id, m.role, p.email, p.display_name
  from public.org_members m
  join public.profiles p on p.id = m.user_id
  where m.org_id = p_org_id
    and exists (select 1 from public.org_members me where me.org_id = p_org_id and me.user_id = auth.uid())
  order by (case when m.role='owner' then 0 else 1 end), p.email;
$$;


-- ========== 分红规则 ==========
create or replace function public.get_active_profit_rule(p_org_id uuid)
returns table (id uuid, org_id uuid, version_name text, working_capital_ratio numeric, effective_date date, created_at timestamptz)
language sql
security definer
as $$
  select *
  from public.profit_rules
  where org_id = p_org_id and effective_date <= current_date
  order by effective_date desc, created_at desc
  limit 1;
$$;

-- 创建分红规则并默认把份额100%给当前用户
create or replace function public.create_profit_rule_with_default_shares(
  p_org_id uuid,
  p_version_name text,
  p_working_capital_ratio numeric,
  p_effective_date date
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_uid uuid;
  v_is_owner boolean;
  v_rule_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select (role='owner') into v_is_owner from public.org_members where org_id=p_org_id and user_id=v_uid;
  if coalesce(v_is_owner,false) is false then raise exception 'Only owner can create rules'; end if;

  insert into public.profit_rules(org_id, version_name, working_capital_ratio, effective_date)
  values (p_org_id, p_version_name, p_working_capital_ratio, p_effective_date)
  returning id into v_rule_id;

  insert into public.profit_rule_shares(org_id, rule_id, user_id, ratio)
  values (p_org_id, v_rule_id, v_uid, 1);

  return v_rule_id;
end;
$$;

-- 归一化：把 shares 的 ratio 总和调整为1（按当前比例缩放）
create or replace function public.normalize_profit_shares(p_rule_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_org uuid;
  v_sum numeric;
begin
  select org_id into v_org from public.profit_rules where id = p_rule_id;
  if v_org is null then raise exception 'Rule not found'; end if;
  if public.can_write_org(v_org) is false then raise exception 'No permission'; end if;

  select coalesce(sum(ratio),0) into v_sum from public.profit_rule_shares where rule_id = p_rule_id;
  if v_sum <= 0 then
    raise exception 'No shares to normalize';
  end if;

  update public.profit_rule_shares
  set ratio = ratio / v_sum
  where rule_id = p_rule_id;
end;
$$;

-- ========== 看板 KPI（一次RPC返回多块数据） ==========
create or replace function public.working_capital_balance(p_org_id uuid)
returns numeric
language sql
security definer
as $$
  select coalesce(sum(case when type='income' then amount else -amount end),0)
  from public.working_capital_logs
  where org_id = p_org_id;
$$;

create or replace function public.dashboard_kpis(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_total_profit numeric;
  v_distributable numeric;
  v_receivables numeric;
  v_inventory_value numeric;
  v_wc numeric;
  v_profit_trend json;
  v_profit_by_material json;
begin
  if public.is_org_member(p_org_id) is false then
    raise exception 'No permission';
  end if;

  select coalesce(sum(profit),0) into v_total_profit from public.sales_orders where org_id=p_org_id;

  -- 可分利润：按每单回款比例计入（部分回款按比例）
  select coalesce(sum(
    case
      when revenue <= 0 then 0
      else profit * least(paid_amount / revenue, 1)
    end
  ),0) into v_distributable
  from public.sales_orders
  where org_id = p_org_id;

  select coalesce(sum(revenue - paid_amount),0) into v_receivables
  from public.sales_orders
  where org_id = p_org_id;

  select coalesce(sum(quantity_left * unit_cost),0) into v_inventory_value
  from public.inventory_batches
  where org_id = p_org_id;

  select public.working_capital_balance(p_org_id) into v_wc;

  -- 近30天利润趋势
  select json_agg(t) into v_profit_trend
  from (
    select to_char(day, 'MM-dd') as day, sum(profit) as profit
    from (
      select date_trunc('day', created_at)::date as day, profit
      from public.sales_orders
      where org_id=p_org_id and created_at >= now() - interval '30 days'
    ) s
    group by day
    order by day
  ) t;

  -- 按型号利润
  select json_agg(t) into v_profit_by_material
  from (
    select m.name as material, sum(o.profit) as profit
    from public.sales_orders o
    join public.materials m on m.id = o.material_id
    where o.org_id=p_org_id
    group by m.name
    order by sum(o.profit) desc
  ) t;

  return json_build_object(
    'kpi', json_build_object(
      'total_profit', v_total_profit,
      'distributable_profit', v_distributable,
      'receivables', v_receivables,
      'inventory_value', v_inventory_value,
      'working_capital_balance', v_wc
    ),
    'profit_trend', coalesce(v_profit_trend, '[]'::json),
    'profit_by_material', coalesce(v_profit_by_material, '[]'::json),
    'receivables', v_receivables
  );
end;
$$;

-- ========== Row Level Security（RLS） ==========
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.customers enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.sales_orders enable row level security;
alter table public.payments enable row level security;
alter table public.working_capital_logs enable row level security;
alter table public.profit_rules enable row level security;
alter table public.profit_rule_shares enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_lines enable row level security;

-- profiles：用户可读写自己的 profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.org_members me
    join public.org_members other on other.org_id = me.org_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  )
);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid());

-- org_members：成员可查看自己所在组织的成员列表（用于展示）
drop policy if exists "org_members_select_in_org" on public.org_members;
create policy "org_members_select_in_org" on public.org_members
for select using (
  exists (select 1 from public.org_members m2 where m2.org_id = org_members.org_id and m2.user_id = auth.uid())
);

-- organizations：组织成员可读组织
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member" on public.organizations
for select using (
  exists (select 1 from public.org_members m where m.org_id = organizations.id and m.user_id = auth.uid())
);

-- 通用函数：是否为该组织成员
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
as $$
  select exists(select 1 from public.org_members m where m.org_id=p_org_id and m.user_id=auth.uid());
$$;

-- 通用函数：是否可写（owner/editor）
create or replace function public.can_write_org(p_org_id uuid)
returns boolean
language sql
security definer
as $$
  select exists(select 1 from public.org_members m where m.org_id=p_org_id and m.user_id=auth.uid() and m.role in ('owner','editor'));
$$;

-- materials/customers/batches/orders/payments/wc/profit_rules/shares 等：成员可读，owner/editor可写
-- materials
drop policy if exists "materials_select" on public.materials;
create policy "materials_select" on public.materials
for select using (public.is_org_member(org_id));

drop policy if exists "materials_write" on public.materials;
create policy "materials_write" on public.materials
for insert with check (public.can_write_org(org_id));

drop policy if exists "materials_update" on public.materials;
create policy "materials_update" on public.materials
for update using (public.can_write_org(org_id));

drop policy if exists "materials_delete" on public.materials;
create policy "materials_delete" on public.materials
for delete using (public.can_write_org(org_id));

-- customers
drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers
for select using (public.is_org_member(org_id));

drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers
for insert with check (public.can_write_org(org_id));

drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers
for update using (public.can_write_org(org_id));

drop policy if exists "customers_delete" on public.customers;
create policy "customers_delete" on public.customers
for delete using (public.can_write_org(org_id));

-- batches
drop policy if exists "batches_select" on public.inventory_batches;
create policy "batches_select" on public.inventory_batches
for select using (public.is_org_member(org_id));

drop policy if exists "batches_write" on public.inventory_batches;
create policy "batches_write" on public.inventory_batches
for insert with check (public.can_write_org(org_id));

drop policy if exists "batches_update" on public.inventory_batches;
create policy "batches_update" on public.inventory_batches
for update using (public.can_write_org(org_id));

drop policy if exists "batches_delete" on public.inventory_batches;
create policy "batches_delete" on public.inventory_batches
for delete using (public.can_write_org(org_id));

-- orders
drop policy if exists "orders_select" on public.sales_orders;
create policy "orders_select" on public.sales_orders
for select using (public.is_org_member(org_id));

drop policy if exists "orders_write" on public.sales_orders;
create policy "orders_write" on public.sales_orders
for insert with check (public.can_write_org(org_id));

drop policy if exists "orders_update" on public.sales_orders;
create policy "orders_update" on public.sales_orders
for update using (public.can_write_org(org_id));

drop policy if exists "orders_delete" on public.sales_orders;
create policy "orders_delete" on public.sales_orders
for delete using (public.can_write_org(org_id));

-- payments
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
for select using (public.is_org_member(org_id));

drop policy if exists "payments_write" on public.payments;
create policy "payments_write" on public.payments
for insert with check (public.can_write_org(org_id));

drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments
for update using (public.can_write_org(org_id));

drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments
for delete using (public.can_write_org(org_id));

-- working_capital_logs
drop policy if exists "wc_select" on public.working_capital_logs;
create policy "wc_select" on public.working_capital_logs
for select using (public.is_org_member(org_id));

drop policy if exists "wc_write" on public.working_capital_logs;
create policy "wc_write" on public.working_capital_logs
for insert with check (public.can_write_org(org_id));

drop policy if exists "wc_update" on public.working_capital_logs;
create policy "wc_update" on public.working_capital_logs
for update using (public.can_write_org(org_id));

drop policy if exists "wc_delete" on public.working_capital_logs;
create policy "wc_delete" on public.working_capital_logs
for delete using (public.can_write_org(org_id));

-- profit_rules
drop policy if exists "pr_select" on public.profit_rules;
create policy "pr_select" on public.profit_rules
for select using (public.is_org_member(org_id));

drop policy if exists "pr_write" on public.profit_rules;
create policy "pr_write" on public.profit_rules
for insert with check (public.can_write_org(org_id));

drop policy if exists "pr_update" on public.profit_rules;
create policy "pr_update" on public.profit_rules
for update using (public.can_write_org(org_id));

drop policy if exists "pr_delete" on public.profit_rules;
create policy "pr_delete" on public.profit_rules
for delete using (public.can_write_org(org_id));

-- shares
drop policy if exists "prs_select" on public.profit_rule_shares;
create policy "prs_select" on public.profit_rule_shares
for select using (public.is_org_member(org_id));

drop policy if exists "prs_write" on public.profit_rule_shares;
create policy "prs_write" on public.profit_rule_shares
for insert with check (public.can_write_org(org_id));

drop policy if exists "prs_update" on public.profit_rule_shares;
create policy "prs_update" on public.profit_rule_shares
for update using (public.can_write_org(org_id));

drop policy if exists "prs_delete" on public.profit_rule_shares;
create policy "prs_delete" on public.profit_rule_shares
for delete using (public.can_write_org(org_id));

-- settlements (预留)
drop policy if exists "sett_select" on public.settlements;
create policy "sett_select" on public.settlements
for select using (public.is_org_member(org_id));

drop policy if exists "sett_write" on public.settlements;
create policy "sett_write" on public.settlements
for insert with check (public.can_write_org(org_id));

-- settlement_lines
drop policy if exists "settline_select" on public.settlement_lines;
create policy "settline_select" on public.settlement_lines
for select using (public.is_org_member(org_id));

drop policy if exists "settline_write" on public.settlement_lines;
create policy "settline_write" on public.settlement_lines
for insert with check (public.can_write_org(org_id));

-- 允许 RPC 函数被 anon/auth 调用（Supabase 默认 security definer 仍需 grants）
grant usage on schema public to anon, authenticated;
grant execute on function public.get_my_org() to anon, authenticated;
grant execute on function public.bootstrap_org(text) to anon, authenticated;
grant execute on function public.create_sales_order(uuid,uuid,uuid,uuid,numeric,numeric,text) to anon, authenticated;
grant execute on function public.add_payment(uuid,uuid,numeric,date) to anon, authenticated;
grant execute on function public.dashboard_kpis(uuid) to anon, authenticated;
grant execute on function public.working_capital_balance(uuid) to anon, authenticated;
grant execute on function public.add_member_by_email(uuid,text,public.org_role) to anon, authenticated;
grant execute on function public.list_org_members_with_profiles(uuid) to anon, authenticated;
grant execute on function public.get_active_profit_rule(uuid) to anon, authenticated;
grant execute on function public.create_profit_rule_with_default_shares(uuid,text,numeric,date) to anon, authenticated;
grant execute on function public.normalize_profit_shares(uuid) to anon, authenticated;
