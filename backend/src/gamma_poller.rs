// Field-device poller (RMS-200 γ dose rate + HS05G radon on the same bus).
//
// One TCP serial-tunnel connection per device. Radon RS485 shares the bus
// with RMS-200 (same IP:port). Every gamma tunnel is probed for radon after
// the dose-rate read — no separate radon endpoint.

use crate::gamma::RmsClient;
use crate::model::*;
use crate::radon_rs485;
use crate::store::Store;
use std::time::Duration;
use tokio::time;
use tracing::{error, info, warn};

/// Configuration for one field device on a serial tunnel.
#[derive(Debug, Clone)]
pub struct GammaConfig {
    /// TCP serial-tunnel address, e.g. "192.168.10.11:4000"
    pub addr: String,
    /// Stable device identifier (asset SN, e.g. "2026012929")
    pub source_id: String,
    /// Polling interval in seconds.
    pub interval_secs: u64,
    /// Station identifier for reports.
    pub station: String,
    /// Human-readable device name.
    pub device_name: String,
    /// RMS-200 display-unit address (0~FF).
    pub device_addr: u8,
}

/// Spawn a background task that polls one field device at the configured interval.
pub fn spawn_gamma_poller(config: GammaConfig, store: Store) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(config.interval_secs);
        info!(
            "device poller started for {} ({}) every {}s [gamma+radon]",
            config.addr, config.source_id, config.interval_secs
        );

        // Cached radon node id on this shared bus (None until discovered).
        let mut radon_node: Option<u8> = None;

        loop {
            match poll_device(&config, &store, &mut radon_node).await {
                Ok(()) => {}
                Err(e) => {
                    error!("poll failed for {}: {}", config.addr, e);
                }
            }
            time::sleep(interval).await;
        }
    });
}

/// Metric code for γ dose rate (from protocol.typ).
const METRIC_DOSE_RATE: &str = "0102060301";
/// Metric code for radon concentration (from protocol.typ).
const METRIC_RADON: &str = "0102060302";

async fn poll_device(
    config: &GammaConfig,
    store: &Store,
    radon_node: &mut Option<u8>,
) -> anyhow::Result<()> {
    // Gamma (RMS-200).
    let mut client = RmsClient::connect(&config.addr, config.device_addr).await?;
    let reading = client.read_dose_rate().await?;
    info!(
        "gamma: {} dose_rate={:.4} nGy/h updated={} addr=0x{:02X}",
        config.addr, reading.dose_rate, reading.updated, reading.address
    );

    let now = chrono::Utc::now();
    let ts_ms = now.timestamp_millis();
    let ts_str = ts_ms.to_string();

    let dose_metric = MetricData {
        metric: METRIC_DOSE_RATE.into(),
        name: "γ剂量率实时值".into(),
        timestamp: ts_str.clone(),
        value: reading.dose_rate,
        unit: "nGy/h".into(),
        alarm: AlarmField::None,
    };

    let existing = store.get_device(&config.source_id).await;
    let device = Device {
        id: config.source_id.clone(),
        code: format!("BR-GAMMA-{}", config.source_id),
        name: existing
            .as_ref()
            .map(|d| d.name.clone())
            .unwrap_or_else(|| config.device_name.clone()),
        device_type: DeviceType::Gamma,
        station: config.station.clone(),
        status: DeviceStatus::Online,
        metrics: vec![dose_metric],
        last_update: now.to_rfc3339(),
        alarms: vec![],
    };
    store.upsert_device(device).await;
    store
        .append_measurement(
            &config.source_id,
            METRIC_DOSE_RATE,
            HistoricalPoint {
                timestamp: ts_ms,
                value: reading.dose_rate,
            },
        )
        .await;

    let mut touched = vec![config.source_id.clone()];

    // Radon (HS05G RS485) on the SAME bus / same IP:port as RMS-200.
    let radon_result = match radon_node {
        Some(node_id) => radon_rs485::read_node(client.stream_mut(), *node_id).await,
        None => {
            info!("radon: discovering node on {}", config.addr);
            match radon_rs485::discover_node(client.stream_mut()).await {
                Ok(r) => {
                    info!("radon: discovered node {} on {}", r.node_id, config.addr);
                    *radon_node = Some(r.node_id);
                    Ok(r)
                }
                Err(e) => Err(e),
            }
        }
    };

    match radon_result {
        Ok(radon) => {
            let node_id = radon.node_id;
            info!(
                "radon: {} node={} radon={} Bq/m³ count={}",
                config.addr, node_id, radon.radon, radon.count
            );
            ingest_radon(config, store, node_id, &radon, ts_ms).await;
            touched.push(format!("radon-{node_id}"));
        }
        Err(e) => {
            warn!("radon read failed for {}: {}", config.addr, e);
            // Force rediscovery next cycle if the cached node went silent.
            if radon_node.is_some() {
                *radon_node = None;
            }
        }
    }

    store.on_data_ingested(&touched).await;
    Ok(())
}

async fn ingest_radon(
    config: &GammaConfig,
    store: &Store,
    node_id: u8,
    reading: &radon_rs485::RadonReading,
    ts_ms: i64,
) {
    let device_id = format!("radon-{node_id}");
    let ts_str = ts_ms.to_string();
    let metric = MetricData {
        metric: METRIC_RADON.into(),
        name: "氡及子体浓度实时值".into(),
        timestamp: ts_str,
        value: reading.radon as f64,
        unit: "Bq/m³".into(),
        alarm: AlarmField::None,
    };

    let existing = store.get_device(&device_id).await;
    let device = Device {
        id: device_id.clone(),
        code: format!("BR-RADON-C24-{node_id:03}"),
        name: existing
            .as_ref()
            .map(|d| d.name.clone())
            .unwrap_or_else(|| format!("空气测氡仪-{node_id}")),
        device_type: DeviceType::Radon,
        station: config.station.clone(),
        status: DeviceStatus::Online,
        metrics: vec![metric],
        last_update: chrono::Utc::now().to_rfc3339(),
        alarms: vec![],
    };
    store.upsert_device(device).await;
    store
        .append_measurement(
            &device_id,
            METRIC_RADON,
            HistoricalPoint {
                timestamp: ts_ms,
                value: reading.radon as f64,
            },
        )
        .await;
}
