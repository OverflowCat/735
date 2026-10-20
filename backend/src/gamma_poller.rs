// Gamma spectrometer poller.
//
// Periodically connects to the gamma device, reads spectrum and analysis results,
// then ingests the data into the store.

use crate::gamma::GammaClient;
use crate::model::*;
use crate::store::Store;
use std::time::Duration;
use tokio::time;
use tracing::{error, info};

/// Configuration for a gamma spectrometer.
#[derive(Debug, Clone)]
pub struct GammaConfig {
    /// TCP address, e.g. "192.168.1.200:4000"
    pub addr: String,
    /// Stable device identifier, e.g. "gamma_01"
    pub source_id: String,
    /// Polling interval in seconds (default 30 per protocol).
    pub interval_secs: u64,
    /// Station identifier for reports.
    pub station: String,
    /// Human-readable device name.
    pub device_name: String,
}

/// Spawn a background task that polls a gamma spectrometer.
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
const METRIC_NUCLIDE_PREFIX: &str = "0102060301_nuclide";

async fn poll_gamma(config: &GammaConfig, store: &Store) -> anyhow::Result<()> {
    let mut client = GammaClient::connect(&config.addr).await?;

    info!("gamma: reading spectrum from {}", config.addr);
    let (spectrum, result) = client.read_spectrum_and_result().await?;
    info!(
        "gamma: spectrum channels={}, dose_rate={:.4} nGy/h, nuclides={}",
        spectrum.spectrum.len(),
        result.total_dose_rate,
        result.nuclides.len()
    );

    let now = chrono::Utc::now();
    let ts_ms = now.timestamp_millis();
    let ts_str = ts_ms.to_string();

    // Primary metric: total dose rate.
    let dose_metric = MetricData {
        metric: METRIC_DOSE_RATE.into(),
        name: "γ剂量率实时值".into(),
        timestamp: ts_str.clone(),
        value: result.total_dose_rate as f64,
        unit: "nGy/h".into(),
        alarm: AlarmField::None, // Alarm logic is client-side for now.
    };

    let mut metrics = vec![dose_metric];

    // Secondary metrics: nuclide count, spectrum metadata.
    metrics.push(MetricData {
        metric: format!("{}_count", METRIC_NUCLIDE_PREFIX),
        name: "核素数量".into(),
        timestamp: ts_str.clone(),
        value: result.nuclides.len() as f64,
        unit: "".into(),
        alarm: AlarmField::None,
    });

    metrics.push(MetricData {
        metric: "0102060301_total_counts".into(),
        name: "全谱总计数".into(),
        timestamp: ts_str.clone(),
        value: spectrum.spectrum.iter().map(|&c| c as u64).sum::<u64>() as f64,
        unit: "count".into(),
        alarm: AlarmField::None,
    });

    metrics.push(MetricData {
        metric: "0102060301_channel_count".into(),
        name: "能谱道数".into(),
        timestamp: ts_str.clone(),
        value: spectrum.spectrum.len() as f64,
        unit: "".into(),
        alarm: AlarmField::None,
    });

    metrics.push(MetricData {
        metric: "0102060301_real_time".into(),
        name: "实时间".into(),
        timestamp: ts_str.clone(),
        value: spectrum.real_time as f64,
        unit: "s".into(),
        alarm: AlarmField::None,
    });

    metrics.push(MetricData {
        metric: "0102060301_live_time".into(),
        name: "活时间".into(),
        timestamp: ts_str.clone(),
        value: spectrum.live_time as f64,
        unit: "s".into(),
        alarm: AlarmField::None,
    });

    // Per-nuclide metrics (dose_rate, activity, confidence).
    for (i, n) in result.nuclides.iter().enumerate() {
        let prefix = format!("{}_{}", METRIC_NUCLIDE_PREFIX, i);

        metrics.push(MetricData {
            metric: format!("{}_dose_rate", prefix),
            name: format!("核素{}剂量率", n.name),
            timestamp: ts_str.clone(),
            value: n.dose_rate as f64,
            unit: "nGy/h".into(),
            alarm: AlarmField::None,
        });

        metrics.push(MetricData {
            metric: format!("{}_activity", prefix),
            name: format!("核素{}活度", n.name),
            timestamp: ts_str.clone(),
            value: n.activity as f64,
            unit: "Bq".into(),
            alarm: AlarmField::None,
        });

        metrics.push(MetricData {
            metric: format!("{}_confidence", prefix),
            name: format!("核素{}置信度", n.name),
            timestamp: ts_str.clone(),
            value: n.confidence as f64,
            unit: "%".into(),
            alarm: AlarmField::None,
        });
    }

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
                value: result.total_dose_rate as f64,
            },
        )
        .await;

    store
        .on_data_ingested(&[config.source_id.clone()])
        .await;

    Ok(())
}