use crate::error::{Hs05gError, Result};

use chrono::{Datelike, Timelike};
use serde::Serialize;

// ── Frame constants ──────────────────────────────────────────────

pub const HEADER_BYTE_0: u8 = 0xA5;
pub const HEADER_BYTE_1: u8 = 0x5A;

pub const RS485_REQUEST_LEN: usize = 8;
pub const RJ45_REQUEST_LEN: usize = 12;
pub const RJ45_SHORT_RESPONSE_LEN: usize = 8;
pub const RJ45_LONG_RESPONSE_LEN: usize = 130;
pub const DATA_PACKET_LEN: usize = 128;

pub const MAX_NODES: usize = 15;
pub const NODE_DATA_LEN: usize = 8;

// ── RJ45 commands ────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Rj45Cmd {
    ReadCurrentData = 0x01,
    SetPeriod = 0x02,
    SetHubId = 0x03,
    SetDeviceCount = 0x04,
    EraseData = 0x05,
    SetRtc = 0x06,
    SetOledDisplay = 0x07,
    ReadFileCount = 0x08,
    ReadFileData = 0x09,
    SoftwareReset = 0x0A,
    ReadParams = 0x0B,
}

impl Rj45Cmd {
    pub fn from_u8(v: u8) -> Result<Self> {
        match v {
            0x01 => Ok(Self::ReadCurrentData),
            0x02 => Ok(Self::SetPeriod),
            0x03 => Ok(Self::SetHubId),
            0x04 => Ok(Self::SetDeviceCount),
            0x05 => Ok(Self::EraseData),
            0x06 => Ok(Self::SetRtc),
            0x07 => Ok(Self::SetOledDisplay),
            0x08 => Ok(Self::ReadFileCount),
            0x09 => Ok(Self::ReadFileData),
            0x0A => Ok(Self::SoftwareReset),
            0x0B => Ok(Self::ReadParams),
            _ => Err(Hs05gError::InvalidCommand(v)),
        }
    }

    /// Expected response length for this command.
    pub fn response_len(&self) -> usize {
        match self {
            Self::ReadCurrentData | Self::ReadFileData => RJ45_LONG_RESPONSE_LEN,
            // ReadParams returns 14 bytes:
            // header(2) + cmd(1) + 'O'(1) + 'K'(1) + 0x00(1) + node_count(1)
            // + fileH(1) + fileL(1) + year(1) + month(1) + day(1) + hour(1) + min(1)
            Self::ReadParams => 14,
            _ => RJ45_SHORT_RESPONSE_LEN,
        }
    }
}

// ── RS485 commands ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Rs485Cmd {
    SetPeriod = 0x01,
    OledBlink = 0x02,
    ReadData = 0x03,
    Reset = 0x04,
}

// ── RJ45 request builder ─────────────────────────────────────────

/// Build a 12-byte RJ45 request frame.
///
/// Layout: `[0xA5, 0x5A, cmd, par1..par6, spare, cmd1, cmd2]`
pub fn build_rj45_request(cmd: Rj45Cmd, params: &[u8; 6], spare: u8) -> [u8; RJ45_REQUEST_LEN] {
    let c = cmd as u8;
    let mut buf = [0u8; RJ45_REQUEST_LEN];
    buf[0] = HEADER_BYTE_0;
    buf[1] = HEADER_BYTE_1;
    buf[2] = c;
    buf[3..9].copy_from_slice(params);
    buf[9] = spare;
    buf[10] = c;
    buf[11] = c;
    buf
}

/// Convenience: build a request with no meaningful params (all zeroes).
pub fn build_simple_request(cmd: Rj45Cmd) -> [u8; RJ45_REQUEST_LEN] {
    build_rj45_request(cmd, &[0u8; 6], 0)
}

/// Build a `SetPeriod` request. `period` is placed in Par1.
pub fn build_set_period(period: u8) -> [u8; RJ45_REQUEST_LEN] {
    let mut params = [0u8; 6];
    params[0] = period;
    build_rj45_request(Rj45Cmd::SetPeriod, &params, 0)
}

/// Build a `SetHubId` request. `hub_id` is placed in Par1.
pub fn build_set_hub_id(hub_id: u8) -> [u8; RJ45_REQUEST_LEN] {
    let mut params = [0u8; 6];
    params[0] = hub_id;
    build_rj45_request(Rj45Cmd::SetHubId, &params, 0)
}

/// Build a `SetDeviceCount` request. `count` is placed in Par1.
pub fn build_set_device_count(count: u8) -> [u8; RJ45_REQUEST_LEN] {
    let mut params = [0u8; 6];
    params[0] = count;
    build_rj45_request(Rj45Cmd::SetDeviceCount, &params, 0)
}

