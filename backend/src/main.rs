mod api;
mod devices;
mod gamma;
mod gamma_poller;
mod hs05g_poller;
mod model;
mod radon_rs485;
mod store;

use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use gamma_poller::GammaConfig;
use hs05g_poller::HubConfig;
use store::memory::MemoryStore;

#[derive(Parser)]
#[command(name = "backend", about = "735 monitoring platform backend")]
struct Cli {
    /// HTTP listen address
    #[arg(short, long, default_value = "0.0.0.0:3000")]
    listen: SocketAddr,

    /// HS05G hub addresses to poll (host:port), repeatable
    #[arg(long = "hub")]
    hubs: Vec<SocketAddr>,

    /// HS05G polling interval in seconds
    #[arg(long, default_value = "30")]
    hub_interval: u64,

    /// Station name for HS05G reports
    #[arg(long, default_value = "STATION-01")]
    station: String,

    /// Device inventory JSON (id/addr/gammaAddr/radonNode). Preferred over --gamma.
    #[arg(long)]
    devices: Option<std::path::PathBuf>,

    /// Gamma dose-rate monitor serial-tunnel addresses (host:port), repeatable
    #[arg(long = "gamma")]
    gammas: Vec<String>,

    /// RMS-200 display-unit address (0~FF) for --gamma devices
    #[arg(long, default_value = "1")]
    gamma_addr: u8,

    /// Gamma polling interval in seconds
    #[arg(long, default_value = "30")]
    gamma_interval: u64,

    /// Gamma device human-readable name
    #[arg(long, default_value = "γ剂量率监测仪")]
    gamma_name: String,

    /// Persistent data directory (uses nekostore-backed store; omit for in-memory)
    #[arg(long)]
    data_dir: Option<std::path::PathBuf>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("backend=info".parse()?)
                .add_directive("tower_http=info".parse()?),
        )
        .init();

    let cli = Cli::parse();

    // Initialize store: nekostore-backed (date-partitioned) if data_dir given,
    // otherwise in-memory for development.
    let store: store::Store = match &cli.data_dir {
        Some(dir) => {
            let tsdb = store::tsdb::TsdStore::open(dir)
                .map_err(|e| anyhow::anyhow!("open data dir {}: {e}", dir.display()))?;
            tracing::info!("using nekostore-backed TsdStore at {}", dir.display());
            Arc::new(tsdb)
        }
        None => {
            tracing::info!("using in-memory store (no --data-dir)");
            Arc::new(MemoryStore::new())
        }
    };

    // Start HS05G hub pollers.
    for addr in &cli.hubs {
        let hub_config = HubConfig {
            addr: *addr,
            interval_secs: cli.hub_interval,
            node_device_map: None,
            station: cli.station.clone(),
        };
        hs05g_poller::spawn_hub_poller(hub_config, store.clone());
        tracing::info!("registered HS05G hub poller for {}", addr);
    }

    // Device inventory (SN ids). Radon is probed on every shared-bus tunnel.
    let mut n_gamma = 0usize;
    if let Some(path) = &cli.devices {
        let list = devices::load_devices(path)?;
        for entry in &list {
            let cfg = GammaConfig {
                addr: entry.addr.clone(),
                source_id: entry.id.clone(),
                interval_secs: cli.gamma_interval,
                station: cli.station.clone(),
                device_name: entry.display_name(),
                device_addr: entry.gamma_addr,
            };
            n_gamma += 1;
            gamma_poller::spawn_gamma_poller(cfg, store.clone());
            tracing::info!("registered device poller {} -> {}", entry.id, entry.addr);
        }
    }

    // Legacy --gamma pollers (same shared-bus radon probe).
    for (i, addr) in cli.gammas.iter().enumerate() {
        let source_id = format!("gamma_{:02}", i + 1);
        let gamma_config = GammaConfig {
            addr: addr.clone(),
            source_id,
            interval_secs: cli.gamma_interval,
            station: cli.station.clone(),
            device_name: cli.gamma_name.clone(),
            device_addr: cli.gamma_addr,
        };
        n_gamma += 1;
        gamma_poller::spawn_gamma_poller(gamma_config, store.clone());
        tracing::info!("registered gamma poller for {}", addr);
    }

    tracing::info!(
        "device summary: {} gamma poller(s) [all probe radon on same bus]",
        n_gamma
    );

    // Build and start HTTP server.
    let app = api::router(store);
    let listener = tokio::net::TcpListener::bind(cli.listen).await?;
    tracing::info!("listening on {}", cli.listen);
    axum::serve(listener, app).await?;

    Ok(())
}
