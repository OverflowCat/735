// Gamma dose-rate poller (RMS-200 / RMS-2000 display unit).
//
// Periodically connects to the serial tunnel, reads real-time dose rate,
// then ingests the sample into the store.

use crate::gamma::RmsClient;
use crate::model::*;
use crate::store::Store;
use std::time::Duration;
use tokio::time;
use tracing::{error, info};

/// Configuration for a gamma dose-rate monitor.
#[derive(Debug, Clone)]
pub struct GammaConfig {
    /// TCP serial-tunnel address, e.g. "192.168.10.11:4000"
    pub addr: String,
    /// Stable device identifier, e.g. "gamma_01"
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

/// Spawn a background task that polls a gamma dose-rate monitor.
pub fn spawn_gamma_poller(config: GammaConfig, store: Store) {
    tokio::spawn(async move {
        let interval = Duration::from_secs(config.interval_secs);
        info!(
            "gamma poller started for {} ({}) every {}s",
            config.addr, config.source_id, config.interval_secs
        );

        loop {
            match poll_gamma(&config, &store).await {
                Ok(()) => {}
                Err(e) => {
                    error!("gamma poll failed for {}: {}", config.addr, e);
                }
            }
            time::sleep(interval).await;
        }
    });
}

/// Metric code for γ dose rate (from protocol.typ).
const METRIC_DOSE_RATE: &str = "0102060301";

async fn poll_gamma(config: &GammaConfig, store: &Store) -> anyhow::Result<()> {
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
        alarm: AlarmField::None, // Alarm logic is client-side for now.
    };

    let metrics = vec![dose_metric];

    // Upsert device.
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
        metrics,
        last_update: now.to_rfc3339(),
        alarms: vec![],
    };
    store.upsert_device(device).await;

    // Append primary metric to history.
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

    store
        .on_data_ingested(&[config.source_id.clone()])
        .await;

    Ok(())
}
