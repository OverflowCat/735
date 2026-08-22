#set document(title: "735通信协议", author: "北京博瑞赛科技有限责任公司")
#set page(paper: "a5", margin: (x: 1.2cm, y: 1.2cm), numbering: "1")
#set text(size: 10.5pt, lang: "zh")
#set heading(numbering: "1.1")
#set par(justify: true, leading: 0.65em)

#show raw.where(block: true): it => block(
  fill: rgb("#f4f4f4"), inset: 8pt, radius: 3pt, width: 100%,
  text(font: "DejaVu Sans Mono", size: 9pt, it)
)

#let accent = rgb("#1f6feb")
#let accent-light = rgb("#eaf3ff")
#let stripe = rgb("#f6f8fa")

#let ztable(columns: none, align: none, header: none, rows) = table(
  columns: columns,
  stroke: 0.5pt + rgb("#d0d7de"),
  fill: (x, y) => if y == 0 { accent } else if calc.even(y) { stripe } else { white },
  table.header(..header.map(c => text(fill: white, weight: "bold", c))),
  ..rows
)

#let callout(
  title: "注意",
  color: rgb("#fff8e1"),
  bar: rgb("#e0a800"),
  body,
) = block(
  fill: color,
  stroke: (left: 3pt + bar),
  inset: 10pt,
  radius: 4pt,
  width: 100%,
)[
  #text(weight: "bold", fill: bar)[#title]
  #linebreak()
  #body
]

#align(center)[
  #text(size: 13pt, weight: "bold")[数据通信协议设计说明书]
  #v(0.6em)
  #text(size: 10pt)[版本：V1.0#v(1em)北京博瑞赛科技有限责任公司]
]

#v(1em)
#line(length: 100%, stroke: 0.6pt)

== 概述

系统数据通信分为两个方向：

- *上行（本地 → 平台）*：γ剂量率、氡及子体浓度等实时/历史监测数据、设备状态、报警事件。
- *下行（平台 → 本地）*：报警阈值参数下发、通风联动指令（启/停、手动/自动切换）、远程校准与设备管理指令。

== 常数约定

#ztable(
  columns: (auto, 1fr, 1fr),
  align: (center, left, left),
  header: ([常数], [名称], [说明]),
  (
    [`0102060301`], [γ剂量率实时值], [区域γ剂量率监测仪采集值],
    [`0102060301-LowValue`], [γ剂量率低值报警阈值], [可远程读写],
    [`0102060301-UpValue`], [γ剂量率高值报警阈值], [可远程读写],
    [`0102060302`], [氡及子体浓度实时值], [空气测氡仪采集值],
    [`0102060302-LowValue`], [氡浓度低值报警阈值], [可远程读写],
    [`0102060302-UpValue`], [氡浓度高值报警阈值], [可远程读写],
    [`0201000001`], [通风系统启动指令], [下行控制],
    [`0201000002`], [通风系统停止指令], [下行控制],
    [`0201000003`], [通风系统模式切换], [0=手动 1=自动],
    [`CTime`], [采样周期], [γ默认30s，氡默认1800s],
    [`DevStatus`], [设备运行状态], [0=离线 1=在线 2=故障],
  )
)

#pagebreak()

= 协议一：Modbus 协议（RTU / TCP）

== 通信架构示意图

#grid(
  columns: (1fr, auto, 1fr, auto, 1fr),
  align: horizon + center,
  column-gutter: 6pt,

  box(
    stroke: 1pt + accent,
    radius: 4pt,
    inset: 10pt,
    fill: accent-light,
    width: 100%,
  )[
    *现场探测设备*\
    γ探头 / 氡探测器
  ],

  align(center)[
    #sym.arrow.r.long \
    #text(size: 8pt)[RS-485\ Modbus RTU]
  ],

  box(
    stroke: 1pt + accent,
    radius: 4pt,
    inset: 10pt,
    fill: accent-light,
    width: 100%,
  )[
    *现场网关*\
    工控机 / 网关
  ],

  align(center)[
    #sym.arrow.r.long \
    #text(size: 8pt)[以太网\ Modbus TCP]
  ],

  box(
    stroke: 1pt + accent,
    radius: 4pt,
    inset: 10pt,
    fill: accent-light,
    width: 100%,
  )[
    *新疆安环平台*\
    Modbus TCP Master
  ],
)

#v(0.5em)

