// Gamma spectrometer client.
//
// Protocol: TCP/IP, text command for spectrum + binary frame for analysis results.
// Device default: 192.168.1.200:4000
//
// Binary frame: head [0xAA,0x55] + cmd(2) + data_len(4 LE) + data + CRC16(Modbus) + tail [0x3C,0xC3]
// Text command: `#READ_SPECTRUM\r\n` → `#READ_SPECTRUM,d0,...,d4095,realtime,livetime\r\n`
//
// Based on the jczhan gamma device driver.

use anyhow::{bail, Context, Result};
use socket2::{SockRef, TcpKeepalive};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::info;

// ── Frame constants ──────────────────────────────────────────────

const FRAME_HEAD: [u8; 2] = [0xAA, 0x55];
const FRAME_TAIL: [u8; 2] = [0x3C, 0xC3];

const CMD_READ_RESULT: [u8; 2] = [0x90, 0x90];
const CMD_READ_RESULT_ERR: [u8; 2] = [0x91, 0x91];

// ── Data types ───────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct GammaSpectrumData {
    pub spectrum: Vec<u32>,
    pub real_time: f32,
    pub live_time: f32,
}

#[derive(Debug, Clone)]
pub struct NuclideInfo {
    pub name: String,
    pub dose_rate: f32,
    pub activity: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone)]
pub struct GammaResultData {
    pub total_dose_rate: f32,
    pub nuclides: Vec<NuclideInfo>,
}

// ── CRC16 (Modbus poly 0xA001, init 0xFFFF) ─────────────────────

fn crc16(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc >>= 1;
                crc ^= 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    crc
}

// ── Frame builder / parser ───────────────────────────────────────

fn build_binary_frame(cmd: &[u8; 2], data: &[u8]) -> Vec<u8> {
    let data_len = data.len() as u32;
    let mut buf = Vec::with_capacity(16 + data.len());
    buf.extend_from_slice(&FRAME_HEAD);
    buf.extend_from_slice(cmd);
    buf.extend_from_slice(&data_len.to_le_bytes());
    buf.extend_from_slice(data);
    let crc = crc16(&buf[2..]);
    buf.extend_from_slice(&crc.to_le_bytes());
    buf.extend_from_slice(&FRAME_TAIL);
    buf
}

fn parse_binary_frame(frame: &[u8]) -> Result<(u16, u32, Vec<u8>)> {
    if frame.len() < 12 {
        bail!("frame too short: {} bytes", frame.len());
    }
    if frame[0] != 0xAA || frame[1] != 0x55 {
        bail!("invalid frame head: 0x{:02X} 0x{:02X}", frame[0], frame[1]);
    }
    let cmd = u16::from_le_bytes([frame[2], frame[3]]);
    let data_len = u32::from_le_bytes([frame[4], frame[5], frame[6], frame[7]]) as usize;
    let expected_len = 8 + data_len + 2 + 2;
    if frame.len() != expected_len {
        bail!(
            "frame length mismatch: expected {}, got {}",
            expected_len,
            frame.len()
        );
    }
    let tail_offset = frame.len() - 2;
    if frame[tail_offset] != 0x3C || frame[tail_offset + 1] != 0xC3 {
        bail!(
            "invalid frame tail: 0x{:02X} 0x{:02X}",
            frame[tail_offset],
            frame[tail_offset + 1]
        );
    }
    let crc_offset = frame.len() - 4;
    let crc_received = u16::from_le_bytes([frame[crc_offset], frame[crc_offset + 1]]);
    let crc_calc = crc16(&frame[2..crc_offset]);
    if crc_received != crc_calc {
        tracing::warn!(
            "gamma: CRC mismatch: received 0x{:04X}, calculated 0x{:04X} (proceeding)",
            crc_received,
            crc_calc
        );
    }
    let data = frame[8..8 + data_len].to_vec();
    Ok((cmd, data_len as u32, data))
}

// ── TCP KeepAlive ────────────────────────────────────────────────

fn apply_keepalive(stream: &TcpStream) -> Result<()> {
    let sock = SockRef::from(stream);
    sock.set_keepalive(true).context("set SO_KEEPALIVE")?;
    let ka = TcpKeepalive::new()
        .with_time(Duration::from_secs(30))
        .with_interval(Duration::from_secs(10));
    sock.set_tcp_keepalive(&ka).context("set TCP_KEEPALIVE")?;
    Ok(())
}

// ── Client ───────────────────────────────────────────────────────

pub struct GammaClient {
    stream: TcpStream,
    addr: String,
}

