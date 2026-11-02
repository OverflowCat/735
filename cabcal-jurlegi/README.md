# cabcal-jurlegi — 735 工厂监控前端

工厂辐射监测平台的前端界面，监控 γ 剂量率监测仪、空气测氡仪等设备。

## 技术栈

- Svelte 5 + TypeScript
- Vite
- Carbon Design System（`carbon-components-svelte` + `carbon-icons-svelte`，Gray 100 主题）
- Apache ECharts（历史趋势 / 对比图）
- Three.js（3D 工厂视图）

## 快速开始

```bash
npm install
npm run dev        # 开发模式 → http://localhost:5173
```

前端默认请求 `http://localhost:3000/api/v1`。如后端地址不同，设置环境变量：

```bash
VITE_API_BASE=http://192.168.1.10:3000 npm run dev
```

## 构建

```bash
npm run check      # 类型检查
npm run build      # 生产构建 → dist/
npm run preview    # 预览构建产物
```

## 页面

| 路由 | 说明 |
|------|------|
| `/map` | 工厂地图（默认主页），2D/3D 视图，设备位置、实时测量、报警状态 |
| `/overview` | 总览页，设备统计、可搜索设备表、多设备趋势对比 |

## 主要功能

- **2D 工厂地图**：厂区总览进入 C19、C35、C3、过滤厂房或水冶厂；室内采用 PDF 导出的图片底图，水冶厂支持一至四楼切换
- **总览设备展示**：单层且不超过 6 个点位的厂房直接显示设备和测量值；多楼层或密集厂房使用旁边的悬浮列表。列表按楼层分组，支持滚轮上下浏览、拖动标题移动、点击设备查看详情；窗口位置保存在当前浏览器，可用标题栏的恢复按钮复位。
- **3D 工厂视图**：Three.js 简单几何体，与 2D 共用同一场景坐标模型
- **设备抽屉**：点击设备打开侧边栏，显示详情、报警、ECharts 历史趋势
- **地图编辑模式**：按当前区域 / 楼层拖拽、移除、重新放置、撤销和重置设备位置（仅 2D）；同位置 γ / 氡共用安装锚点
- **多设备对比**：选择指标、时间范围、多台设备叠加趋势图

## 目录结构

```
src/
  routes/           # 页面（map / overview）
  lib/
    components/     # UI 组件（map / device / charts / overview / three）
    services/       # DeviceDataSource 抽象层 + HttpDeviceDataSource
    state/          # 全局应用状态（Svelte 5 runes）
    types/          # 协议与领域类型
    data/mock/      # 未连接后端时的演示读数与厂区示意几何
    data/floorplans/ # 图纸裁剪、安装点位、配置台账与地图目录
```

## 界面设计

应用使用 Carbon Svelte 的 Header、ContentSwitcher、Button、Tile、DataTable、Search、Select、Checkbox、NumberInput、TextInput、Tag 和通知组件。导航、状态、设备详情和编辑操作使用 Carbon 图标，并保留简体中文标签和可访问名称。主题在 `src/main.ts` 统一加载，地图和 ECharts 使用配套的 Carbon 色板；室内原始图纸与安装坐标保留。SVG 与 Three.js 的厂区展示色板共用 `map-theme.ts`。

设备列表支持排序、搜索和打开详情；趋势对比最多选择 6 台同类型设备，切换指标清空选择，取消过期请求，加载失败显示提示。设备详情保留历史分批加载与重试。

## 数据源

前端通过 `DeviceDataSource` 接口访问数据，当前实现为 `HttpDeviceDataSource`，调用后端 REST API：

```
GET  /api/v1/devices
GET  /api/v1/devices/:id
GET  /api/v1/devices/:id/history?metric=xxx&range=15m|1h|24h|7d
```

后端不可用时显示明确标注的演示数据；连接成功后，以后端读数替换演示数据。已登记但 API 未返回的设备显示“未上报”，不补演示测值。

页面每 5 秒拉取设备数据，后台标签页暂停定时请求，重新可见或获得焦点时立即刷新。设备请求禁用缓存，10 秒超时，避免请求重叠。连接成功后若刷新失败，保留上次现场读数并显示“刷新失败”，恢复连接后自动更新；悬停数据状态可查看上次同步时间。同步时间表示浏览器成功读取 API 的时间，仪器测量时间见设备详情“最后更新”。

设备详情历史趋势按时间分批查询，先加载所选区间末尾 15 分钟，再向前扩展，单批最多一天。首批返回就显示图表和进度，后续批次追加；切换设备/区间或关闭详情会取消旧请求。实时设备轮询不会重启历史加载。后续批次失败保留已加载点并可重试，单批请求 15 秒超时。所有批次使用同一个固定结束时间，按时间排序并去重，不使用模拟历史数据。

## 平面图与设备配置

`../devices.json` 是清单设备的 ID、名称与氡配对来源，构建时直接导入。旧 20 台 γ 通过 `data/floorplans/inventory.ts` 的 IP / `gamma_XX` 映射关联资产号，旧总线氡配对按 2026-10-30 现场记录校正（`.16` 为氡36，暂无上报）；配置中的显式配对优先。生产参数顺序改变时，需要同步旧 ID 映射。采集配置调整后重新构建前端。

PNG 底图在 `public/floorplans/`，坐标与裁剪框在 `src/lib/data/floorplans/plans.json`。原 PDF 保存在 `../pmt/`。使用 Ghostscript 和 Pillow 可重复生成八张底图：

```bash
python3 scripts/export-floorplans.py
```

坐标以 110 dpi 的原 PDF 渲染为基准，脚本输出两倍分辨率 PNG；仅清理点位圆圈和编号，保留墙体、门及房间信息。各图使用独立坐标，未来可替换 SVG 底图。

编辑覆盖按地图和版本保存到当前浏览器的 `cabcal-floorplan-layouts-v2`，当前地图保存在 `cabcal-active-map-v2`。旧 `cabcal-factory-scene-v1` 和旧 backend `/scene` 的全厂坐标不用于新楼层图，原数据保留。此阶段不向后端保存图纸布局；需要多终端共享时再扩展场景接口。

## 验证

```bash
pnpm run test:maps  # 清单映射、缺少上报、分图存储、版本及损坏缓存
pnpm run test:history  # 分批时间覆盖、顺序、取消与部分失败
pnpm run check
pnpm run build
```

可选浏览器回归需本机已安装 Playwright 和 Chromium，并运行开发或预览服务：

```bash
node tests/map-browser.mjs
node tests/live-refresh-browser.mjs  # 自动刷新、断线恢复、请求去重与超时
node tests/history-browser.mjs  # 分批显示、自定义时间、历史与实时隔离、取消和重试
node tests/carbon-browser.mjs  # Carbon 导航、搜索/详情、对比选择和响应式布局
```

可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径，`CHROMIUM_PATH` 指定浏览器，`MAP_TEST_URL` 指向本地服务，`MAP_SCREENSHOT` 保存截图。该检查会拦截 API 返回固定测试数据，不访问现场设备。
