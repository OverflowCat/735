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
  #text(size: 10pt)[版本：V0.2#v(1em)北京博瑞赛科技有限责任公司]
]

#v(1em)
#line(length: 100%, stroke: 0.6pt)

== 概述

系统数据通信仅保留*单向上报（现场 → 平台）*：

- 现场设备（γ剂量率监测仪、空气测氡仪等）通过网关将实时监测数据、报警状态与设备在线状态上报至平台。
- 报警不作为独立事件单独上报，合并在实时数据上报中，随监测数据一同携带 `alarm` 对象（等级、原因、阈值、联动动作），减少接口数量与网络交互次数。
- 报警阈值的维护与判定、通风联动等现场闭环控制，均由现场网关/控制软件自主完成，平台不下发任何控制或参数覆盖指令。
- 设备安装位置等静态台账信息通过其他方式在平台侧配置维护，不在本通信协议的数据接口中携带。
- 一个网关下挂多台设备时，一次请求可合并上报；`payload` 按设备拆分为数组，每台设备下可携带多条数据，兼容断线重连后的批量补传。

#pagebreak()

= 通信协议：HTTP/HTTPS（RESTful + JSON）

== 基本约定

#ztable(
  columns: (auto, 1fr),
  header: ([项目], [约定]),
  (
    [传输协议], [HTTPS（TLS 1.2 及以上），端口 443],
    [数据格式], [JSON，编码 UTF-8],
    [报文结构], [请求体固定为 4 个字段：`payload`（业务数据序列化后的 JSON *字符串*，按设备拆分的数组，见下）、`sign`（对 `payload` 字符串的签名）、`time`（本次请求发送时间，ISO 8601）、`timestamp`（本次请求发送时间，毫秒时间戳字符串）；`time` 与 `timestamp` 是同一时刻的两种表示],
    [签名算法], [`sign = HMAC-SHA256(deviceSecret, payload)`，对 `payload` 原始字符串逐字节计算，平台按相同算法重新计算比对后方可入库],
    [防重放], [外层 `timestamp` 与平台接收时间偏差超过 ±5 分钟的请求将被拒绝],
    [请求频率], [实时数据上报：γ每30s一次，氡每1800s一次；心跳：每60s一次；支持合并多设备/多条数据一次性上报],
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

#callout(title: "设计说明")[
  平台不提供任何下行控制接口。通风联动等现场动作由本地网关/PLC闭环执行并作为字段随数据一并上报，仅用于平台记录与展示，不构成远程控制通道。
]

== 接口规格

=== 实时监测数据上报（含报警） `POST /api/v1/monitor/data`

报警不单独建接口，而是通过 `alarm` 字段直接携带在数据上报中：不报警时 `alarm` 为 `false`；触发报警时 `alarm` 为一个对象，携带等级、原因、当前阈值与已执行的联动动作。`payload` 是一个*按设备拆分*的数组，每个数组元素代表一台设备，其下 `metrics` 数组可携带该设备本次上报的一条或多条数据。

```json
{
  "payload": "[{\"station\":\"xxx\",\"device\":\"BR-GAMMA-C3-001\",\"metrics\":[{\"metric\":\"0102060301\",\"name\":\"γ剂量率实时值\",\"timestamp\":\"1729665000000\",\"value\":45.0,\"unit\":\"nGy/h\",\"alarm\":false}]}]",
  "sign": "a3f9c1e0b7d24f6a...e7",
  "time": "2025-10-23T14:30:00+08:00",
  "timestamp": "1729665000000"
}
```

`payload` 反序列化后的结构：

