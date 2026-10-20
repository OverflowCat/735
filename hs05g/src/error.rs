use thiserror::Error;

#[derive(Debug, Error)]
pub enum Hs05gError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("invalid frame header: expected 0xA5 0x5A, got {0:#04x} {1:#04x}")]
    InvalidHeader(u8, u8),

    #[error("unexpected response length: expected {expected}, got {actual}")]
    UnexpectedLength { expected: usize, actual: usize },

    #[error("hub returned error response")]
    ErrorResponse,

    #[error("connection closed")]
    ConnectionClosed,

    #[error("timeout waiting for response")]
    Timeout,

    #[error("invalid command code: {0:#04x}")]
    InvalidCommand(u8),

    #[error("invalid node index: {0} (max 14)")]
    InvalidNodeIndex(usize),
}

pub type Result<T> = std::result::Result<T, Hs05gError>;