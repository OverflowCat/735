// RMS-2000 display unit client (γ dose rate).
//
// Protocol: RMS-200 / RMS-2000 显示单元（带地址）与上位机通讯协议.
// Transport: TCP serial tunnel (EPORT HF5111B TCP-SERVER, default :4000).
//
// Request:  CMD  NARGS  …payload…  CHECK
// Response: RESP …payload…  CHECK
// NARGS = number of parameter bytes after that byte (e.g. 1D 01, 78 02, 7C 04).
// CHECK = low byte of the sum of all preceding bytes.
//
// Dose-rate / alarm values are 3-byte scientific notation:
//   bytes[0..2] big-endian mantissa, value = mantissa / 1000.0
//   bytes[2]    decimal exponent, final = mantissa / 1000.0 * 10^exp
//   unit: nSv/h or nGy/h
// Example: 22 EC 01 → 0x22EC=8940 → 8.940 * 10^1 = 89.4 nGy/h
// Example: 03 E8 04 → 0x03E8=1000 → 1.000 * 10^4 = 1.000e4 nGy/h

use anyhow::{bail, Context, Result};
use socket2::{SockRef, TcpKeepalive};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{debug, info};

// ── Command / response bytes ──────────────────────────────────────

const CMD_READ_DOSE: u8 = 0x1D;
const RESP_READ_DOSE: u8 = 0x1E;
const CMD_SET_ADDR: u8 = 0x78;
const RESP_SET_ADDR: u8 = 0x79;
const CMD_READ_ADDR: u8 = 0x7A;
const RESP_READ_ADDR: u8 = 0x7B;
const CMD_SET_ALARM: u8 = 0x7C;
const RESP_SET_ALARM: u8 = 0x7D;
const CMD_READ_ALARM: u8 = 0x7E;
const RESP_READ_ALARM: u8 = 0x7F;
const BROADCAST: u8 = 0xFF;

// ── Data types ───────────────────────────────────────────────────

/// Real-time dose rate sample from the display unit.
#[derive(Debug, Clone, Copy)]
pub struct DoseReading {
    /// Dose rate in nGy/h (protocol may report nSv/h; same numeric scale).
    pub dose_rate: f64,
    /// True if this value has not been read before (update flag = 0x01).
    pub updated: bool,
    /// Display-unit address echoed in the response.
    pub address: u8,
}

// ── Checksum / scientific encoding ───────────────────────────────

fn checksum(bytes: &[u8]) -> u8 {
    bytes.iter().fold(0u8, |acc, b| acc.wrapping_add(*b))
}

fn frame(payload: &[u8]) -> Vec<u8> {
    let mut f = payload.to_vec();
    f.push(checksum(&f));
    f
}

/// Decode 3-byte scientific notation (mantissa/1000 * 10^exp).
pub fn decode_scientific(b: [u8; 3]) -> f64 {
    let mantissa = u16::from_be_bytes([b[0], b[1]]) as f64 / 1000.0;
    mantissa * 10f64.powi(b[2] as i32)
}

