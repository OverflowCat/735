# cabcal-jurlegi — 735 工厂监控前端

工厂辐射监测平台的前端界面，监控 γ 剂量率监测仪、空气测氡仪等设备。

## 技术栈

- Svelte 5 + TypeScript
- Vite
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

## 数据源

前端通过 `DeviceDataSource` 接口访问数据，当前实现为 `HttpDeviceDataSource`，调用后端 REST API：

```
GET  /api/v1/devices
GET  /api/v1/devices/:id
GET  /api/v1/devices/:id/history?metric=xxx&range=15m|1h|24h|7d
```

后端不可用时显示明确标注的演示数据；连接成功后，以后端读数替换演示数据。已登记但 API 未返回的设备显示“未上报”，不补演示测值。

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
pnpm run check
pnpm run build
```

可选浏览器回归需本机已安装 Playwright 和 Chromium，并运行开发或预览服务：

```bash
node tests/map-browser.mjs
```

可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径，`CHROMIUM_PATH` 指定浏览器，`MAP_TEST_URL` 指向本地服务，`MAP_SCREENSHOT` 保存截图。该检查会拦截 API 返回固定测试数据，不访问现场设备。
