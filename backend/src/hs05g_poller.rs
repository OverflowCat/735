// HS05G hub poller. Periodically reads data from configured hubs
// and ingests it into the store.

use crate::model::*;
use crate::store::Store;
use hs05g::HubClient;
use hs05g::protocol::{DataPacket, NodeData, Response};
use std::net::SocketAddr;
use std::time::Duration;
use tokio::time;
use tracing::{error, info, warn};

/// Configuration for a single HS05G hub.
#[derive(Debug, Clone)]
pub struct HubConfig {
    pub addr: SocketAddr,
    /// Polling interval in seconds.
    pub interval_secs: u64,
    /// Mapping from node_id → device_id. If not present, auto-generates device IDs.
    pub node_device_map: Option<std::collections::HashMap<u8, String>>,
    /// Station identifier for reports.
    pub station: String,
}

/// Spawn a background task that polls a hub at the configured interval.
pub fn spawn_hub_poller(hub: HubConfig, store: Store) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(hub.interval_secs);
        info!(
            "HS05G poller started for {} (every {}s)",
            hub.addr, hub.interval_secs
        );

        loop {
            match poll_hub(&hub, &store).await {
                Ok(count) => {
                    if count > 0 {
                        info!("polled {} node(s) from {}", count, hub.addr);
                    }
                }
                Err(e) => {
                    error!("poll failed for {}: {}", hub.addr, e);
                }
            }
            time::sleep(interval).await;
        }
    });
}

async fn poll_hub(hub: &HubConfig, store: &Store) -> anyhow::Result<usize> {
    let mut client = HubClient::connect(hub.addr).await?;
    client.set_timeout(Duration::from_secs(5));

    let resp = client.read_current_data().await?;
    match resp {
        Response::DataPacket(packet) => {
            let count = packet.nodes.len();
            ingest_packet(&packet, hub, store).await;
            Ok(count)
        }
        _ => {
            warn!("unexpected response from {}: {:?}", hub.addr, resp);
            Ok(0)
        }
    }
}

async fn ingest_packet(packet: &DataPacket, hub: &HubConfig, store: &Store) {
    let now = chrono::Utc::now();

    // Build a timestamp from the packet's date fields.
    let packet_ts = {
        let year = (2000 + packet.year as i32).clamp(1, 9999);
        let dt = chrono::NaiveDate::from_ymd_opt(year, packet.month as u32, packet.day as u32)
            .and_then(|d| d.and_hms_opt(packet.hour as u32, packet.minute as u32, 0));
        dt.map(|dt| dt.and_utc().timestamp_millis())
            .unwrap_or_else(|| now.timestamp_millis())
    };

    for node in &packet.nodes {
        let device_id = resolve_device_id(node, hub);
        let ts_str = packet_ts.to_string();

        let metric = MetricData {
            metric: "0102060302".into(), // 氡及子体浓度实时值
            name: "氡及子体浓度实时值".into(),
            timestamp: ts_str.clone(),
            value: node.radon_concentration as f64,
            unit: "Bq/m³".into(),
            alarm: AlarmField::None,
        };

        // Upsert device.
        let existing = store.get_device(&device_id).await;
        let device = Device {
            id: device_id.clone(),
            code: format!("BR-RADON-C24-{:03}", node.node_id),
            name: existing
                .as_ref()
                .map(|d| d.name.clone())
                .unwrap_or_else(|| format!("空气测氡仪-节点{}", node.node_id)),
            device_type: DeviceType::Radon,
            station: hub.station.clone(),
            status: DeviceStatus::Online,
            metrics: vec![metric],
            last_update: now.to_rfc3339(),
            alarms: vec![],
        };
        store.upsert_device(device).await;

        // Append to history.
        store
            .append_measurement(
                &device_id,
                "0102060302",
                HistoricalPoint {
                    timestamp: packet_ts,
                    value: node.radon_concentration as f64,
                },
            )
            .await;
    }

    store
        .on_data_ingested(
            &packet
                .nodes
                .iter()
                .map(|n| resolve_device_id(n, hub))
                .collect::<Vec<_>>(),
        )
        .await;
}

fn resolve_device_id(node: &NodeData, hub: &HubConfig) -> String {
    hub.node_device_map
        .as_ref()
        .and_then(|m| m.get(&node.node_id).cloned())
        .unwrap_or_else(|| format!("hs05g-{}-node-{:02}", hub.addr.port(), node.node_id))
}
