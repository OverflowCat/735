use clap::{Parser, Subcommand};
use std::net::SocketAddr;
use tracing::info;
use tracing_subscriber::EnvFilter;

use hs05g::{HubClient, Response};

#[derive(Parser)]
#[command(name = "hs05g", about = "HS05G radon monitor hub client")]
struct Cli {
    /// Hub address (host:port)
    #[arg(short, long, default_value = "192.168.1.100:5000")]
    addr: SocketAddr,

    /// Response timeout in seconds
    #[arg(short, long, default_value = "5")]
    timeout: u64,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Read current measurement data from all nodes
    Read,
    /// Set measurement period (seconds)
    SetPeriod { period: u8 },
    /// Set hub ID
    SetHubId { id: u8 },
    /// Set number of managed radon monitors
    SetDeviceCount { count: u8 },
    /// Erase all stored data
    Erase,
    /// Set hub RTC to current system time
    SetRtc,
    /// Control OLED display blinking
    Oled { #[arg(long)] blink: bool },
    /// Read number of stored data files
    FileCount,
    /// Read data from a specific file number
    FileData { file_num: u16 },
    /// Software reset all nodes
    Reset,
    /// Read hub parameters
    Params,
    /// Poll data continuously at a given interval
    Poll {
        /// Interval in seconds between reads
        #[arg(short, long, default_value = "30")]
        interval: u64,
        /// Output format: text or json
        #[arg(short, long, default_value = "text")]
        format: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("hs05g=info".parse()?))
        .init();

    let cli = Cli::parse();
    let timeout = std::time::Duration::from_secs(cli.timeout);

    let mut client = HubClient::connect(cli.addr).await?;
    client.set_timeout(timeout);
    info!("connected to {}", cli.addr);

    match cli.command {
        Commands::Read => {
            let resp = client.read_current_data().await?;
            print_response(&resp);
        }
        Commands::SetPeriod { period } => {
            let resp = client.set_period(period).await?;
            print_response(&resp);
        }
        Commands::SetHubId { id } => {
            let resp = client.set_hub_id(id).await?;
            print_response(&resp);
        }
        Commands::SetDeviceCount { count } => {
            let resp = client.set_device_count(count).await?;
            print_response(&resp);
        }
        Commands::Erase => {
            let resp = client.erase_data().await?;
            print_response(&resp);
        }
        Commands::SetRtc => {
            let resp = client.set_rtc().await?;
            print_response(&resp);
        }
        Commands::Oled { blink } => {
            let resp = client.set_oled_display(blink).await?;
            print_response(&resp);
        }
        Commands::FileCount => {
            let resp = client.read_file_count().await?;
            print_response(&resp);
        }
        Commands::FileData { file_num } => {
            let resp = client.read_file_data(file_num).await?;
            print_response(&resp);
        }
        Commands::Reset => {
            let resp = client.software_reset().await?;
            print_response(&resp);
        }
        Commands::Params => {
            let resp = client.read_params().await?;
            print_response(&resp);
        }
        Commands::Poll { interval, format } => {
            let interval = std::time::Duration::from_secs(interval);
            info!("polling every {}s (Ctrl-C to stop)", interval.as_secs());
            loop {
                match client.read_current_data().await {
                    Ok(resp) => match &resp {
                        Response::DataPacket(packet) => {
                            if format == "json" {
                                println!("{}", serde_json::to_string(packet)?);
                            } else {
                                print!("{}", packet);
                            }
                        }
                        _ => print_response(&resp),
                    },
                    Err(e) => {
                        tracing::error!("read failed: {}", e);
                    }
                }
                tokio::time::sleep(interval).await;
            }
        }
    }

    Ok(())
}

fn print_response(resp: &Response) {
    match resp {
        Response::Ok { cmd } => println!("OK (cmd=0x{:02X})", cmd),
        Response::DataPacket(packet) => print!("{}", packet),
        Response::FileData(packet) => {
            println!("[file data]");
            print!("{}", packet);
        }
        Response::FileCount(fc) => {
            println!("files: {}", fc.file_number);
        }
        Response::Params(p) => {
            println!(
                "nodes={}  file={}  20{:02}-{:02}-{:02} {:02}:{:02}",
                p.node_count, p.file_number, p.year, p.month, p.day, p.hour, p.minute,
            );
        }
        Response::Raw(sr) => {
            println!("raw response (cmd=0x{:02X}): {:02x?}", sr.cmd, sr.data);
        }
    }
}