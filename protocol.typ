#set document(title: "735通信协议", author: "北京博瑞赛科技有限责任公司")
#set page(paper: "a5", margin: (x: 1.2cm, y: 1.2cm))
#set text(size: 10.5pt, lang: "zh", font: ("IBM Plex Sans", "IBM Plex Sans SC"))
#set heading(numbering: "1.1")
#set par(justify: true, leading: 0.65em)

// 代码统一使用 IBM Plex Mono，CJK 回落到 IBM Plex Sans SC
#show raw: set text(font: ("IBM Plex Mono", "IBM Plex Sans SC"))
#show raw.where(block: false): it => box(
  fill: rgb("#f4f4f6"), inset: (x: 3pt), outset: (y: 3pt), radius: 2pt,
  text(size: 0.88em, it)
)
#show raw.where(block: true): it => block(
  fill: rgb("#f4f4f6"), inset: 8pt, radius: 3pt, width: 100%,
  text(size: 9pt, it)
)

#let accent = rgb("#1f6feb")
#let stripe = rgb("#f6f8fa")

#let ztable(columns: none, align: none, header: none, rows) = table(
  columns: columns,
  stroke: 0.5pt + rgb("#d0d7de"),
  fill: (x, y) => if y == 0 { accent } else if calc.even(y) { stripe } else { white },
  table.header(..header.map(c => text(fill: white, weight: "bold", c))),
  ..rows
)

// 封面（不编号）
#align(center + horizon)[
  #text(size: 28pt, weight: "bold", tracking: 2pt)[735通信协议]
  #v(1.2em)
  #line(length: 40%, stroke: 0.8pt)
  #v(1.2em)
  #text(size: 13pt)[数据通信协议设计说明书]
  #v(5em)
  #text(size: 10.5pt)[版本：V1.1]
  #v(10em)
  #text(size: 12pt)[北京博瑞赛科技有限责任公司]
]
#pagebreak()
#set page(numbering: "1")
#counter(page).update(1)

== 概述

现场设备通过网关向平台上报实时监测数据、报警信息和设备状态。

- 报警信息通过 `alarm` 字段随监测数据上报，包含原因、阈值和联动动作。
- 报警阈值设置与报警判定在现场完成。
- 支持多设备、多条数据合并上报。

#pagebreak()

= 通信协议

== 基本约定

#ztable(
  columns: (auto, 1fr),
  header: ([项目], [约定]),
  (
    [传输协议], [HTTP，端口 80],
    [数据格式], [JSON，编码 UTF-8],
    [报文结构], [请求体为 JSON 数组，按设备拆分],
    [时间基准], [毫秒时间戳（number，Unix epoch UTC），取网关时钟],
    [请求频率], [>=30s；支持合并上报；单请求不超过 1000 个数据点、256 KB],
  )
)

== 报文结构

数据上报与心跳的请求体均为 JSON 数组，按设备拆分，一次请求可含多台设备：

```json
[
  { "device": "2026012905", "type": "gamma", "...": "..." },
  { "device": "radon-37", "type": "radon", "...": "..." }
]
```

数组元素格式见各接口定义。每条数据的 `timestamp` 为采集时刻，可早于发送时刻，用于合并上报。

响应体：

```json
{
  "code": 200,
  "message": "success",
  "time": 1792980000120
}
```

#ztable(
  columns: (auto, 1fr),
  header: ([字段], [说明]),
  (
    [`code`], [处理结果，取 HTTP 状态码],
    [`message`], [简短文字说明],
    [`time`], [平台处理时刻，毫秒时间戳（number）],
  )
)

== 设备标识

#ztable(
  columns: (auto, 1fr),
  header: ([项], [约定]),
  (
    [`station`], [厂房编号，如 `C35`、`C19`、`C3`、`JZGL`（集中过滤厂房）],
    [γ剂量率仪], [`device` 取设备资产编号（SN），如 `2026012905`],
    [氡监测仪], [`device` 取 `radon-<节点号>`，如 `radon-37`；氡探头与 γ 剂量率仪共用同一 RS485 总线及串口服务器，由网关按节点号拆分],
  )
)

