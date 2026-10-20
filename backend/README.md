# 735 Backend — 监控平台后端

工厂辐射监测平台的 Rust 后端，提供 REST API 并轮询现场设备（γ 能谱仪、HS05G 空气测氡仪）。

## 技术栈

- Rust / Tokio
- Axum（HTTP REST API）
- serde / serde_json

## 快速开始

```bash
cargo build
cargo run -- \
  --listen 0.0.0.0:3000 \
  --gamma 192.168.1.200:4000 \
  --hub 192.168.1.50:5000 \
  --station STATION-01
```

## CLI 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--listen` | `0.0.0.0:3000` | HTTP API 监听地址 |
| `--gamma <host:port>` | — | γ 能谱仪 TCP 地址（可重复传多个） |
| `--gamma-interval` | `30` | γ 轮询间隔（秒） |
| `--gamma-name` | `γ能谱仪` | 设备显示名称 |
| `--hub <host:port>` | — | HS05G 氡仪 hub 地址（可重复传多个） |
| `--hub-interval` | `30` | HS05G 轮询间隔（秒） |
| `--station` | `STATION-01` | 站点标识 |

## REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/devices` | 设备列表 |
| GET | `/api/v1/devices/:id` | 单个设备详情 |
| GET | `/api/v1/devices/:id/history?metric=&range=` | 历史趋势（range: `15m`/`1h`/`24h`/`7d`） |
| GET | `/api/v1/scene` | 工厂场景 |
| PUT | `/api/v1/scene` | 保存工厂场景 |
| POST | `/api/v1/monitor/data` | 实时数据上报（protocol.typ §2.2） |
| POST | `/api/v1/device/heartbeat` | 设备心跳（protocol.typ §2.3） |

## 设备接入

### γ 能谱仪（GammaSpectrometer）

- 协议：TCP/IP，文本命令 + 二进制帧双协议
- 能谱读取：`#READ_SPECTRUM\r\n`（文本）
- 结果读取：二进制帧 `0x9090`（剂量率 + 核素识别）
- 驱动：`src/gamma.rs`，轮询：`src/gamma_poller.rs`

### HS05G 空气测氡仪

- 协议：TCP，128 字节数据包（15 节点）
- 驱动：`../hs05g/` crate，轮询：`src/hs05g_poller.rs`

## 存储

当前使用内存存储（`MemoryStore`），重启后数据丢失。

存储接口定义在 `src/store/mod.rs` 的 `DeviceStore` trait，后续可替换为 fjall 等持久化实现，无需修改 API 层。

## 目录结构

```
src/
  main.rs           # 入口，CLI + 启动 HTTP 服务 + 设备轮询
  model.rs          # 领域类型（Device / MetricData / Scene 等，camelCase JSON）
  api/              # REST API 处理器
  store/            # 存储抽象（DeviceStore trait + MemoryStore）
  gamma.rs          # γ 能谱仪 TCP 客户端
  gamma_poller.rs   # γ 能谱仪轮询器
  hs05g_poller.rs   # HS05G 氡仪轮询器
```

## 运行测试

```bash
cargo test
```
