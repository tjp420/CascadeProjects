use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};


#[derive(Serialize, Deserialize, Clone)]
pub struct WasmFinding {
    pub rule: String,
    pub line: u32,
    pub snippet: String,
}

#[derive(Serialize, Deserialize)]
pub struct WasmResults {
    pub total_bytes: usize,
    pub is_pe: bool,
    pub findings: Vec<WasmFinding>,
}

#[wasm_bindgen]
pub struct ChunkAnalyzer {
    total_bytes: usize,
    is_pe: bool,
    findings: Vec<WasmFinding>,
    carry: Vec<u8>,
    line_offset: u32,
    seen_pe: bool,
}

#[wasm_bindgen]
impl ChunkAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ChunkAnalyzer {
        ChunkAnalyzer {
            total_bytes: 0,
            is_pe: false,
            findings: Vec::new(),
            carry: Vec::new(),
            line_offset: 0,
            seen_pe: false,
        }
    }

    pub fn analyze_chunk(&mut self, chunk: &[u8], _file_path: &str, is_last: bool) {
        self.total_bytes += chunk.len();

        // Only check the PE header once, at the very start of the file.
        if !self.seen_pe && self.total_bytes >= 2 {
            let head = if self.carry.is_empty() { chunk } else { &self.carry };
            if head.len() >= 2 && head[0] == 0x4D && head[1] == 0x5A {
                self.is_pe = true;
            }
            self.seen_pe = true;
        }

        let buffer = if self.carry.is_empty() {
            chunk.to_vec()
        } else {
            let mut buf = self.carry.clone();
            buf.extend_from_slice(chunk);
            buf
        };

        if buffer.is_empty() {
            return;
        }

        // Carry over the last incomplete line so patterns that span a chunk
        // boundary are scanned once the full line is available.
        if is_last {
            self.scan_text_patterns(&buffer, true);
            self.carry.clear();
        } else {
            let last_newline = buffer.iter().rposition(|&b| b == b'\n');
            match last_newline {
                None => {
                    // No complete line yet; accumulate everything for the next chunk.
                    self.carry = buffer;
                }
                Some(idx) => {
                    let scan_region = &buffer[..idx + 1];
                    self.carry = buffer[idx + 1..].to_vec();
                    self.scan_text_patterns(scan_region, false);
                }
            }
        }
    }

    pub fn get_results(&self) -> String {
        let results = WasmResults {
            total_bytes: self.total_bytes,
            is_pe: self.is_pe,
            findings: self.findings.clone(),
        };
        serde_json::to_string(&results).unwrap_or_else(|_| "{}".to_string())
    }

    fn scan_text_patterns(&mut self, buffer: &[u8], _is_last: bool) {
        let text = String::from_utf8_lossy(buffer);
        let lines: Vec<&str> = text.split('\n').collect();
        let trailing_empty = if text.ends_with('\n') { 1 } else { 0 };
        let line_count = (lines.len() as u32).saturating_sub(trailing_empty);

        let mut local_line = 0u32;
        for line in &lines {
            local_line += 1;
            if local_line > line_count {
                break;
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if Self::has_console_log(trimmed) {
                self.push_finding("debugArtifacts", local_line, trimmed);
            }
            if Self::has_todo(trimmed) {
                self.push_finding("todoMarkers", local_line, trimmed);
            }
            if Self::has_credential(trimmed) {
                self.push_finding("credentials", local_line, trimmed);
            }
        }

        self.line_offset += line_count;
    }

    fn push_finding(&mut self, rule: &str, local_line: u32, snippet: &str) {
        let line = self.line_offset + local_line;
        let snippet = snippet.chars().take(120).collect::<String>();
        self.findings.push(WasmFinding {
            rule: rule.to_string(),
            line,
            snippet,
        });
    }

    fn has_console_log(line: &str) -> bool {
        line.to_lowercase().contains("console.log")
            || line.to_lowercase().contains("console.warn")
            || line.to_lowercase().contains("console.error")
            || line.contains("debugger;")
    }

    fn has_todo(line: &str) -> bool {
        let lower = line.to_lowercase();
        lower.contains("todo") || lower.contains("fixme") || lower.contains("hack") || lower.contains("xxx")
    }

    fn has_credential(line: &str) -> bool {
        let lower = line.to_lowercase();
        (lower.contains("password") || lower.contains("secret") || lower.contains("token") || lower.contains("api_key"))
            && (lower.contains('\'') || lower.contains('"'))
    }
}

#[wasm_bindgen]
pub fn check_pe_header(data: &[u8]) -> bool {
    data.len() >= 2 && data[0] == 0x4D && data[1] == 0x5A
}
