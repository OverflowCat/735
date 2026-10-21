# 735 Backend — 监控平台后端

工厂辐射监测平台的 Rust 后端，提供 REST API 并轮询现场设备（RMS-2000 γ剂量率监测仪、HS05G 空气测氡仪）。

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
| `--gamma <host:port>` | — | γ 剂量率仪串口隧道 TCP 地址（可重复传多个） |
| `--gamma-addr` | `1` | RMS-200 显示单元地址（0~FF） |
| `--gamma-interval` | `30` | γ 轮询间隔（秒） |
| `--gamma-name` | `γ剂量率监测仪` | 设备显示名称 |
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

### γ 剂量率监测仪（RMS-2000 显示单元）

- 协议：RMS-200 / RMS-2000 显示单元（带地址）与上位机通讯协议（见 `/home/user/735/RMS-200.txt`）
- 读实时剂量率：`1D 01 <addr> <check>` → `1E <m0 m1 exp> <更新标志> <addr> <check>`
- 3 字节科学计数法：前 2 字节基数（mantissa/1000），第 3 字节 10 的指数；单位 nGy/h
- 校验：前序字节累加和取低字节
- 驱动：`src/gamma.rs`，轮询：`src/gamma_poller.rs`
- HS05G **不是** gamma 协议，见下方氡仪

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
  gamma.rs          # RMS-2000 γ 剂量率仪 TCP 串口客户端
  gamma_poller.rs   # γ 剂量率仪轮询器
  hs05g_poller.rs   # HS05G 氡仪轮询器
```

## 运行测试

```bash
cargo test
```