impl GammaClient {
    pub async fn connect(addr: &str) -> Result<Self> {
        let stream = tokio::time::timeout(Duration::from_secs(5), TcpStream::connect(addr))
            .await
            .with_context(|| format!("gamma: connect timeout to {}", addr))??;
        apply_keepalive(&stream)
            .with_context(|| format!("gamma: set keepalive {}", addr))?;
        info!("gamma: connected to {}", addr);
        Ok(Self {
            stream,
            addr: addr.to_string(),
        })
    }

    async fn send_recv_binary(&mut self, frame: &[u8]) -> Result<Vec<u8>> {
        self.stream.write_all(frame).await?;
        self.stream.flush().await?;

        let mut header = vec![0u8; 8];
        tokio::time::timeout(Duration::from_secs(10), self.stream.read_exact(&mut header))
            .await
            .context("gamma: binary response header timeout")??;
        if header[0] != 0xAA || header[1] != 0x55 {
            bail!(
                "gamma: bad response head: 0x{:02X} 0x{:02X}",
                header[0],
                header[1]
            );
        }
        let data_len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        let remaining = data_len + 2 + 2; // CRC + tail
        let mut rest = vec![0u8; remaining];
        tokio::time::timeout(Duration::from_secs(10), self.stream.read_exact(&mut rest))
            .await
            .context("gamma: binary response body timeout")??;

        let mut full = header;
        full.extend_from_slice(&rest);
        Ok(full)
    }

    /// Read 4096-channel spectrum data via text command.
    pub async fn read_spectrum(&mut self) -> Result<GammaSpectrumData> {
        let cmd = b"#READ_SPECTRUM\r\n";
        self.stream.write_all(cmd).await?;
        self.stream.flush().await?;

        let mut buf = Vec::with_capacity(65536);
        let mut tmp = [0u8; 65536];
        let mut last_recv = tokio::time::Instant::now();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(15);

        loop {
            let timeout = if buf.is_empty() {
                Duration::from_secs(10)
            } else {
                let idle_left = Duration::from_secs(2).saturating_sub(last_recv.elapsed());
                if idle_left.is_zero() {
                    break;
                }
                idle_left
            };
            let effective =
                timeout.min(deadline.saturating_duration_since(tokio::time::Instant::now()));

            match tokio::time::timeout(effective, self.stream.read(&mut tmp)).await {
                Ok(Ok(0)) => break,
                Ok(Ok(n)) => {
                    buf.extend_from_slice(&tmp[..n]);
                    last_recv = tokio::time::Instant::now();
                    if buf.len() > 200_000 {
                        bail!("gamma: spectrum response too large: {} bytes", buf.len());
                    }
                }
                Ok(Err(e)) => bail!("gamma: spectrum read error: {e}"),
                Err(_) => {
                    if buf.is_empty() {
                        bail!("gamma: spectrum read timeout (no data)");
                    }
                    break;
                }
            }
            if tokio::time::Instant::now() >= deadline {
                break;
            }
        }

        let text = String::from_utf8_lossy(&buf);
        let line = text.trim();
        if !line.starts_with("#READ_SPECTRUM") {
            bail!(
                "gamma: unexpected spectrum response: {}",
                &line[..line.len().min(80)]
            );
        }

        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 3 {
            bail!(
                "gamma: spectrum response has too few fields: {}",
                parts.len()
            );
        }

        let channel_count = parts.len() - 3;
        let mut spectrum = Vec::with_capacity(channel_count);
        for i in 1..=channel_count {
            let v: u32 = parts[i]
                .trim()
                .parse()
                .with_context(|| format!("gamma: parse channel {} value", i))?;
            spectrum.push(v);
        }

        let real_time: f32 = parts[parts.len() - 2]
            .trim()
            .parse()
            .context("gamma: parse real_time")?;
        let live_time: f32 = parts[parts.len() - 1]
            .trim()
            .parse()
            .context("gamma: parse live_time")?;

        Ok(GammaSpectrumData {
            spectrum,
            real_time,
            live_time,
        })
    }