/// Build a `SetRtc` request with the current system time.
pub fn build_set_rtc() -> [u8; RJ45_REQUEST_LEN] {
    let now = chrono::Local::now();
    let params = [
        (now.year() - 2000) as u8,
        now.month() as u8,
        now.day() as u8,
        now.hour() as u8,
        now.minute() as u8,
        now.second() as u8,
    ];
    build_rj45_request(Rj45Cmd::SetRtc, &params, 0)
}

/// Build a `SetOledDisplay` request. `blink=true` sends 0xAA.
pub fn build_set_oled_display(blink: bool) -> [u8; RJ45_REQUEST_LEN] {
    let mut params = [0u8; 6];
    params[0] = if blink { 0xAA } else { 0x00 };
    build_rj45_request(Rj45Cmd::SetOledDisplay, &params, 0)
}

/// Build a `ReadFileData` request for a given file number.
pub fn build_read_file_data(file_num: u16) -> [u8; RJ45_REQUEST_LEN] {
    let mut params = [0u8; 6];
    params[0] = (file_num >> 8) as u8;
    params[1] = (file_num & 0xFF) as u8;
    build_rj45_request(Rj45Cmd::ReadFileData, &params, 0)
}

// ── RS485 request builder ────────────────────────────────────────

/// Build an 8-byte RS485 request frame.
///
/// Layout: `[0xA5, 0x5A, device_id, cmd0, cmd1, cmd2, par1, par2]`
pub fn build_rs485_request(
    device_id: u8,
    cmd: Rs485Cmd,
    par1: u8,
    par2: u8,
) -> [u8; RS485_REQUEST_LEN] {
    let c = cmd as u8;
    [HEADER_BYTE_0, HEADER_BYTE_1, device_id, c, c, c, par1, par2]
}

// ── Response parsing ─────────────────────────────────────────────

/// Parsed short (8-byte) RJ45 response.
#[derive(Debug, Clone, Serialize)]
pub struct ShortResponse {
    pub cmd: u8,
    pub data: [u8; 6], // bytes 2..8 after header
}

/// Single node measurement (8 bytes).
#[derive(Debug, Clone, Serialize)]
pub struct NodeData {
    pub node_id: u8,
    pub radon_concentration: u16, // high byte + low byte
    pub pressure: u16,            // high byte + low byte
    pub temperature: u8,          // raw, no decimal point
    pub humidity: u8,             // raw, no decimal point
    pub period: u8,
}

/// Parsed 128-byte data packet from the hub.
#[derive(Debug, Clone, Serialize)]
pub struct DataPacket {
    pub nodes: Vec<NodeData>,
    pub pressure: u16,     // overall pressure (bytes 120-121)
    pub year: u8,          // + 2000
    pub month: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: u8,
    pub period: u8,
}

/// Parsed `ReadParams` response fields.
#[derive(Debug, Clone, Serialize)]
pub struct HubParams {
    pub node_count: u8,
    pub file_number: u16,
    pub year: u8,
    pub month: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: u8,
}

/// Parsed `ReadFileCount` response fields.
#[derive(Debug, Clone, Serialize)]
pub struct FileCount {
    pub file_number: u16,
}

/// All possible parsed RJ45 responses.
#[derive(Debug, Clone, Serialize)]
pub enum Response {
    Ok { cmd: u8 },
    DataPacket(DataPacket),
    FileData(DataPacket),
    FileCount(FileCount),
    Params(HubParams),
    Raw(ShortResponse),
}

/// Validate frame header bytes.
fn validate_header(b0: u8, b1: u8) -> Result<()> {
    if b0 != HEADER_BYTE_0 || b1 != HEADER_BYTE_1 {
        return Err(Hs05gError::InvalidHeader(b0, b1));
    }
    Ok(())
}

/// Parse a 130-byte data response (ReadCurrentData / ReadFileData).
fn parse_data_response(buf: &[u8], cmd: Rj45Cmd) -> Result<Response> {
    if buf.len() < RJ45_LONG_RESPONSE_LEN {
        return Err(Hs05gError::UnexpectedLength {
            expected: RJ45_LONG_RESPONSE_LEN,
            actual: buf.len(),
        });
    }
    validate_header(buf[0], buf[1])?;
    let packet = parse_data_packet(&buf[2..2 + DATA_PACKET_LEN])?;
    Ok(match cmd {
        Rj45Cmd::ReadCurrentData => Response::DataPacket(packet),
        Rj45Cmd::ReadFileData => Response::FileData(packet),
        _ => unreachable!(),
    })
}

