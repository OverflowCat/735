use crate::error::{Hs05gError, Result};
use crate::protocol::{
    self, Rj45Cmd, Response, RJ45_LONG_RESPONSE_LEN, RJ45_REQUEST_LEN, RJ45_SHORT_RESPONSE_LEN,
};
use bytes::BytesMut;
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{debug, info};
use std::time::Duration;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

/// TCP client for communicating with an HS05G hub over the RJ45 network interface.
pub struct HubClient {
    stream: TcpStream,
    read_buf: BytesMut,
    timeout: Duration,
}

impl HubClient {
    /// Connect to an HS05G hub at the given address.
    pub async fn connect(addr: SocketAddr) -> Result<Self> {
        let stream = TcpStream::connect(addr).await?;
        info!("connected to hub at {}", addr);
        Ok(Self {
            stream,
            read_buf: BytesMut::with_capacity(RJ45_LONG_RESPONSE_LEN),
            timeout: DEFAULT_TIMEOUT,
        })
    }

    /// Set the response timeout.
    pub fn set_timeout(&mut self, timeout: Duration) {
        self.timeout = timeout;
    }

    /// Send a raw 12-byte request and read the response.
    async fn request_raw(&mut self, request: &[u8; RJ45_REQUEST_LEN], expected_len: usize) -> Result<BytesMut> {
        debug!("sending: {:02x?}", request);
        self.stream.write_all(request).await?;

        // Read exactly `expected_len` bytes with timeout.
        self.read_buf.clear();
        while self.read_buf.len() < expected_len {
            let n = tokio::time::timeout(self.timeout, self.stream.read_buf(&mut self.read_buf))
                .await
                .map_err(|_| Hs05gError::Timeout)?
                .map_err(Hs05gError::Io)?;
            if n == 0 {
                return Err(Hs05gError::ConnectionClosed);
            }
        }
        debug!("received {} bytes: {:02x?}", self.read_buf.len(), &self.read_buf[..]);
        Ok(self.read_buf.split_to(expected_len))
    }

    /// Send an RJ45 command and parse the response.
    pub async fn send_command(&mut self, cmd: Rj45Cmd, params: &[u8; 6], spare: u8) -> Result<Response> {
        let request = protocol::build_rj45_request(cmd, params, spare);
        let expected = cmd.response_len();
        let buf = self.request_raw(&request, expected).await?;
        protocol::parse_response(cmd, &buf)
    }

    // ── High-level convenience methods ───────────────────────────

    /// Read current measurement data from all active nodes.
    pub async fn read_current_data(&mut self) -> Result<Response> {
        self.send_command(Rj45Cmd::ReadCurrentData, &[0u8; 6], 0)
            .await
    }

    /// Set the measurement period.
    pub async fn set_period(&mut self, period: u8) -> Result<Response> {
        let mut params = [0u8; 6];
        params[0] = period;
        self.send_command(Rj45Cmd::SetPeriod, &params, 0).await
    }

    /// Set the hub ID.
    pub async fn set_hub_id(&mut self, hub_id: u8) -> Result<Response> {
        let mut params = [0u8; 6];
        params[0] = hub_id;
        self.send_command(Rj45Cmd::SetHubId, &params, 0).await
    }

    /// Set the number of managed radon monitors.
    pub async fn set_device_count(&mut self, count: u8) -> Result<Response> {
        let mut params = [0u8; 6];
        params[0] = count;
        self.send_command(Rj45Cmd::SetDeviceCount, &params, 0).await
    }

    /// Erase all stored data on the hub.
    pub async fn erase_data(&mut self) -> Result<Response> {
        self.send_command(Rj45Cmd::EraseData, &[0u8; 6], 0).await
    }

    /// Set the hub's RTC to the current system time.
    pub async fn set_rtc(&mut self) -> Result<Response> {
        let request = protocol::build_set_rtc();
        let buf = self.request_raw(&request, RJ45_SHORT_RESPONSE_LEN).await?;
        protocol::parse_response(Rj45Cmd::SetRtc, &buf)
    }

    /// Control OLED display blinking.
    pub async fn set_oled_display(&mut self, blink: bool) -> Result<Response> {
        let request = protocol::build_set_oled_display(blink);
        let buf = self.request_raw(&request, RJ45_SHORT_RESPONSE_LEN).await?;
        protocol::parse_response(Rj45Cmd::SetOledDisplay, &buf)
    }

    /// Read the number of stored data files.
    pub async fn read_file_count(&mut self) -> Result<Response> {
        self.send_command(Rj45Cmd::ReadFileCount, &[0u8; 6], 0)
            .await
    }

    /// Read data from a specific file number.
    pub async fn read_file_data(&mut self, file_num: u16) -> Result<Response> {
        let request = protocol::build_read_file_data(file_num);
        let buf = self.request_raw(&request, RJ45_LONG_RESPONSE_LEN).await?;
        protocol::parse_response(Rj45Cmd::ReadFileData, &buf)
    }

    /// Software reset all connected nodes.
    pub async fn software_reset(&mut self) -> Result<Response> {
        self.send_command(Rj45Cmd::SoftwareReset, &[0u8; 6], 0)
            .await
    }

    /// Read hub parameters (node count, file number, RTC).
    pub async fn read_params(&mut self) -> Result<Response> {
        self.send_command(Rj45Cmd::ReadParams, &[0u8; 6], 0).await
    }
}