/// Encode a non-negative value as 3-byte scientific notation.
/// Wire exponent is unsigned (0~255); small values use exp=0 and a smaller mantissa.
pub fn encode_scientific(value: f64) -> [u8; 3] {
    if !value.is_finite() || value <= 0.0 {
        return [0, 0, 0];
    }
    // value = (m / 1000) * 10^e  →  m = value * 10^(3-e)
    // Prefer e=0 while m fits in u16 (value <= 65.535). Otherwise pick e so m ∈ [1000, 10000).
    let mut e: i32 = 0;
    let mut m = (value * 1000.0).round() as i64;
    if m > u16::MAX as i64 {
        e = value.log10().floor() as i32;
        if e < 1 {
            e = 1;
        }
        m = (value / 10f64.powi(e) * 1000.0).round() as i64;
        if m >= 10_000 {
            m = ((m as f64) / 10.0).round() as i64;
            e += 1;
        } else if m < 1000 {
            // Keep as-is; still representable.
        }
    }
    if m < 1 {
        // Sub-0.001 values cannot be represented with unsigned exp; floor to 0.
        return [0, 0, 0];
    }
    let m = m.min(u16::MAX as i64) as u16;
    let e = e.clamp(0, u8::MAX as i32) as u8;
    [(m >> 8) as u8, m as u8, e]
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

pub struct RmsClient {
    stream: TcpStream,
    endpoint: String,
    device_addr: u8,
}

impl RmsClient {
    /// Connect to the serial tunnel. `device_addr` is the display-unit address (0~FF).
    pub async fn connect(endpoint: &str, device_addr: u8) -> Result<Self> {
        let stream = tokio::time::timeout(Duration::from_secs(5), TcpStream::connect(endpoint))
            .await
            .with_context(|| format!("rms200: connect timeout to {}", endpoint))??;
        apply_keepalive(&stream)
            .with_context(|| format!("rms200: set keepalive {}", endpoint))?;
        info!("rms200: connected to {} (addr=0x{:02X})", endpoint, device_addr);
        Ok(Self {
            stream,
            endpoint: endpoint.to_string(),
            device_addr,
        })
    }

    pub fn device_addr(&self) -> u8 {
        self.device_addr
    }

    pub fn set_device_addr(&mut self, addr: u8) {
        self.device_addr = addr;
    }

    /// Read `n` bytes with a single overall deadline.
    async fn read_exact_timeout(&mut self, buf: &mut [u8], secs: u64) -> Result<()> {
        tokio::time::timeout(Duration::from_secs(secs), self.stream.read_exact(buf))
            .await
            .with_context(|| format!("rms200: read timeout from {}", self.endpoint))??;
        Ok(())
    }

    /// Write a command frame and read one response.
    ///
    /// Reads the first byte, then the remaining `rest` bytes for that response type.
    async fn transact(&mut self, cmd: &[u8], rest_len: usize, expect_first: u8) -> Result<Vec<u8>> {
        self.stream.write_all(cmd).await?;
        self.stream.flush().await?;
        debug!("rms200: → {:02X?}", cmd);

        let mut first = [0u8; 1];
        self.read_exact_timeout(&mut first, 5).await?;
        if first[0] != expect_first {
            // Resync attempt: drain a little and fail clearly.
            bail!(
                "rms200: unexpected response head 0x{:02X} (want 0x{:02X}) from {}",
                first[0],
                expect_first,
                self.endpoint
            );
        }
        let mut rest = vec![0u8; rest_len];
        self.read_exact_timeout(&mut rest, 5).await?;

        let mut full = Vec::with_capacity(1 + rest_len);
        full.push(first[0]);
        full.extend_from_slice(&rest);
        debug!("rms200: ← {:02X?}", full);
        Ok(full)
    }

    fn verify_checksum(resp: &[u8]) -> Result<()> {
        let (body, cs) = resp.split_at(resp.len() - 1);
        let calc = checksum(body);
        if calc != cs[0] {
            bail!(
                "rms200: checksum mismatch: got 0x{:02X}, calculated 0x{:02X}",
                cs[0],
                calc
            );
        }
        Ok(())
    }

    /// Read real-time dose rate: `1D 01 addr check` → `1E m0 m1 exp flag addr check`.
    pub async fn read_dose_rate(&mut self) -> Result<DoseReading> {
        let cmd = frame(&[CMD_READ_DOSE, 0x01, self.device_addr]);
        let resp = self.transact(&cmd, 6, RESP_READ_DOSE).await?;
        Self::verify_checksum(&resp)?;

        // resp: 1E m0 m1 exp flag addr check
        let dose_rate = decode_scientific([resp[1], resp[2], resp[3]]);
        let updated = resp[4] == 0x01;
        let address = resp[5];
        Ok(DoseReading {
            dose_rate,
            updated,
            address,
        })
    }

    /// Read display-unit address: `7A 01 FF 7A` → `7B addr check`.
    pub async fn read_address(&mut self) -> Result<u8> {
        let cmd = frame(&[CMD_READ_ADDR, 0x01, BROADCAST]);
        let resp = self.transact(&cmd, 2, RESP_READ_ADDR).await?;
        Self::verify_checksum(&resp)?;
        Ok(resp[1])
    }

    /// Set display-unit address (broadcast): `78 02 new_addr FF check` → `79 addr check`.
    pub async fn set_address(&mut self, new_addr: u8) -> Result<u8> {
        let cmd = frame(&[CMD_SET_ADDR, 0x02, new_addr, BROADCAST]);
        let resp = self.transact(&cmd, 2, RESP_SET_ADDR).await?;
        Self::verify_checksum(&resp)?;
        let addr = resp[1];
        self.device_addr = addr;
        Ok(addr)
    }

    /// Read alarm threshold (nGy/h): `7E 01 addr check` → `7F addr t0 t1 exp check`.
    pub async fn read_alarm_threshold(&mut self) -> Result<f64> {
        let cmd = frame(&[CMD_READ_ALARM, 0x01, self.device_addr]);
        let resp = self.transact(&cmd, 5, RESP_READ_ALARM).await?;
        Self::verify_checksum(&resp)?;
        Ok(decode_scientific([resp[2], resp[3], resp[4]]))
    }

    /// Set alarm threshold (nGy/h): `7C 04 addr t0 t1 exp check` → `7D addr check`.
    ///
    /// Param-count byte is 0x04 (1-byte address + 3-byte threshold).
    pub async fn set_alarm_threshold(&mut self, value: f64) -> Result<()> {
        let t = encode_scientific(value);
        let cmd = frame(&[
            CMD_SET_ALARM,
            0x04,
            self.device_addr,
            t[0],
            t[1],
            t[2],
        ]);
        let resp = self.transact(&cmd, 2, RESP_SET_ALARM).await?;
        Self::verify_checksum(&resp)?;
        Ok(())
    }
}

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checksum_example_from_spec() {
        // Spec: 1E 22 EC 01 01 01 → 2F
        let body = [0x1E, 0x22, 0xEC, 0x01, 0x01, 0x01];
        assert_eq!(checksum(&body), 0x2F);
    }

    #[test]
    fn test_checksum_read_addr() {
        // Spec: 7A 01 FF → 7A
        let f = frame(&[CMD_READ_ADDR, 0x01, BROADCAST]);
        assert_eq!(f, vec![0x7A, 0x01, 0xFF, 0x7A]);
    }

    #[test]
    fn test_set_alarm_frame_uses_param_count_04() {
        // protocol (1): 7C 04 addr t0 t1 exp check
        let t = encode_scientific(10000.0); // 03 E8 04
        let f = frame(&[CMD_SET_ALARM, 0x04, 0x01, t[0], t[1], t[2]]);
        assert_eq!(f[0], 0x7C);
        assert_eq!(f[1], 0x04, "param count must be 04 (addr+3 threshold bytes)");
        assert_eq!(&f[2..6], &[0x01, 0x03, 0xE8, 0x04]);
        assert_eq!(f[6], checksum(&f[..6]));
    }

    #[test]
    fn test_decode_dose_example() {
        // Spec: 22 EC 01 = 8.940 * 10^1 = 89.4
        let v = decode_scientific([0x22, 0xEC, 0x01]);
        assert!((v - 89.4).abs() < 1e-9, "got {v}");
    }

    #[test]
    fn test_decode_alarm_example() {
        // Spec: 03 E8 04 = 1.000 * 10^4 = 10000
        let v = decode_scientific([0x03, 0xE8, 0x04]);
        assert!((v - 10000.0).abs() < 1e-9, "got {v}");
    }

    #[test]
    fn test_encode_roundtrip() {
        for v in [0.0f64, 89.4, 10000.0, 1.0, 0.05, 123.456, 99999.0] {
            let e = encode_scientific(v);
            let d = decode_scientific(e);
            if v == 0.0 {
                assert_eq!(d, 0.0);
            } else {
                let rel = ((d - v) / v).abs();
                assert!(rel < 0.01, "v={v} encoded={e:02X?} decoded={d} rel={rel}");
            }
        }
    }

    #[test]
    fn test_encode_known() {
        assert_eq!(encode_scientific(89.4), [0x22, 0xEC, 0x01]);
        assert_eq!(encode_scientific(10000.0), [0x03, 0xE8, 0x04]);
    }

    #[test]
    fn test_verify_checksum() {
        let resp = [0x1E, 0x22, 0xEC, 0x01, 0x01, 0x01, 0x2F];
        assert!(RmsClient::verify_checksum(&resp).is_ok());
        let bad = [0x1E, 0x22, 0xEC, 0x01, 0x01, 0x01, 0x30];
        assert!(RmsClient::verify_checksum(&bad).is_err());
    }

    #[test]
    fn test_field_frame_192_168_10_11() {
        // Live capture 2026-10-20 from 192.168.10.11
        let resp = [0x1E, 0x15, 0x1F, 0x02, 0x01, 0x01, 0x56];
        RmsClient::verify_checksum(&resp).unwrap();
        let v = decode_scientific([resp[1], resp[2], resp[3]]);
        assert!((v - 540.7).abs() < 1e-9, "got {v}");
        assert_eq!(resp[4], 0x01); // updated
        assert_eq!(resp[5], 0x01); // addr
    }
}