/// Parse a 128-byte data packet.
pub fn parse_data_packet(data: &[u8]) -> Result<DataPacket> {
    if data.len() < DATA_PACKET_LEN {
        return Err(Hs05gError::UnexpectedLength {
            expected: DATA_PACKET_LEN,
            actual: data.len(),
        });
    }

    let mut nodes = Vec::with_capacity(MAX_NODES);
    for i in 0..MAX_NODES {
        let offset = i * NODE_DATA_LEN;
        let node_num = data[offset + 7];
        if node_num == 0 && data[offset] == 0 && data[offset + 1] == 0 {
            continue; // unused node slot
        }
        nodes.push(NodeData {
            node_id: node_num,
            radon_concentration: u16::from_be_bytes([data[offset], data[offset + 1]]),
            pressure: u16::from_be_bytes([data[offset + 2], data[offset + 3]]),
            temperature: data[offset + 4],
            humidity: data[offset + 5],
            period: data[offset + 6],
        });
    }

    Ok(DataPacket {
        nodes,
        pressure: u16::from_be_bytes([data[120], data[121]]),
        year: data[122],
        month: data[123],
        day: data[124],
        hour: data[125],
        minute: data[126],
        period: data[127],
    })
}

/// Parse an 8-byte short response.
fn parse_short_response(buf: &[u8]) -> Result<ShortResponse> {
    if buf.len() < RJ45_SHORT_RESPONSE_LEN {
        return Err(Hs05gError::UnexpectedLength {
            expected: RJ45_SHORT_RESPONSE_LEN,
            actual: buf.len(),
        });
    }
    validate_header(buf[0], buf[1])?;
    let mut data = [0u8; 6];
    data.copy_from_slice(&buf[2..8]);
    Ok(ShortResponse { cmd: buf[2], data })
}

/// Parse a complete RJ45 response given the command that was sent.
pub fn parse_response(cmd: Rj45Cmd, buf: &[u8]) -> Result<Response> {
    match cmd {
        Rj45Cmd::ReadCurrentData | Rj45Cmd::ReadFileData => parse_data_response(buf, cmd),
        Rj45Cmd::ReadFileCount => {
            let sr = parse_short_response(buf)?;
            Ok(Response::FileCount(FileCount {
                file_number: u16::from_be_bytes([sr.data[3], sr.data[4]]),
            }))
        }
        Rj45Cmd::ReadParams => {
            // ReadParams response is 14 bytes:
            // [0xA5, 0x5A, 0x0A, 'O', 'K', 0x00, node_count, fileH, fileL, year, month, day, hour, min]
            if buf.len() < 14 {
                return Err(Hs05gError::UnexpectedLength { expected: 14, actual: buf.len() });
            }
            validate_header(buf[0], buf[1])?;
            Ok(Response::Params(HubParams {
                node_count: buf[6],
                file_number: u16::from_be_bytes([buf[7], buf[8]]),
                year: buf[9],
                month: buf[10],
                day: buf[11],
                hour: buf[12],
                minute: buf[13],
            }))
        }
        _ => {
            let sr = parse_short_response(buf)?;
            // data layout: [cmd, 'O', 'K', 0x00, spare, spare]
            if sr.data[1] == b'O' && sr.data[2] == b'K' {
                Ok(Response::Ok { cmd: cmd as u8 })
            } else {
                Ok(Response::Raw(sr))
            }
        }
    }
}

// ── RS485 response parsing ───────────────────────────────────────

/// Parsed RS485 ReadData response.
#[derive(Debug, Clone, Serialize)]
pub struct Rs485DataResponse {
    pub device_id: u8,
    pub data: NodeData,
}

/// Parse a 12-byte RS485 ReadData response.
///
/// Layout: `[0xA5, 0x5A, device_id, radon_hi, radon_lo, count_hi, count_lo, temp, humidity, period, node_id]`
/// (the 8-byte measurement data follows the header + device_id)
pub fn parse_rs485_data_response(buf: &[u8]) -> Result<Rs485DataResponse> {
    if buf.len() < RS485_REQUEST_LEN + NODE_DATA_LEN {
        return Err(Hs05gError::UnexpectedLength {
            expected: RS485_REQUEST_LEN + NODE_DATA_LEN,
            actual: buf.len(),
        });
    }
    validate_header(buf[0], buf[1])?;
    let device_id = buf[2];
    let offset = 3; // after header + device_id
    Ok(Rs485DataResponse {
        device_id,
        data: NodeData {
            node_id: buf[offset + 7],
            radon_concentration: u16::from_be_bytes([buf[offset], buf[offset + 1]]),
            // For RS485, bytes 2-3 are "count" not "pressure", but struct reuses the field
            pressure: u16::from_be_bytes([buf[offset + 2], buf[offset + 3]]),
            temperature: buf[offset + 4],
            humidity: buf[offset + 5],
            period: buf[offset + 6],
        },
    })
}