#callout(title: "主从关系")[
  平台侧作为 Modbus TCP *主站（Master）*，现场网关侧作为 *从站（Slave）*；现场网关同时作为 Modbus RTU 主站，轮询下挂的探测设备。下行指令通过网关在 RTU 侧转发执行。
]

== 传输层参数

#ztable(
  columns: (auto, 1fr),
  header: ([参数], [取值]),
  (
    [传输方式], [Modbus TCP（现场网关—平台）／Modbus RTU（现场设备—网关，沿用RS485总线）],
    [端口], [TCP 502（默认，可协商变更）],
    [从站地址], [每台监测主机/网关分配唯一 Slave ID，范围 1~247],
    [数据格式], [16位寄存器，大端序（Big-Endian）；浮点量采用IEEE754双寄存器表示],
    [校验], [RTU 段：CRC-16；TCP 段：MBAP报文头自带事务标识],
  )
)

== 寄存器地址映射

#ztable(
  columns: (auto, auto, 1fr, auto, auto),
  align: (center, center, left, center, center),
  header: (
    [寄存器地址],
    [类型],
    [内容],
    [数据类型],
    [读写权限],
  ),
  (
    [40001--40002], [保持寄存器], [γ剂量率实时值 (0102060301)], [Float32], [只读],
    [40003--40004], [保持寄存器], [γ剂量率低值报警阈值], [Float32], [读写],
    [40005--40006], [保持寄存器], [γ剂量率高值报警阈值], [Float32], [读写],
    [40007--40008], [保持寄存器], [氡浓度实时值 (0102060302)], [Float32], [只读],
    [40009--40010], [保持寄存器], [氡浓度低值报警阈值], [Float32], [读写],
    [40011--40012], [保持寄存器], [氡浓度高值报警阈值], [Float32], [读写],
    [40013], [保持寄存器], [采样周期 CTime], [UInt16], [读写],
    [40014], [保持寄存器], [设备运行状态 DevStatus], [UInt16], [只读],
    [00001], [线圈], [通风系统启动/停止 (0=停 1=启)], [Bool], [读写],
    [00002], [线圈], [通风系统模式 (0=手动 1=自动)], [Bool], [读写],
    [10001], [离散输入], [一级报警状态], [Bool], [只读],
    [10002], [离散输入], [二级报警状态], [Bool], [只读],
  )
)

== 功能码

#ztable(
  columns: (auto, 1fr),
  header: ([功能码], [用途]),
  (
    [0x01], [读线圈状态（通风系统开关/模式）],
    [0x02], [读离散输入（报警状态）],
    [0x03], [读保持寄存器（实时数据、阈值参数）],
    [0x05], [写单个线圈（下发通风启停/模式切换指令）],
    [0x06], [写单个保持寄存器（下发采样周期）],
    [0x10], [写多个保持寄存器（批量下发报警阈值）],
  )
)

== 报文示例

*示例1：平台读取γ剂量率实时值（功能码 0x03，起始地址 40001，2个寄存器）*

```

请求：01 03 9C 40 00 02 C5 F3
响应：01 03 04 42 34 00 00 8F 5C
从站01 | 功能码03 | 字节数04 | Float32=45.0(nGy/h) | CRC

```

*示例2：平台下发γ剂量率高值报警阈值 2500 nGy/h（功能码 0x10，地址40005）*

```

请求：01 10 9C 44 00 02 04 45 1C 40 00 6E 8A
从站01 | 功能码10 | 起始地址9C44 | 寄存器数2 | 字节数4 | Float32=2500.0 | CRC
响应：01 10 9C 44 00 02 F0 8B

```

*示例3：平台下发通风系统启动指令（功能码 0x05，线圈00001置1）*

```

请求：01 05 00 00 FF 00 8C 3A
响应：01 05 00 00 FF 00 8C 3A   （原样回显表示执行成功）

```

== 异常响应码

#ztable(
  columns: (auto, 1fr),
  header: ([异常码], [含义]),
  (
    [0x01], [非法功能码],
    [0x02], [非法数据地址],
    [0x03], [非法数据值（如阈值超出量程）],
    [0x04], [从站设备故障],
    [0x06], [从站忙，请求排队重试],
  )
)

#pagebreak()

= 协议二：HTTP/HTTPS 协议（RESTful + JSON）

== 基本约定