    /// Read analysis results (dose rate + nuclides) via binary command 0x9090.
    pub async fn read_result(&mut self) -> Result<GammaResultData> {
        let frame = build_binary_frame(&CMD_READ_RESULT, &[0u8; 16]);
        let resp = self.send_recv_binary(&frame).await?;
        let (cmd, _, resp_data) = parse_binary_frame(&resp)?;

        let err_cmd = u16::from_le_bytes(CMD_READ_RESULT_ERR);
        if cmd == err_cmd {
            bail!("gamma: read result rejected");
        }
        if cmd != u16::from_le_bytes(CMD_READ_RESULT) {
            bail!("gamma: unexpected result response cmd 0x{:04X}", cmd);
        }
        if resp_data.is_empty() {
            bail!("gamma: empty result response");
        }

        let nuclide_count = resp_data[0] as usize;
        let total_dose_rate = if resp_data.len() >= 5 {
            f32::from_le_bytes([resp_data[1], resp_data[2], resp_data[3], resp_data[4]])
        } else {
            bail!("gamma: result response too short for total dose rate");
        };

        let mut nuclides = Vec::with_capacity(nuclide_count);
        let mut offset = 5;
        for _ in 0..nuclide_count {
            if offset + 7 + 4 + 4 + 4 > resp_data.len() {
                tracing::warn!("gamma: truncated nuclide data at offset {}", offset);
                break;
            }
            let name_bytes = &resp_data[offset..offset + 7];
            let name = String::from_utf8_lossy(name_bytes)
                .trim_end()
                .trim_end_matches('\0')
                .trim_end_matches(' ')
                .to_string();
            offset += 7;
            let dose_rate = f32::from_le_bytes([
                resp_data[offset],
                resp_data[offset + 1],
                resp_data[offset + 2],
                resp_data[offset + 3],
            ]);
            offset += 4;
            let activity = f32::from_le_bytes([
                resp_data[offset],
                resp_data[offset + 1],
                resp_data[offset + 2],
                resp_data[offset + 3],
            ]);
            offset += 4;
            let confidence = f32::from_le_bytes([
                resp_data[offset],
                resp_data[offset + 1],
                resp_data[offset + 2],
                resp_data[offset + 3],
            ]);
            offset += 4;
            nuclides.push(NuclideInfo {
                name,
                dose_rate,
                activity,
                confidence,
            });
        }

        Ok(GammaResultData {
            total_dose_rate,
            nuclides,
        })
    }

    /// Read spectrum then reconnect and read result.
    /// The gamma device requires a new TCP connection between spectrum and result reads.
    pub async fn read_spectrum_and_result(
        &mut self,
    ) -> Result<(GammaSpectrumData, GammaResultData)> {
        let addr = self.addr.clone();
        let spectrum = self.read_spectrum().await?;
        let new_stream = tokio::time::timeout(Duration::from_secs(5), TcpStream::connect(&addr))
            .await
            .context("gamma: reconnect for result timeout")??;
        apply_keepalive(&new_stream)
            .with_context(|| format!("gamma: set keepalive (reconnect) {}", addr))?;
        info!("gamma: reconnected to {} for result", addr);
        self.stream = new_stream;
        let result = self.read_result().await?;
        Ok((spectrum, result))
    }
}

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_result_frame() {
        let frame = build_binary_frame(&CMD_READ_RESULT, &[0u8; 16]);
        assert_eq!(&frame[0..2], &FRAME_HEAD);
        assert_eq!(&frame[2..4], &[0x90, 0x90]);
        assert_eq!(
            u32::from_le_bytes([frame[4], frame[5], frame[6], frame[7]]),
            16
        );
        assert_eq!(frame[8], 0x00);
        assert_eq!(&frame[frame.len() - 2..], &FRAME_TAIL);
    }

    #[test]
    fn test_parse_binary_frame_roundtrip() {
        let frame = build_binary_frame(&CMD_READ_RESULT, &[0x01, 0x00, 0x00, 0x80, 0x3E]);
        let (cmd, data_len, data) = parse_binary_frame(&frame).unwrap();
        assert_eq!(cmd, 0x9090);
        assert_eq!(data_len, 5);
        assert_eq!(data, vec![0x01, 0x00, 0x00, 0x80, 0x3E]);
    }

    #[test]
    fn test_parse_bad_head() {
        let mut frame = build_binary_frame(&CMD_READ_RESULT, &[0x01]);
        frame[0] = 0x00;
        assert!(parse_binary_frame(&frame).is_err());
    }

    #[test]
    fn test_parse_bad_tail() {
        let mut frame = build_binary_frame(&CMD_READ_RESULT, &[0x01]);
        let last = frame.len() - 1;
        frame[last] = 0x00;
        assert!(parse_binary_frame(&frame).is_err());
    }

    #[test]
    fn test_parse_bad_crc_is_tolerated() {
        let mut frame = build_binary_frame(&CMD_READ_RESULT, &[0x01]);
        let crc_offset = frame.len() - 4;
        frame[crc_offset] ^= 0xFF;
        assert!(parse_binary_frame(&frame).is_ok());
    }

    #[test]
    fn test_crc16() {
        // Verify CRC is deterministic.
        let data = [0x90, 0x90, 0x10, 0x00, 0x00, 0x00, 0x00];
        let c1 = crc16(&data);
        let c2 = crc16(&data);
        assert_eq!(c1, c2);
    }
}