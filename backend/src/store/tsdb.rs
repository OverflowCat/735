//! Date-partitioned time-series store backed by nekostore.
//!
//! File layout (date partitioning lives here, not in nekostore):
//!
//! ```text
//! <root>/
//! ├── device_0001/
//! │   ├── 2026-10-19.tsd
//! │   ├── 2026-10-20.tsd
//! │   └── …
//! └── device_0002/
//!     └── …
//! ```
//!
//! Each `.tsd` file is a nekostore [`BatchFile`] holding one day of samples
//! for one device.  Queries iterate only the relevant date files.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use chrono::{Duration, NaiveDate, TimeZone, Utc};
use nekostore::{BatchFile, Sample, Value, ValueType};

use crate::model::*;
use crate::store::DeviceStore;

/// Map a device metric key to a nekostore series ID (stable hash).
fn series_id(device_id: &str, metric: &str) -> u32 {
    // FNV-1a 32-bit over "device_id\0metric".
    let mut h: u32 = 0x811c_9dc5;
    for b in device_id
        .as_bytes()
        .iter()
        .chain(&[0])
        .chain(metric.as_bytes())
    {
        h ^= *b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    h
}

/// Format a date as the file stem `YYYY-MM-DD`.
fn date_stem(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// Parse a file stem back to a date.
fn parse_stem(stem: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(stem, "%Y-%m-%d").ok()
}

/// UTC date for a millisecond timestamp.
fn date_of(ts_ms: i64) -> NaiveDate {
    Utc.timestamp_millis_opt(ts_ms)
        .single()
        .map(|dt| dt.date_naive())
        .unwrap_or_else(|| Utc::now().date_naive())
}

/// In-memory device registry (mirrors MemoryStore behaviour for device metadata).
pub struct TsdStore {
    root: PathBuf,
    devices: RwLock<HashMap<String, Device>>,
    /// Cached open files: (series_id, date) → BatchFile.
    files: RwLock<HashMap<(u32, NaiveDate), BatchFile>>,
}

impl TsdStore {
    pub fn open(root: &Path) -> std::io::Result<Self> {
        std::fs::create_dir_all(root)?;
        Ok(Self {
            root: root.to_path_buf(),
            devices: RwLock::new(HashMap::new()),
            files: RwLock::new(HashMap::new()),
        })
    }

    // ── Internal helpers ─────────────────────────────────────────

    fn file_path(&self, device_id: &str, metric: &str, date: NaiveDate) -> PathBuf {
        self.root
            .join(device_id)
            .join(format!("{metric}_{}.tsd", date_stem(date)))
    }

    fn ensure_file(
        &self,
        device_id: &str,
        metric: &str,
        date: NaiveDate,
    ) -> Result<(), std::io::Error> {
        let key = (series_id(device_id, metric), date);
        let mut files = self.files.write().unwrap();
        if files.contains_key(&key) {
            return Ok(());
        }
        let path = self.file_path(device_id, metric, date);
        let bf = BatchFile::open_or_create(&path, ValueType::F64).map_err(io_err)?;
        files.insert(key, bf);
        Ok(())
    }

    fn append_point(
        &self,
        device_id: &str,
        metric: &str,
        point: &HistoricalPoint,
    ) -> Result<(), std::io::Error> {
        let date = date_of(point.timestamp);
        self.ensure_file(device_id, metric, date)?;
        let key = (series_id(device_id, metric), date);
        let mut files = self.files.write().unwrap();
        let bf = files.get_mut(&key).unwrap();
        let sample = Sample {
            timestamp_ms: point.timestamp,
            value: Value::F64(point.value),
        };
        bf.append_batch(&[sample]).map_err(io_err)?;
        bf.flush().map_err(io_err)?;
        Ok(())
    }

    fn read_points(
        &self,
        device_id: &str,
        metric: &str,
        start_ms: i64,
        end_ms: i64,
    ) -> Vec<HistoricalPoint> {
        let mut out = Vec::new();
        let start_date = date_of(start_ms);
        let end_date = date_of(end_ms);

        let mut date = start_date;
        while date <= end_date {
            let path = self.file_path(device_id, metric, date);
            if path.exists() {
                if let Ok(bf) = BatchFile::open(&path, ValueType::F64) {
                    if let Ok(batches) = bf.read_batches() {
                        let samples = nekostore::query_range(&batches, start_ms, end_ms);
                        for s in samples {
                            out.push(HistoricalPoint {
                                timestamp: s.timestamp_ms,
                                value: s.value.as_f64(),
                            });
                        }
                    }
                }
            }
            date += Duration::days(1);
        }
        out.sort_by_key(|p| p.timestamp);
        out
    }

    /// Flush all open files.
    pub fn flush_all(&self) {
        let mut files = self.files.write().unwrap();
        for bf in files.values_mut() {
            let _ = bf.flush();
        }
    }
}

fn io_err(e: nekostore::Error) -> std::io::Error {
    std::io::Error::other(e.to_string())
}

// ── DeviceStore impl ─────────────────────────────────────────────

#[async_trait::async_trait]
impl DeviceStore for TsdStore {
    async fn list_devices(&self) -> Vec<Device> {
        self.devices.read().unwrap().values().cloned().collect()
    }

    async fn get_device(&self, id: &str) -> Option<Device> {
        self.devices.read().unwrap().get(id).cloned()
    }

    async fn upsert_device(&self, device: Device) {
        self.devices
            .write()
            .unwrap()
            .insert(device.id.clone(), device);
    }

    async fn append_measurement(&self, device_id: &str, metric: &str, point: HistoricalPoint) {
        if let Err(e) = self.append_point(device_id, metric, &point) {
            tracing::error!("tsdb append failed for {device_id}/{metric}: {e}");
        }
    }

    async fn query_history(
        &self,
        device_id: &str,
        metric: &str,
        start_ms: i64,
        end_ms: i64,
    ) -> Vec<HistoricalPoint> {
        self.read_points(device_id, metric, start_ms, end_ms)
    }

    async fn get_scene(&self) -> FactoryScene {
        let path = self.root.join("scene.json");
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(scene) = serde_json::from_str(&data) {
                return scene;
            }
        }
        FactoryScene {
            width: 1200.0,
            height: 800.0,
            objects: vec![],
            devices: vec![],
        }
    }

    async fn save_scene(&self, scene: FactoryScene) {
        let path = self.root.join("scene.json");
        if let Ok(data) = serde_json::to_string_pretty(&scene) {
            let _ = std::fs::write(&path, data);
        }
    }

    async fn on_data_ingested(&self, device_ids: &[String]) {
        tracing::debug!(
            "tsdb: data ingested for {} device(s): {:?}",
            device_ids.len(),
            device_ids
        );
    }
}