#ztable(
  columns: (auto, 1fr),
  header: ([项目], [约定]),
  (
    [传输协议], [HTTPS（TLS 1.2及以上），端口 443],
    [数据格式], [JSON，编码 UTF-8],
    [时间格式], [ISO 8601，如 `2025-10-23T14:30:00+08:00`],
    [鉴权方式], [Header 携带 `Authorization: Bearer <token>`，token 由平台预先签发],
    [请求频率], [实时数据上传：γ每30s一次，氡每1800s一次；心跳：每60s一次],
  )
)

== 接口列表

#ztable(
  columns: (auto, auto, 1fr, auto),
  align: (center, center, left, center),
  header: ([方向], [方法], [接口路径], [用途]),
  (
    [上行], [POST], [`/api/v1/monitor/data`], [实时监测数据上报],
    [上行], [POST], [`/api/v1/monitor/alarm`], [报警事件上报],
    [上行], [POST], [`/api/v1/device/heartbeat`], [设备心跳/在线状态上报],
    [下行], [GET], [`/api/v1/command/pull`], [本地轮询获取待执行指令],
    [下行], [POST], [`/api/v1/command/ack`], [指令执行结果回报],
    [下行], [PUT], [`/api/v1/device/threshold`], [平台下发报警阈值（本地提供接收端点）],
  )
)

== 上行接口

=== 实时监测数据上报 `POST /api/v1/monitor/data`

```json
{
  "stationId": "xxx",
  "deviceId": "BR-GAMMA-C3-001",
  "pointCode": "0102060301",
  "timestamp": "2025-10-23T14:30:00+08:00",
  "value": 45.0,
  "status": "normal"
}
```

响应：

```json
{
  "code": 200, // HTTP 状态码 503
  "message": "success",
  "receivedAt": "2025-10-23T14:30:01+08:00"
}
```

列出一些不同的错误情形和错误代码

signature: 

覆盖掉设备的阈值。以控制软件为准。




=== 报警事件上报 `POST /api/v1/monitor/alarm`

```json
{
  "stationId": "xxx",
  "deviceId": "BR-RADON-C24-002",
  "pointCode": "0102060302",
  "level": 2,
  "value": 1200.0,
  "threshold": 1000.0,
  "timestamp": "2025-10-23T14:31:05+08:00",
  "action": "ventilation_auto_start"
}
```

/* == 下行接口

=== 本地轮询获取待执行指令 `GET /api/v1/command/pull?deviceId=BR-VENT-001`

```json
{
  "code": 0,
  "commands": [
    {
      "commandId": "CMD20251023-0007",
      "pointCode": "0201000001",
      "action": "start",
      "issuedAt": "2025-10-23T14:31:06+08:00"
    }
  ]
}
```

=== 指令执行结果回报 `POST /api/v1/command/ack`

```json
{
  "commandId": "CMD20251023-0007",
  "result": "success",
  "executedAt": "2025-10-23T14:31:08+08:00"
}
```

=== 平台下发报警阈值 `PUT /api/v1/device/threshold`

```json
{
  "deviceId": "BR-GAMMA-C3-001",
  "pointCode": "0102060301",
  "lowValue": 50.0,
  "upValue": 2500.0
}
```

 */

== 状态码

#ztable(
columns: (auto, 1fr),
header: ([code], [含义]),
(
[0], [成功],
[TODO], [参数缺失或格式错误],
[TODO], [设备未注册/鉴权失败],
[TODO], [数据点编码不存在],
[TODO], [阈值超出设备量程],
[TODO], [服务端内部错误],
)
)

#pagebreak()

= 附录：报警分级与联动逻辑

// #ztable(
// columns: (auto, 1fr, 1fr),
// header: ([级别], [触发条件], [动作]),
// (
// [一级], [γ > 2.5 μSv/h 或 氡 > 500 Bq/m³], [现场声光报警；平台弹窗提示],
// [二级], [γ > 5 μSv/h 或 氡 > 1000 Bq/m³], [自动启动新风系统；短信通知管理人员；平台记录联动事件],
// )
// )
/* 
#v(0.5em)

#callout(
title: "安全设计原则",
color: rgb("#fdecea"),
bar: rgb("#d32f2f"),
)[
一级/二级报警的现场声光报警及通风联动优先在本地网关/PLC侧闭环执行，平台侧的下行指令（协议一线圈00001/00002、协议二 `/command/pull`）作为远程手动控制与监控展示手段，不作为联动触发的唯一路径。
]
 */

地图，点开，显示内部的示意图，探头在什么位置
