use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::env;
use std::fs::File;
use std::io::{self, Read};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let mut input = String::new();
    if args.len() > 1 {
        let path = &args[1];
        let mut f = File::open(path)?;
        f.read_to_string(&mut input)?;
    } else {
        io::stdin().read_to_string(&mut input)?;
    }

    let v: Value = serde_json::from_str(&input)?;
    let canonical = canonicalize(&v);
    println!("canonical: {}", canonical);
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let digest = hasher.finalize();
    println!("sha256: {}", hex::encode(digest));
    Ok(())
}

fn canonicalize(v: &Value) -> String {
    match v {
        Value::Null => "null".to_string(),
        Value::Bool(b) => {
            if *b { "true".to_string() } else { "false".to_string() }
        }
        Value::Number(n) => format_number(n),
        Value::String(s) => serde_json::to_string(s).unwrap(),
        Value::Array(arr) => {
            let mut parts = Vec::with_capacity(arr.len());
            for el in arr {
                parts.push(canonicalize(el));
            }
            format!("[{}]", parts.join(","))
        }
        Value::Object(map) => {
            // BigInt marker support: {"__bigint_hex":"..."}
            if map.len() == 1 && map.contains_key("__bigint_hex") {
                if let Some(Value::String(s)) = map.get("__bigint_hex") {
                    return serde_json::to_string(s).unwrap();
                }
            }

            // Sort keys lexicographically
            let mut tree: BTreeMap<&String, &Value> = BTreeMap::new();
            for (k, v) in map.iter() {
                tree.insert(k, v);
            }
            let mut parts = Vec::with_capacity(tree.len());
            for (k, v) in tree.iter() {
                let key = serde_json::to_string(k).unwrap();
                let val = canonicalize(v);
                parts.push(format!("{}:{}", key, val));
            }
            format!("{{{}}}", parts.join(","))
        }
    }
}

fn format_number(n: &serde_json::Number) -> String {
    if let Some(i) = n.as_i64() {
        return i.to_string();
    }
    if let Some(u) = n.as_u64() {
        return u.to_string();
    }
    if let Some(f) = n.as_f64() {
        if !f.is_finite() {
            return "null".to_string();
        }
        if f == 0.0 {
            return "0".to_string();
        }
        // Use ryu to produce a compact, deterministic representation
        let s = ryu::Buffer::new().format_finite(f).to_string();
        // ryu already uses lowercase 'e' and omits unnecessary plus sign
        return s;
    }
    // Fallback
    n.to_string()
}