== 接口列表

#ztable(
  columns: (auto, auto, 1fr, auto),
  align: (center, center, left, center),
  header: ([方向], [方法], [接口路径], [用途]),
  (
    [上行], [POST], [`/api/v1/monitor/data`], [实时监测数据上报（含报警信息，支持多设备批量）],
    [上行], [POST], [`/api/v1/device/heartbeat`], [设备心跳及在线状态上报（支持多设备批量）],
  )
)

== 接口规格

=== 实时监测数据上报（含报警） `POST /api/v1/monitor/data`

报警通过 `alarm` 字段随数据上报：未报警为 `false`，报警时为对象。请求体按设备拆分，每台设备的 `data` 可含一条或多条数据。

```json
[
  {
    "device": "2026012905",
    "type": "gamma",
    "data": [
      {
        "timestamp": 1792980000000,
        "value": 45.0,
        "unit": "nSv/h",
        "alarm": false
      }
    ]
  }
]
```

字段说明：

#ztable(
  columns: (auto, 1fr),
  header: ([字段], [说明]),
  (
    [`device`], [设备 ID；数组每个元素对应一台设备],
    [`type`], [设备类型：`gamma`（γ剂量率仪）/ `radon`（氡监测仪）],
    [`data`], [该设备本次上报的数据数组],
    [`timestamp`], [采集时刻，毫秒时间戳（number）],
    [`value`], [监测数值],
    [`unit`], [单位],
    [`alarm`], [`false` 表示未报警；报警时为对象],
    [`alarm.reason`], [报警原因，简短文字说明],
    [`alarm.threshold`], [`{low, up}` 低值/高值报警阈值，单位同 `unit`],
    [`alarm.action`], [联动动作：`sound_light`（声光报警）、…；未执行为 `null`],
  )
)

合并上报两台设备（其中一台触发报警）：

```json
[
  {
    "device": "2026012905",
    "type": "gamma",
    "data": [
      {
        "timestamp": 1792980000000,
        "value": 45.0,
        "unit": "nSv/h",
        "alarm": false
      }
    ]
  },
  {
    "device": "radon-37",
    "type": "radon",
    "data": [
      {
        "timestamp": 1792980065000,
        "value": 1200.0,
        "unit": "Bq/m3",
        "alarm": {
          "reason": "氡浓度超出上限阈值",
          "threshold": {
            "low": 100.0,
            "up": 1000.0
          },
          "action": null
        }
      }
    ]
  }
]
```

=== 设备心跳上报 `POST /api/v1/device/heartbeat`

```json
[
  {
    "station": "C3",
    "device": "2026012905",
    "type": "gamma",
    "status": "online",
    "timestamp": 1792980060000
  },
  {
    "station": "C3",
    "device": "radon-37",
    "type": "radon",
    "status": "online",
    "timestamp": 1792980060000
  }
]
```

#ztable(
  columns: (auto, 1fr),
  header: ([字段], [说明]),
  (
    [`station`], [厂房编号],
    [`device`], [设备 ID；数组每个元素对应一台设备],
    [`type`], [设备类型，同数据上报],
    [`status`], [`online` 在线 / `offline` 离线 / `fault` 故障],
    [`timestamp`], [本条心跳采集时刻，毫秒时间戳（number）],
  )
)

设备由网关代发心跳，状态由网关判定：通信中断 `offline`，仪表故障 `fault`，正常 `online`。

响应结构与数据上报一致。

== 错误码约定

#ztable(
  columns: (auto, 1fr),
  align: (center, left),
  header: ([code], [含义]),
  (
    [200], [成功],
    [400], [参数缺失或格式错误],
    [409], [请求冲突],
    [413], [请求体过大],
    [500], [服务端内部错误],
    [503], [服务暂不可用],
  )
)

错误响应示例：

```json
{
  "code": 400,
  "message": "请求体缺失或格式错误",
  "time": 1792980000100
}
```

== 兼容性与版本

`/api/v1/` 即协议版本。
