use axum::Json;
use axum::extract::State;
use chrono::Utc;

use crate::model::*;
use crate::store::Store;

/// POST /api/v1/monitor/data
///
/// Accepts a batch of device reports (matching protocol.typ 实时监测数据上报).
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
            store
                .append_measurement(
                    &report.device,
                    &m.metric,
                    HistoricalPoint {
                        timestamp: m.timestamp,
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
/// Accepts a batch of heartbeat reports (matching protocol.typ 设备心跳上报).
/// Updates device online/offline/fault status.
pub async fn upload_heartbeat(
    State(store): State<Store>,
    Json(reports): Json<Vec<HeartbeatReport>>,
) -> Json<ApiResponse> {
    for report in &reports {
        let existing = store.get_device(&report.device).await;
        let device = Device {
            id: report.device.clone(),
            name: existing
                .as_ref()
                .map(|d| d.name.clone())
                .unwrap_or_else(|| report.device.clone()),
            device_type: report.device_type.clone(),
            station: report.station.clone(),
            status: report.status.clone(),
            metrics: existing
                .as_ref()
                .map(|d| d.metrics.clone())
                .unwrap_or_default(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::memory::MemoryStore;
    use std::sync::Arc;

    #[tokio::test]
    async fn reports_and_history_use_device_id_without_device_code() {
        let store: Store = Arc::new(MemoryStore::new());
        let reports = serde_json::from_value(serde_json::json!([{
            "station": "STATION-01",
            "device": "2026012905",
            "metrics": [{
                "metric": "0102060301",
                "name": "γ剂量率实时值",
                "timestamp": 1792980000000i64,
                "value": 45.0,
                "unit": "nSv/h",
                "alarm": false
            }]
        }]))
        .unwrap();
        let Json(response) = upload_data(State(store.clone()), Json(reports)).await;
        assert_eq!(response.code, 200);

        let heartbeats = serde_json::from_value(serde_json::json!([{
            "station": "STATION-01",
            "device": "2026012905",
            "type": "gamma",
            "status": "offline",
            "timestamp": 1792980060000i64
        }]))
        .unwrap();
        let Json(response) = upload_heartbeat(State(store.clone()), Json(heartbeats)).await;
        assert_eq!(response.code, 200);

        let Json(devices) = crate::api::devices::list_devices(State(store.clone())).await;
        assert_eq!(devices.len(), 1);
        let json = serde_json::to_value(&devices[0]).unwrap();
        assert_eq!(json["id"], "2026012905");
        assert_eq!(json["status"], "offline");
        assert!(json.get("code").is_none());
        assert_eq!(devices[0].metrics[0].value, 45.0);

        let history = store
            .query_history("2026012905", "0102060301", 1792980000000, 1792980000000)
            .await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].value, 45.0);
    }
}