// ── Display helpers ──────────────────────────────────────────────

impl std::fmt::Display for NodeData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Node#{:02x} radon={} pressure={} temp={} hum={} period={}",
            self.node_id,
            self.radon_concentration,
            self.pressure,
            self.temperature,
            self.humidity,
            self.period,
        )
    }
}

// ── Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_simple_request() {
        let req = build_simple_request(Rj45Cmd::ReadCurrentData);
        assert_eq!(req[0], 0xA5);
        assert_eq!(req[1], 0x5A);
        assert_eq!(req[2], 0x01); // ReadCurrentData
        assert_eq!(req[10], 0x01);
        assert_eq!(req[11], 0x01);
    }

    #[test]
    fn test_build_set_period() {
        let req = build_set_period(60);
        assert_eq!(req[0], 0xA5);
        assert_eq!(req[1], 0x5A);
        assert_eq!(req[2], 0x02); // SetPeriod
        assert_eq!(req[3], 60);   // period in Par1
        assert_eq!(req[10], 0x02);
        assert_eq!(req[11], 0x02);
    }

    #[test]
    fn test_build_rs485_request() {
        let req = build_rs485_request(0x05, Rs485Cmd::ReadData, 0, 0);
        assert_eq!(req, [0xA5, 0x5A, 0x05, 0x03, 0x03, 0x03, 0x00, 0x00]);
    }

    #[test]
    fn test_parse_ok_response() {
        let buf = [0xA5, 0x5A, 0x02, b'O', b'K', 0x00, 0x00, 0x00];
        let resp = parse_response(Rj45Cmd::SetPeriod, &buf).unwrap();
        match resp {
            Response::Ok { cmd } => assert_eq!(cmd, 0x02),
            _ => panic!("expected Ok"),
        }
    }

    #[test]
    fn test_parse_data_packet() {
        let mut data = [0u8; 128];
        // Node 1: radon=100, pressure=1013, temp=25, humidity=60, period=30, id=1
        data[0] = 0; data[1] = 100;       // radon = 100
        data[2] = 0x03; data[3] = 0xF5;   // pressure = 1013
        data[4] = 25;                      // temp
        data[5] = 60;                      // humidity
        data[6] = 30;                      // period
        data[7] = 1;                       // node id
        // Timestamp
        data[120] = 0x03; data[121] = 0xF5; // pressure = 1013
        data[122] = 25; // year (2025)
        data[123] = 10; // month
        data[124] = 20; // day
        data[125] = 14; // hour
        data[126] = 30; // minute
        data[127] = 30; // period

        let packet = parse_data_packet(&data).unwrap();
        assert_eq!(packet.nodes.len(), 1);
        assert_eq!(packet.nodes[0].node_id, 1);
        assert_eq!(packet.nodes[0].radon_concentration, 100);
        assert_eq!(packet.nodes[0].temperature, 25);
        assert_eq!(packet.year, 25);
        assert_eq!(packet.period, 30);
    }

    #[test]
    fn test_invalid_header() {
        let buf = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        assert!(parse_response(Rj45Cmd::SetPeriod, &buf).is_err());
    }

    #[test]
    fn test_rj45_cmd_from_u8() {
        assert!(Rj45Cmd::from_u8(0x01).is_ok());
        assert!(Rj45Cmd::from_u8(0x0B).is_ok());
        assert!(Rj45Cmd::from_u8(0x0C).is_err());
        assert!(Rj45Cmd::from_u8(0x00).is_err());
    }

    #[test]
    fn test_response_len() {
        assert_eq!(Rj45Cmd::ReadCurrentData.response_len(), 130);
        assert_eq!(Rj45Cmd::ReadFileData.response_len(), 130);
        assert_eq!(Rj45Cmd::SetPeriod.response_len(), 8);
        assert_eq!(Rj45Cmd::ReadParams.response_len(), 14);
    }
}

impl std::fmt::Display for DataPacket {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(
            f,
            "20{:02}-{:02}-{:02} {:02}:{:02}  period={}  pressure={}",
            self.year, self.month, self.day, self.hour, self.minute, self.period, self.pressure,
        )?;
        for node in &self.nodes {
            writeln!(f, "  {}", node)?;
        }
        Ok(())
    }
}