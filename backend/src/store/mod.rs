// Storage abstraction. The in-memory implementation is for development.
// Replace with fjall (or another persistent store) later.

pub mod memory;
pub mod tsdb;

use crate::model::*;
use std::sync::Arc;

pub type Store = Arc<dyn DeviceStore + Send + Sync>;

/// Time range for historical queries.
#[derive(Debug, Clone, Copy)]
pub enum TimeRange {
    Minutes15,
    Hour1,
    Hours24,
    Days7,
}

impl TimeRange {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "15m" => Some(Self::Minutes15),
            "1h" => Some(Self::Hour1),
            "24h" => Some(Self::Hours24),
            "7d" => Some(Self::Days7),
            _ => None,
        }
    }

    pub fn as_duration_ms(&self) -> i64 {
        match self {
            Self::Minutes15 => 15 * 60 * 1000,
            Self::Hour1 => 60 * 60 * 1000,
            Self::Hours24 => 24 * 60 * 60 * 1000,
            Self::Days7 => 7 * 24 * 60 * 60 * 1000,
        }
    }
}

/// The storage interface. All methods are async to allow for I/O-backed stores.
///
/// # Implementing with fjall
///
/// When fjall is integrated, implement this trait on a `FjallStore` struct.
/// Each method maps to a fjall keyspace:
///   - devices → `devices` tree (key: device_id, value: Device JSON)
///   - history → `measurements` tree (key: device_id + metric + timestamp, value: f64)
///   - scene   → `config` tree (key: "scene", value: FactoryScene JSON)
///   - alarms  → `alarms` tree (key: device_id + timestamp, value: AlarmInfo JSON)
#[async_trait::async_trait]
pub trait DeviceStore: Send + Sync {
    // ── Devices ──────────────────────────────────────────────────

    /// List all registered devices.
    async fn list_devices(&self) -> Vec<Device>;

    /// Get a single device by ID. Returns None if not found.
    async fn get_device(&self, id: &str) -> Option<Device>;

    /// Upsert a device (called on first heartbeat or data report).
    async fn upsert_device(&self, device: Device);

    // ── Measurements / History ───────────────────────────────────

    /// Append a measurement point for a device+metric.
    /// The store should keep points ordered by timestamp.
    async fn append_measurement(
        &self,
        device_id: &str,
        metric: &str,
        point: HistoricalPoint,
    );

    /// Query historical points for a device+metric within a time range.
    async fn query_history(
        &self,
        device_id: &str,
        metric: &str,
        range: TimeRange,
    ) -> Vec<HistoricalPoint>;

    // ── Scene ────────────────────────────────────────────────────

    /// Load the factory scene. Returns a default if none saved yet.
    async fn get_scene(&self) -> FactoryScene;

    /// Save the factory scene.
    async fn save_scene(&self, scene: FactoryScene);

    // ── Storage hook ─────────────────────────────────────────────

    /// Called after each batch of data is ingested.
    /// Use this to trigger persistence, indexing, or downstream events.
    /// The default implementation is a no-op.
    async fn on_data_ingested(&self, _device_ids: &[String]) {}
}