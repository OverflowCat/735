use axum::Json;
use axum::extract::{Path, Query, State};
use chrono::Utc;
use serde::Deserialize;

use crate::model::HistoricalPoint;
use crate::store::{Store, TimeRange};

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub metric: String,
    /// Relative window ("15m" | "1h" | "24h" | "7d"). Ignored when start_ms/end_ms are set.
    #[serde(default)]
    pub range: Option<String>,
    /// Absolute window start (unix ms).
    #[serde(default)]
    pub start_ms: Option<i64>,
    /// Absolute window end (unix ms).
    #[serde(default)]
    pub end_ms: Option<i64>,
}

/// GET /api/v1/devices/:id/history?metric=xxx&range=15m
/// GET /api/v1/devices/:id/history?metric=xxx&start_ms=...&end_ms=...
///
/// Prefer absolute `start_ms`/`end_ms` when both are present; otherwise fall
/// back to the relative `range` ending at "now".
pub async fn get_history(
    State(store): State<Store>,
    Path(id): Path<String>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<Vec<HistoricalPoint>>, axum::http::StatusCode> {
    let (start_ms, end_ms) = resolve_window(&q)?;
    if start_ms > end_ms {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }
    let points = store.query_history(&id, &q.metric, start_ms, end_ms).await;
    Ok(Json(points))
}

fn resolve_window(q: &HistoryQuery) -> Result<(i64, i64), axum::http::StatusCode> {
    if let (Some(start), Some(end)) = (q.start_ms, q.end_ms) {
        return Ok((start, end));
    }
    let range = q
        .range
        .as_deref()
        .and_then(TimeRange::from_str)
        .ok_or(axum::http::StatusCode::BAD_REQUEST)?;
    let end = Utc::now().timestamp_millis();
    Ok((end - range.as_duration_ms(), end))
}
