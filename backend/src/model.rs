// Domain types matching the frontend TypeScript types.
// These are the canonical API response shapes.


use serde::{Deserialize, Serialize};

// ── Protocol types (from protocol.typ) ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceType {
    Gamma,
    Radon,
}

impl std::fmt::Display for DeviceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Gamma => write!(f, "gamma"),
            Self::Radon => write!(f, "radon"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceStatus {
    Online,
    Offline,
    Fault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmInfo {
    pub level: u8, // 1 or 2
    pub reason: String,
    pub threshold: Threshold,
    pub action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Threshold {
    pub low: f64,
    pub up: f64,
}

#[derive(Debug, Clone)]
pub enum AlarmField {
    None,
    Active(AlarmInfo),
}

impl serde::Serialize for AlarmField {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::None => s.serialize_bool(false),
            Self::Active(a) => a.serialize(s),
        }
    }
}

impl<'de> serde::Deserialize<'de> for AlarmField {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de;

        struct AlarmFieldVisitor;

        impl<'de> de::Visitor<'de> for AlarmFieldVisitor {
            type Value = AlarmField;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                write!(f, "false or an alarm object")
            }

            fn visit_bool<E: de::Error>(self, v: bool) -> Result<AlarmField, E> {
                if v {
                    Err(E::custom("expected false, got true"))
                } else {
                    Ok(AlarmField::None)
                }
            }

            fn visit_map<M: de::MapAccess<'de>>(self, map: M) -> Result<AlarmField, M::Error> {
                AlarmInfo::deserialize(de::value::MapAccessDeserializer::new(map))
                    .map(AlarmField::Active)
            }
        }

        deserializer.deserialize_any(AlarmFieldVisitor)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricData {
    pub metric: String,
    pub name: String,
    pub timestamp: String, // ms timestamp string
    pub value: f64,
    pub unit: String,
    pub alarm: AlarmField,
}

// ── Device ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub code: String,
    pub name: String,
    #[serde(rename = "type")]
    pub device_type: DeviceType,
    pub station: String,
    pub status: DeviceStatus,
    pub metrics: Vec<MetricData>,
    pub last_update: String, // ISO 8601
    pub alarms: Vec<AlarmInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalPoint {
    pub timestamp: i64, // ms since epoch
    pub value: f64,
}

// ── Scene ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneObject {
    pub id: String,
    pub label: String,
    pub kind: String, // "wall" | "machine" | "area" | "other"
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePlacement {
    pub device_id: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryScene {
    pub width: f64,
    pub height: f64,
    pub objects: Vec<SceneObject>,
    pub devices: Vec<DevicePlacement>,
}

// ── Upload payloads (from protocol.typ §2.2) ─────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceReport {
    pub station: String,
    pub device: String,
    pub metrics: Vec<MetricData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatReport {
    pub station: String,
    pub device: String,
    #[serde(rename = "type")]
    pub device_type: DeviceType,
    pub status: DeviceStatus,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub code: u16,
    pub message: String,
    pub time: String,
}