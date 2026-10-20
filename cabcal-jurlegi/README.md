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

- **2D 工厂地图**：SVG 场景，显示区域、墙体、设备位置与实时测量值
- **3D 工厂视图**：Three.js 简单几何体，与 2D 共用同一场景坐标模型
- **设备抽屉**：点击设备打开侧边栏，显示详情、报警、ECharts 历史趋势
- **地图编辑模式**：拖拽设备位置、添加/移除放置、编辑场景对象（仅 2D）
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
    data/mock/      # 旧 mock 数据（已不使用，仅保留参考）
```

## 数据源

前端通过 `DeviceDataSource` 接口访问数据，当前实现为 `HttpDeviceDataSource`，调用后端 REST API：

```
GET  /api/v1/devices
GET  /api/v1/devices/:id
GET  /api/v1/devices/:id/history?metric=xxx&range=15m|1h|24h|7d
GET  /api/v1/scene
PUT  /api/v1/scene
```

后端不可用时页面会报错（不会显示 mock 假数据）。
