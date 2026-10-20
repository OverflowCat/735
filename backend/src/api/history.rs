use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;

use crate::model::HistoricalPoint;
use crate::store::{Store, TimeRange};

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub metric: String,
    pub range: String,
}

/// GET /api/v1/devices/:id/history?metric=xxx&range=15m
pub async fn get_history(
    State(store): State<Store>,
    Path(id): Path<String>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<Vec<HistoricalPoint>>, axum::http::StatusCode> {
    let range = TimeRange::from_str(&q.range).ok_or(axum::http::StatusCode::BAD_REQUEST)?;
    let points = store.query_history(&id, &q.metric, range).await;
    Ok(Json(points))
}