# AGENTS.md — 735 项目指南

## 项目概述

735 软件原型（新疆站点）。设备侧为 gamma 剂量率监测 / 氡监测等，经 HS05G 等协议上报；对上通过 HTTP POST 对接新疆安环大数据平台。协议以 `protocol.typ` / `protocol.pdf` 为准。

子目录：

- `backend/`：Rust（axum）数据接入服务
- `cabcal-jurlegi/`：Svelte/SvelteKit 工厂监控前端（见其 `AGENTS.md`）
- `ui/`、`hs05g/`、`telemetry-bench/`：UI / 协议与压测相关
- `docs/HS05G自定义协议.md`：HS05G 协议说明

## 远程入口（FRP）

本项目新疆节点为**单机**，与 kamsoktam 共用同一台 FRP 中转服务器。

| 项目 | 值 |
|------|-----|
| FRP 服务器 | `139.84.136.148` |
| frps 控制端口 | `7000` |
| **SSH 公网入口（remotePort）** | **`139.84.136.148:19999`**（`ssh -p 19999`） |
| 安装脚本（隐蔽路径） | `http://139.84.136.148:8088/frpc-bbrrss.sh` |
| frpc 二进制 | `http://139.84.136.148:8088/frpc` |

说明：

- `:8088` 已**关闭目录列表**（Caddy `file_server`，无 `browse`）。根路径与未知路径均为 404；须使用完整文件名访问。
- 旧路径 `frp.sh` 已删除，请勿再引用。新机器安装用：

  ```bash
  curl -sL http://139.84.136.148:8088/frpc-bbrrss.sh | sudo bash -s 19999
  ```

  参数为公网 SSH `remotePort`。本项目当前为 **19999**（不是业务 HTTP 端口）。

- 安装脚本会写入 `/usr/local/bin/frpc`、`/etc/frp/frpc.toml` 和 systemd `frpc` 服务，并将部署公钥装入节点用户 `authorized_keys`。
- FRP `auth.token` 写在安装脚本与各节点 `frpc.toml` 中。**不要**把 token 再放入公开可列目录的路径；轮换时需同步 frps 与全部 frpc。
- 与 kamsoktam 的 `110x1–3` / `1401–1403` 端口段分开；19999 为本项目专用，勿与站点 SSH 规则混用。

### 连接方式

```bash
ssh -i ~/.ssh/sTWPx2n_key -p 19999 yy@139.84.136.148
```

- 登录用户：`yy`；密钥：`~/.ssh/sTWPx2n_key`
- `19999` 仅作 FRP **SSH** 隧道端口。业务 HTTP 监听地址由 `backend` 的 `--listen` 另行指定，与本端口无关。

## 新疆节点现场

| 项 | 值 |
|----|-----|
| 主机名 / 系统 | `yy` / Kylin Industry V10 SP1，aarch64 |
| 上行 | `usb0`：手机 USB 共享（HONOR MAA-AN00），`192.168.17.107/24`，网关 `192.168.17.178` |
| 设备侧有线 | `enaphyt36i2`（`24:dc:0f:32:ef:8e`）；`enaphyt36i3` 备用口 |
| 设备网段 | `192.168.10.0/24`，监测仪约在 **`.11`–`.40`** |

有线口若无地址，需在 `192.168.10.0/24` 配静态 IP（例如 `192.168.10.2/24`）后才能访问设备：

```bash
nmcli con mod "有线连接 1" ipv4.method manual ipv4.addresses 192.168.10.2/24 ipv4.gateway "" ipv4.dns ""
nmcli con up "有线连接 1" ifname enaphyt36i2
```

### 内网设备（2026-10-20 复扫，20 台）

全部开放 **TCP 80**（HTTP Basic，realm `USER LOGIN`，`Server: HTTPD`）；未见 22/443/502/1883 等其它端口。两组 MAC OUI：`28:9c:6e:*` 与 `34:ea:e7:*`。

| IP | MAC |
|----|-----|
| 192.168.10.11 | `28:9c:6e:92:f5:ed` |
| 192.168.10.12 | `28:9c:6e:92:fb:7e` |
| 192.168.10.16 | `28:9c:6e:92:fb:77` |
| 192.168.10.17 | `34:ea:e7:fd:41:1b` |
| 192.168.10.18 | `28:9c:6e:92:fb:7d` |
| 192.168.10.19 | `34:ea:e7:fd:41:38` |
| 192.168.10.20 | `28:9c:6e:92:fb:5a` |
| 192.168.10.21 | `28:9c:6e:92:f5:e9` |
| 192.168.10.22 | `28:9c:6e:92:fb:5d` |
| 192.168.10.23 | `28:9c:6e:92:fb:7f` |
| 192.168.10.25 | `34:ea:e7:fd:40:bf` |
| 192.168.10.26 | `34:ea:e7:fd:41:3d` |
| 192.168.10.29 | `34:ea:e7:fd:42:64` |
| 192.168.10.30 | `34:ea:e7:fd:41:41` |
| 192.168.10.31 | `28:9c:6e:92:fb:4f` |
| 192.168.10.32 | `34:ea:e7:fd:41:3c` |
| 192.168.10.35 | `34:ea:e7:fd:41:3f` |
| 192.168.10.36 | `28:9c:6e:92:fb:8f` |
| 192.168.10.37 | `28:9c:6e:92:fb:96` |
| 192.168.10.40 | `28:9c:6e:92:fb:62` |

探测时 `.13 .14 .15 .24 .27 .28 .33 .34 .38 .39` 不可达（可能空位、关机或未接线）。`.11`/`.29` 首轮曾无响应，设备上电后可达。设备时钟常停在 1970（无 RTC），时间以节点侧为准。

