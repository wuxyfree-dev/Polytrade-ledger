# 部署指引（零代码小白版）

你只需要照着做，完全不需要写代码。

---

## 0. 你会得到什么？
- 一个可以公网访问的网址（例如：https://xxx.vercel.app）
- 你在不同设备登录同一个网址，会看到最新数据（Supabase Realtime）
- 你可以给合伙人开权限：viewer（只看）/ editor（可录入）
- 订单、回款、库存、分红比例、流动资金都能用

---

## 1) 创建 Supabase（数据库 + 登录 + 实时）
1. 打开 Supabase（官网），注册并登录
2. New project → 创建一个项目（记住 Project name）
3. 进入项目后：左侧 **SQL Editor** → 新建 query
4. 复制并执行：`supabase/schema.sql` 全部内容
5. 左侧 **Project Settings → API**
   - 复制 `Project URL` → 填到环境变量 `NEXT_PUBLIC_SUPABASE_URL`
   - 复制 `anon public` key → 填到环境变量 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. 左侧 **Database → Replication**
   - 打开 Realtime（把这些表加入 replication）：`sales_orders`, `inventory_batches`, `payments`, `working_capital_logs`

> 注意：Realtime 配置界面可能有变化，但核心就是：允许这些表的变更事件推送。

---

## 2) 把代码放到 GitHub
1. 在 GitHub 创建一个新仓库（Repo）
2. 把本项目全部文件上传到仓库根目录（建议直接用 GitHub 网页上传 ZIP 解压，或用 Git 客户端）
3. 确保仓库里能看到 `package.json` / `app/` / `supabase/`

---

## 3) 用 Vercel 一键上线（推荐）
1. 打开 Vercel，注册/登录（可用 GitHub 授权）
2. New Project → 选择你的 GitHub repo → Import
3. 在 Environment Variables 里添加：
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
4. Deploy → 等待部署完成
5. 你会得到一个公网网址

---

## 4) 第一次使用
1. 打开你的网址 → 注册账号（邮箱/密码）
2. 登录后会提示你创建“组织（生意）”
3. 创建后即可：
   - 先建：塑料型号库、客户
   - 再录：入库批次
   - 开单出库：系统自动扣库存、算利润
   - 回款记录：支持部分回款
   - 分红规则：先建一个默认规则
   - 成员：让合伙人先注册，再用邮箱加他

---

## 5) 常见问题（你可能会遇到）
### Q1：合伙人看不到数据？
- 确保他 **先注册**（有 profile）
- 你在「成员/合伙人」里用邮箱添加
- 角色设为 viewer/editor

### Q2：看板不更新？
- 确认 Supabase 的 Realtime 已打开，并把表加入 replication
- 刷新页面验证

### Q3：我想导出 Excel
- 页面右上角有“导出CSV”
- CSV 用 Excel 打开即可（Excel 能识别）

---

如果你卡住了：
把你卡在哪一步的截图发我，我就按你这个页面一步一步带你走。
