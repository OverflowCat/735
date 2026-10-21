// In-memory store for development. Replace with fjall-backed store later.

use super::DeviceStore;
use crate::model::*;
use std::collections::HashMap;
use std::sync::RwLock;

pub struct MemoryStore {
    devices: RwLock<HashMap<String, Device>>,
    history: RwLock<HashMap<String, Vec<HistoricalPoint>>>, // key: "device_id:metric"
    scene: RwLock<FactoryScene>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self {
            devices: RwLock::new(HashMap::new()),
            history: RwLock::new(HashMap::new()),
            scene: RwLock::new(default_scene()),
        }
    }
}

impl Default for MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl DeviceStore for MemoryStore {
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
        let key = format!("{}:{}", device_id, metric);
        let mut history = self.history.write().unwrap();
        history.entry(key).or_default().push(point);
    }

    async fn query_history(
        &self,
        device_id: &str,
        metric: &str,
        start_ms: i64,
        end_ms: i64,
    ) -> Vec<HistoricalPoint> {
        let key = format!("{}:{}", device_id, metric);
        let history = self.history.read().unwrap();
        history
            .get(&key)
            .map(|points| {
                points
                    .iter()
                    .filter(|p| p.timestamp >= start_ms && p.timestamp <= end_ms)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    async fn get_scene(&self) -> FactoryScene {
        self.scene.read().unwrap().clone()
    }

    async fn save_scene(&self, scene: FactoryScene) {
        *self.scene.write().unwrap() = scene;
    }

    async fn on_data_ingested(&self, device_ids: &[String]) {
        tracing::debug!(
            "data ingested for {} device(s): {:?}",
            device_ids.len(),
            device_ids
        );
    }
}

fn default_scene() -> FactoryScene {
    FactoryScene {
        width: 1200.0,
        height: 800.0,
        objects: vec![],
        devices: vec![],
    }
}
