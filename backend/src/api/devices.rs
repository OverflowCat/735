use axum::extract::{Path, State};
use axum::Json;

use crate::model::Device;
use crate::store::Store;

/// GET /api/v1/devices
pub async fn list_devices(State(store): State<Store>) -> Json<Vec<Device>> {
    Json(store.list_devices().await)
}

/// GET /api/v1/devices/:id
pub async fn get_device(
    State(store): State<Store>,
    Path(id): Path<String>,
) -> Result<Json<Device>, axum::http::StatusCode> {
    store
        .get_device(&id)
        .await
        .map(Json)
        .ok_or(axum::http::StatusCode::NOT_FOUND)
}