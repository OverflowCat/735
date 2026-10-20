use axum::extract::State;
use axum::Json;
use chrono::Utc;

use crate::model::*;
use crate::store::Store;

/// POST /api/v1/monitor/data
///
/// Accepts a batch of device reports (matching protocol.typ §2.2).
/// Each report contains a device's current metrics.
/// The store is updated and the on_data_ingested hook is called.
pub async fn upload_data(
    State(store): State<Store>,
    Json(reports): Json<Vec<DeviceReport>>,
) -> Json<ApiResponse> {
    let mut ingested_ids = Vec::new();

    for report in &reports {
        // Build or update device from the report.
        let existing = store.get_device(&report.device).await;
        let alarms: Vec<AlarmInfo> = report
            .metrics
            .iter()
            .filter_map(|m| match &m.alarm {
                AlarmField::Active(a) => Some(a.clone()),
                AlarmField::None => None,
            })
            .collect();

        let device = Device {
            id: report.device.clone(),
            code: report.device.clone(),
            name: existing
                .as_ref()
                .map(|d| d.name.clone())
                .unwrap_or_else(|| report.device.clone()),
            device_type: existing
                .as_ref()
                .map(|d| d.device_type.clone())
                .unwrap_or(DeviceType::Radon),
            station: report.station.clone(),
            status: DeviceStatus::Online,
            metrics: report.metrics.clone(),
            last_update: Utc::now().to_rfc3339(),
            alarms,
        };
        store.upsert_device(device).await;

        // Append each metric value to history.
        for m in &report.metrics {
            let ts = m.timestamp.parse::<i64>().unwrap_or(Utc::now().timestamp_millis());
            store
                .append_measurement(
                    &report.device,
                    &m.metric,
                    HistoricalPoint {
                        timestamp: ts,
                        value: m.value,
                    },
                )
                .await;
        }

        ingested_ids.push(report.device.clone());
    }

    store.on_data_ingested(&ingested_ids).await;

    Json(ApiResponse {
        code: 200,
        message: "success".into(),
        time: Utc::now().to_rfc3339(),
    })
}

/// POST /api/v1/device/heartbeat
///
/// Accepts a batch of heartbeat reports (matching protocol.typ §2.3).
/// Updates device online/offline/fault status.
pub async fn upload_heartbeat(
    State(store): State<Store>,
    Json(reports): Json<Vec<HeartbeatReport>>,
) -> Json<ApiResponse> {
    for report in &reports {
        let existing = store.get_device(&report.device).await;
        let device = Device {
            id: report.device.clone(),
            code: report.device.clone(),
            name: existing
                .as_ref()
                .map(|d| d.name.clone())
                .unwrap_or_else(|| report.device.clone()),
            device_type: report.device_type.clone(),
            station: report.station.clone(),
            status: report.status.clone(),
            metrics: existing.as_ref().map(|d| d.metrics.clone()).unwrap_or_default(),
            last_update: Utc::now().to_rfc3339(),
            alarms: existing.map(|d| d.alarms).unwrap_or_default(),
        };
        store.upsert_device(device).await;
    }

    Json(ApiResponse {
        code: 200,
        message: "success".into(),
        time: Utc::now().to_rfc3339(),
    })
}