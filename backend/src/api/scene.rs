use axum::extract::State;
use axum::Json;

use crate::model::FactoryScene;
use crate::store::Store;

/// GET /api/v1/scene
pub async fn get_scene(State(store): State<Store>) -> Json<FactoryScene> {
    Json(store.get_scene().await)
}

/// PUT /api/v1/scene
pub async fn update_scene(
    State(store): State<Store>,
    Json(scene): Json<FactoryScene>,
) -> Json<FactoryScene> {
    store.save_scene(scene.clone()).await;
    Json(scene)
}