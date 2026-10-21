// HS05G radon node over the shared RS485 serial tunnel.
//
// Radon RS485 is paralleled with the RMS-200 bus, so frames travel the same
// TCP serial tunnel (EPORT HF5111B). Framing is the HS05G 探头 RS485 protocol:
//
//   Request:  A5 5A <node_id> 03 03 03 00 00          (8 bytes, ReadData)
//   Response: A5 5A <node_id> radon_hi radon_lo
//                    count_hi count_lo temp humidity period node_id
//             (11 bytes = 3-byte header + 8-byte measurement)
//
// Radon concentration is big-endian u16, unit Bq/m³.

use anyhow::{Context, Result, bail};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

pub const HEADER_0: u8 = 0xA5;
pub const HEADER_1: u8 = 0x5A;
const CMD_READ_DATA: u8 = 0x03;
pub const REQUEST_LEN: usize = 8;
pub const RESPONSE_LEN: usize = 11;

#[derive(Debug, Clone, Copy)]
pub struct RadonReading {
    pub node_id: u8,
    pub radon: u16,
    pub count: u16,
    pub temperature: u8,
    pub humidity: u8,
    pub period: u8,
}

/// Build an RS485 ReadData request for `node_id`.
pub fn build_read_data(node_id: u8) -> [u8; REQUEST_LEN] {
    [
        HEADER_0,
        HEADER_1,
        node_id,
        CMD_READ_DATA,
        CMD_READ_DATA,
        CMD_READ_DATA,
        0,
        0,
    ]
}

/// Parse an 11-byte RS485 ReadData response.
pub fn parse_read_data(buf: &[u8]) -> Result<RadonReading> {
    if buf.len() < RESPONSE_LEN {
        bail!(
            "hs05g-rs485: short response {} bytes (want {})",
            buf.len(),
            RESPONSE_LEN
        );
    }
    if buf[0] != HEADER_0 || buf[1] != HEADER_1 {
        bail!("hs05g-rs485: bad header {:02X} {:02X}", buf[0], buf[1]);
    }
    Ok(RadonReading {
        node_id: buf[10],
        radon: u16::from_be_bytes([buf[3], buf[4]]),
        count: u16::from_be_bytes([buf[5], buf[6]]),
        temperature: buf[7],
        humidity: buf[8],
        period: buf[9],
    })
}

/// Node-id scan window used when a bus has no known radon node yet.
/// Field units sit in 30–50; keep the probe tight so poll cycles stay short.
pub const DISCOVER_RANGE: std::ops::RangeInclusive<u8> = 30..=50;

/// Read one radon sample from `node_id` on an existing serial-tunnel stream.
///
/// Used after an RMS-200 transaction on the same TCP connection — the bus is
/// shared, so protocols take turns.
pub async fn read_node(stream: &mut TcpStream, node_id: u8) -> Result<RadonReading> {
    read_node_timeout(stream, node_id, Duration::from_secs(2)).await
}

async fn read_node_timeout(
    stream: &mut TcpStream,
    node_id: u8,
    timeout: Duration,
) -> Result<RadonReading> {
    let req = build_read_data(node_id);
    stream.write_all(&req).await.context("hs05g-rs485: write")?;
    stream.flush().await?;

    let mut buf = [0u8; RESPONSE_LEN];
    tokio::time::timeout(timeout, stream.read_exact(&mut buf))
        .await
        .context("hs05g-rs485: read timeout")?
        .context("hs05g-rs485: read")?;

    // Only accept HS05G frames. RMS-200 may leave a stale reply on the shared bus.
    if buf[0] != HEADER_0 || buf[1] != HEADER_1 {
        bail!(
            "hs05g-rs485: non-hs05g reply from node {} ({:02X?})",
            node_id,
            buf
        );
    }
    let reading = parse_read_data(&buf)?;
    if reading.node_id != node_id && reading.node_id != 0 {
        tracing::debug!(
            "hs05g-rs485: node_id mismatch (req={}, resp={})",
            node_id,
            reading.node_id
        );
    }
    Ok(reading)
}

/// Probe the shared bus for a live radon node. Returns the first valid reading.
pub async fn discover_node(stream: &mut TcpStream) -> Result<RadonReading> {
    for node_id in DISCOVER_RANGE {
        match read_node_timeout(stream, node_id, Duration::from_millis(300)).await {
            Ok(r) => return Ok(r),
            Err(_) => {
                // brief settle before the next node attempt
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }
    }
    bail!("hs05g-rs485: no node replied in {:?}", DISCOVER_RANGE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_frame() {
        assert_eq!(build_read_data(36), [0xA5, 0x5A, 36, 3, 3, 3, 0, 0]);
    }

    #[test]
    fn parse_frame() {
        // node 36, radon=1200 (0x04B0), count=50, temp=25, hum=60, period=30
        let buf = [0xA5, 0x5A, 36, 0x04, 0xB0, 0x00, 0x32, 25, 60, 30, 36];
        let r = parse_read_data(&buf).unwrap();
        assert_eq!(r.node_id, 36);
        assert_eq!(r.radon, 1200);
        assert_eq!(r.count, 50);
        assert_eq!(r.temperature, 25);
        assert_eq!(r.humidity, 60);
        assert_eq!(r.period, 30);
    }

    #[test]
    fn reject_bad_header() {
        let buf = [0x00, 0x00, 1, 0, 0, 0, 0, 0, 0, 0, 1];
        assert!(parse_read_data(&buf).is_err());
    }
}