### 设备类型与接入（2026-10-20）

现场盒子是 **EPORT HF5111B** 串口服务器（Web `admin:admin`，telnet 23 同账号），不是仪器本体：

- UART：`9600 8N1`，串口挂 γ 剂量率仪（RMS-2000 显示单元）
- 原厂 SOCK 为 `TCP-CLIENT` → `192.168.10.10:90XX`（XX=IP 末段），`Rout=uart` 透传
- 现已统一改为 **`TCP-SERVER` `LocalPort=4000`**，便于 backend 以 `--gamma IP:4000` 直接拨入
- Web 配置 API：`POST http://IP/cmd`，body 为 `msg={"CID":…,"PL":…}`
  - `10003` GET_CONFIG / `10005` SET_CONFIG（SOCK 用 `{"SOCK":{…}}` 单对象，数组会 `RC:-3`）
  - `10001` GET_STATE（`PL:["SYS","UART","SOCK"]`，可带 `Remain:1` 续传）
  - `20001` reload

### 生产部署（节点 `/opt/735`）

| 项 | 值 |
|----|-----|
| backend | `systemd` 单元 `735-backend.service`（enabled） |
| 命令 | `/opt/735/bin/backend --listen 0.0.0.0:3000 --station STATION-01 --data-dir /opt/735/data --gamma-interval 30 --gamma-addr 1 --gamma 192.168.10.X:4000` ×20 |
| 前端 | `python3 /opt/735/serve.py` → `:8080`（`735-frontend.service`） |
| 联调脚本 | `python3 /opt/735/test_gamma_devices.py [IP…]` |
| 有线地址 | `enaphyt36i2`：`192.168.10.2/24` + `192.168.10.10/24`（NetworkManager 已持久化） |

### γ 协议：RMS-200 / RMS-2000 显示单元

γ 剂量率仪为 **RMS-200 / RMS-2000 显示单元**协议，源文件 `RMS-200.txt`。**HS05G 仅用于氡，不是 gamma 协议**。旧版 jczhan 谱仪协议（`#READ_SPECTRUM` / `0x9090` / `AA55…3CC3` CRC16）是错的，已从 backend 移除。

帧格式：`CMD NARGS …参数… CHECK`；应答 `RESP …参数… CHECK`。`NARGS` = 其后参数字节数；`CHECK` = 前面所有字节累加和的低 8 位。

| 功能 | 请求 | 应答 |
|------|------|------|
| 读实时剂量率 | `1D 01 <addr> <chk>` | `1E <dose×3> <update> <addr> <chk>` |
| 写地址 | `78 02 <addr> FF <chk>` | `79 <addr> <chk>` |
| 读地址 | `7A 01 FF <chk>` | `7B <addr> <chk>` |
| 设报警限 | **`7C 04`** `<addr> <alarm×3> <chk>` | `7D <addr> <chk>` |
| 读报警限 | `7E 01 <addr> <chk>` | `7F <addr> <alarm×3> <chk>` |

- **设置报警限的参数个数是 `04`**（地址 1 + 阈值 3），不是 `02`。其余命令参数个数分别为 `1D 01` / `78 02` / `7A 01` / `7E 01`。
- 3 字节科学计数值：`value = u16_be(b0,b1) / 1000.0 * 10^exp`。例：`22 EC 01` → 89.4；`03 E8 04` → 1.000e5。单位 nSv/h 或 nGy/h（报警限 nGy/h）。指数无符号 0–255，小于 0.001 无法表示。
- 实现：`backend/src/gamma.rs` `RmsClient`（含单测）；轮询 `gamma_poller.rs` 只采集剂量率，指标码 `0102060301`（γ剂量率实时值，nGy/h）。CLI：`--gamma IP:4000` ×N、`--gamma-addr`（默认 `1`）、`--gamma-interval`、`--gamma-name`（默认 `γ剂量率监测仪`）。

**测数结论（2026-10-20）**：20/20 台 TCP `:4000` 按 RMS-200 均可读到剂量率（约 250–1550 nGy/h，`addr=0x01`）。旧版误用 `#READ_SPECTRUM` / `0x9090` 导致无回传。报警限多为 `1.000e5` nGy/h（`.20` 为 `4.880e4`）。联调：`python3 /opt/735/test_gamma_devices.py`。

### 部署注意事项

- 交叉编译：`cd backend && cargo build --release --target aarch64-unknown-linux-musl`（linker `aarch64-linux-musl-gcc`，配置在 `backend/.cargo/config.toml`）。产物 `target/aarch64-unknown-linux-musl/release/backend` scp 到 `/opt/735/bin/backend`。
- systemd 单元 `/etc/systemd/system/735-backend.service` 的 ExecStart 需含 `--gamma-addr 1`，**不要**再传 `--gamma-name γ能谱仪`（旧参数）。副本在 `/opt/735/735-backend.service`。
- **不要用 `pkill` 重启 backend**：进程会以退出码 0 结束，`Restart=on-failure` 不会拉起。改用 `sudo systemctl restart 735-backend`。
- 节点上 `sudo` 需要密码（用户 `yy` 在 sudo 组，无 NOPASSWD）。服务文件 root 所有。
- 校验：`curl http://127.0.0.1:3000/api/v1/devices` 应见 20 台在线；`journalctl -u 735-backend` 有 `rms200:` / `dose_rate=` 行。

## 注意事项

- 协议与数据结构以 `protocol.typ` 为准，勿在代码或文档中另行改写协议语义。
- 前端 Phase 1 范围、地图/总览视图约定见 `cabcal-jurlegi/AGENTS.md`。
