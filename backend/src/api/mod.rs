pub mod devices;
pub mod history;
pub mod scene;
pub mod upload;

use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::store::Store;

/// Build the full API router.
pub fn router(store: Store) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .nest("/api/v1", api_routes(store.clone()))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

fn api_routes(store: Store) -> Router {
    Router::new()
        .route("/devices", axum::routing::get(devices::list_devices))
        .route("/devices/{id}", axum::routing::get(devices::get_device))
        .route(
            "/devices/{id}/history",
            axum::routing::get(history::get_history),
        )
        .route("/scene", axum::routing::get(scene::get_scene))
        .route("/scene", axum::routing::put(scene::update_scene))
        .route("/monitor/data", axum::routing::post(upload::upload_data))
        .route(
            "/device/heartbeat",
            axum::routing::post(upload::upload_heartbeat),
        )
        .with_state(store)
}
