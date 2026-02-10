# Plastic Trade Dashboard (v1)

这是一个面向“塑料原料贸易”场景的轻量经营系统（MVP），支持：
- 多客户管理
- 入库批次管理（自动计算成本/库存）
- 开单出库（选择批次，自动扣库存与利润计算）
- 回款记录（支持部分回款）
- 分红规则版本化（按生效日期）
- 流动资金账本
- 可视化看板（利润/库存/应收）
- 多设备实时同步（Supabase Realtime）
- CSV 导出（Excel 可直接打开）

> 部署方式：GitHub + Vercel（前端） + Supabase（数据库/登录/实时）。

## 本地启动
1. 安装 Node.js 18+
2. `npm install`
3. 复制 `.env.example` 为 `.env.local`，填入 Supabase 参数
4. `npm run dev`

## 部署
请看 `docs/DEPLOY_GUIDE.md`
