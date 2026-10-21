// Device inventory loaded from a JSON file.
//
// Each entry is one γ dose-rate monitor on a shared RS485/serial tunnel.
// Optional `radonNode` enables HS05G radon polling on the same TCP address
// (radon RS485 is paralleled with the RMS-200 bus).

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceEntry {
    /// Stable device id (asset serial, e.g. "2026012929").
    pub id: String,
    /// TCP serial-tunnel endpoint, e.g. "192.168.10.39:9039".
    pub addr: String,
    /// RMS-200 display-unit address (0~FF). Defaults to 1.
    #[serde(default = "default_gamma_addr")]
    pub gamma_addr: u8,
    /// Optional HS05G radon node id on the shared RS485 bus.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub radon_node: Option<u8>,
    /// Optional display name; defaults to the id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

fn default_gamma_addr() -> u8 {
    1
}

impl DeviceEntry {
    pub fn display_name(&self) -> String {
        self.name
            .clone()
            .unwrap_or_else(|| format!("γ剂量率监测仪-{}", self.id))
    }

    /// Device id for the paired radon instrument, if any.
    pub fn radon_device_id(&self) -> Option<String> {
        self.radon_node.map(|n| format!("radon-{n}"))
    }
}

/// Load a device list from a JSON file (array of DeviceEntry).
pub fn load_devices(path: &Path) -> anyhow::Result<Vec<DeviceEntry>> {
    let data = std::fs::read_to_string(path)
        .map_err(|e| anyhow::anyhow!("read devices file {}: {e}", path.display()))?;
    let list: Vec<DeviceEntry> = serde_json::from_str(&data)
        .map_err(|e| anyhow::anyhow!("parse devices file {}: {e}", path.display()))?;
    if list.is_empty() {
        anyhow::bail!("devices file {} is empty", path.display());
    }
    for d in &list {
        if d.id.is_empty() {
            anyhow::bail!("devices file {}: entry with empty id", path.display());
        }
        if d.addr.is_empty() {
            anyhow::bail!(
                "devices file {}: device {} has empty addr",
                path.display(),
                d.id
            );
        }
    }
    Ok(list)
}

/// Derive the conventional Xinjiang endpoint from an asset serial.
///
/// Field convention: SN `20260129XX` → IP `192.168.10.(XX+10)` port `90(XX+10)`.
/// Example: `2026012929` → `192.168.10.39:9039`.
pub fn endpoint_from_sn(sn: &str) -> Option<String> {
    let last2 = sn.len().checked_sub(2)?;
    let xx: u32 = sn[last2..].parse().ok()?;
    let ip_last = xx + 10;
    if ip_last > 255 {
        return None;
    }
    Some(format!("192.168.10.{ip_last}:{}", 9000 + ip_last))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sn_to_endpoint() {
        assert_eq!(
            endpoint_from_sn("2026012929").as_deref(),
            Some("192.168.10.39:9039")
        );
        assert_eq!(
            endpoint_from_sn("2026012903").as_deref(),
            Some("192.168.10.13:9013")
        );
        assert_eq!(
            endpoint_from_sn("2026012905").as_deref(),
            Some("192.168.10.15:9015")
        );
    }

    #[test]
    fn parse_device_list() {
        let json = r#"[
            {"id":"2026012903","addr":"192.168.10.13:9013","radonNode":36},
            {"id":"2026012914","addr":"192.168.10.24:9024"}
        ]"#;
        let list: Vec<DeviceEntry> = serde_json::from_str(json).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].gamma_addr, 1);
        assert_eq!(list[0].radon_node, Some(36));
        assert_eq!(list[0].radon_device_id().as_deref(), Some("radon-36"));
        assert_eq!(list[1].radon_node, None);
    }
}