```json
[
  {
    "station": "xxx",
    "device": "BR-GAMMA-C3-001",
    "metrics": [
      {
        "metric": "0102060301",
        "name": "γ剂量率实时值",
        "timestamp": "1729665000000",
        "value": 45.0,
        "unit": "nGy/h",
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
    [`station`], [站点编号],
    [`device`], [设备编号，数组每个元素对应一台设备],
    [`metrics`], [该设备本次上报的数据数组，可包含一条或多条],
    [`metric`], [监测指标编码，由平台在设备注册时统一分配，站内唯一],
    [`name`], [监测指标名称],
    [`timestamp`], [该条数据的采集时间，毫秒时间戳字符串，如 `"1729665000000"`；可能早于外层发送时间（如断线重连后补传历史数据）],
    [`value`], [监测数值],
    [`unit`], [单位],
    [`alarm`], [`false` 表示未报警；报警时为对象，见下],
    [`alarm.level`], [报警等级：1=一级报警，2=二级报警],
    [`alarm.reason`], [报警原因，现场生成的简短文字说明，如 "γ剂量率超出二级上限阈值"],
    [`alarm.threshold`], [触发本次报警时现场控制软件生效的阈值，仅供平台展示；平台不下发覆盖，*以现场控制软件为准*],
    [`alarm.action`], [现场已执行的联动动作，如 `vent_start`；未执行动作时为 `null`],
  )
)

响应示例：

```json
{
  "code": 200,
  "message": "success",
  "time": "2025-10-23T14:30:01+08:00"
}
```

*一次请求合并上报两台设备（其中一台触发二级报警）时，`payload` 反序列化后的结构：*

```json
[
  {
    "station": "xxx",
    "device": "BR-GAMMA-C3-001",
    "metrics": [
      {
        "metric": "0102060301",
        "name": "γ剂量率实时值",
        "timestamp": "1729665000000",
        "value": 45.0,
        "unit": "nGy/h",
        "alarm": false
      }
    ]
  },
  {
    "station": "xxx",
    "device": "BR-RADON-C24-002",
    "metrics": [
      {
        "metric": "0102060302",
        "name": "氡及子体浓度实时值",
        "timestamp": "1729665065000",
        "value": 1200.0,
        "unit": "Bq/m3",
        "alarm": {
          "level": 2,
          "reason": "氡浓度持续超出二级上限阈值",
          "threshold": {
            "low": 100.0,
            "up": 1000.0
          },
          "action": "vent_start"
        }
      }
    ]
  }
]
```

=== 设备心跳上报 `POST /api/v1/device/heartbeat`

用于上报设备在线状态。请求体外层结构与数据上报一致（`payload` + `sign` + `time` + `timestamp`），`payload` 同样是按设备拆分的数组，可一次上报多台设备的心跳。

```json
{
  "payload": "[{\"station\":\"xxx\",\"device\":\"BR-GAMMA-C3-001\",\"type\":\"gamma\",\"status\":\"online\",\"timestamp\":\"1729665060000\"},{\"station\":\"xxx\",\"device\":\"BR-RADON-C24-002\",\"type\":\"radon\",\"status\":\"online\",\"timestamp\":\"1729665060000\"}]",
  "sign": "6f1a9d3e0c8b...5a",
  "time": "2025-10-23T14:31:00+08:00",
  "timestamp": "1729665060000"
}
```

`payload` 反序列化后的结构：

```json
[
  {
    "station": "xxx",
    "device": "BR-GAMMA-C3-001",
    "type": "gamma",
    "status": "online",
    "timestamp": "1729665060000"
  },
  {
    "station": "xxx",
    "device": "BR-RADON-C24-002",
    "type": "radon",
    "status": "online",
    "timestamp": "1729665060000"
  }
]
```

字段说明：

#ztable(
  columns: (auto, 1fr),
  header: ([字段], [说明]),
  (
    [`type`], [设备类型，如 `gamma`（γ剂量率）、`radon`（氡及子体）],
    [`status`], [`online` 在线 / `offline` 离线 / `fault` 故障],
    [`timestamp`], [该设备本条心跳的采集时间，毫秒时间戳字符串],
  )
)

响应示例：

```json
{
  "code": 200,
  "message": "success",
  "time": "2025-10-23T14:31:01+08:00"
}
```

== 错误码

`code` 字段直接取值于本次响应的 HTTP 状态码，不再另设一套业务编码：

#ztable(
  columns: (auto, 1fr),
  align: (center, left),
  header: ([code], [含义]),
  (
    [200], [成功],
    [400], [参数缺失或格式错误],
    [401], [签名校验失败或 token 无效/过期],
    [403], [设备未注册],
    [404], [监测指标编码不存在],
    [409], [时间戳超出允许偏差范围，请求被判定为重放],
    [422], [数值超出设备量程],
    [429], [请求频率超限],
    [500], [服务端内部错误],
    [503], [服务暂不可用，请按退避策略重试],
  )
)

错误响应示例：

```json
{
  "code": 401,
  "message": "签名校验失败",
  "time": "2025-10-23T14:30:01+08:00"
}
```

#pagebreak()

= 附录：报警分级说明

上报数据中的 `alarm.level` 字段与以下等级对应，具体触发阈值以现场控制软件设定为准，平台侧仅作展示；未报警时 `alarm` 直接为 `false`，不出现下表中的等级：

#ztable(
  columns: (auto, 1fr, 1fr),
  header: ([等级], [典型触发条件], [现场动作]),
  (
    [1（一级）], [γ超低值/高值阈值 或 氡超低值/高值阈值（一级）], [现场声光报警；`alarm.action` 记录已执行动作],
    [2（二级）], [数值持续超出二级阈值], [现场自动执行相应联动动作（如通风控制）；`alarm.action` 字段一并上报],
  )
)

#callout(
  title: "安全设计原则",
  color: rgb("#fdecea"),
  bar: rgb("#d32f2f"),
)[
  报警判定与联动控制（声光报警、通风启停）完全在现场网关/PLC侧闭环执行，不依赖网络连接与平台响应；平台仅接收上报结果用于记录、展示与统计，不作为联动触发路径，也不对现场阈值进行远程覆盖。
]
