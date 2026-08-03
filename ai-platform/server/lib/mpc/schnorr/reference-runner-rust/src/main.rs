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
    // Prefer integer representations when possible
    if let Some(i) = n.as_i64() {
        return i.to_string();
    }
    if let Some(u) = n.as_u64() {
        return u.to_string();
    }

    if let Some(f) = n.as_f64() {
        // Non-finite -> null
        if !f.is_finite() {
            return "null".to_string();
        }

        // Treat -0 as 0
        if f == 0.0 {
            return "0".to_string();
        }

        let neg = f.is_sign_negative();
        let absf = f.abs();
        let precision: i32 = 21;

        // Compute base-10 exponent for absf
        let exp = absf.log10().floor() as i32;

        // Helper to trim trailing fractional zeros and trailing dot
        fn trim_frac(mut s: String) -> String {
            if s.contains('.') {
                while s.ends_with('0') {
                    s.pop();
                }
                if s.ends_with('.') {
                    s.pop();
                }
            }
            s
        }

        let out = if exp >= 0 && exp < precision {
            // Use fixed notation with (precision - (exp+1)) fractional digits
            let frac_digits = (precision - exp - 1) as usize;
            let s = format!("{:.*}", frac_digits, absf);
            trim_frac(s)
        } else {
            // Use scientific notation with one digit before decimal
            let s = format!("{:.*e}", (precision - 1) as usize, absf);
            // normalize to lowercase e and split
            let s = s.replace('E', "e");
            if let Some(pos) = s.find('e') {
                let mant = &s[..pos];
                let exp_part = &s[pos + 1..];
                // exp_part like +03 or -03 or 003
                let sign = if exp_part.starts_with('+') || exp_part.starts_with('-') {
                    &exp_part[..1]
                } else {
                    ""
                };
                let num = if sign.is_empty() { exp_part } else { &exp_part[1..] };
                let num_trim = num.trim_start_matches('0');
                let num_trim = if num_trim.is_empty() { "0" } else { num_trim };
                let exp_formatted = if sign.is_empty() { format!("{}", num_trim) } else { format!("{}{}", sign, num_trim) };
                let mant_trim = trim_frac(mant.to_string());
                format!("{}e{}", mant_trim, exp_formatted)
            } else {
                // fallback
                s
            }
        };

        if neg { format!("-{}", out) } else { out }
    } else {
        // Fallback to original textual number
        n.to_string()
    }
}
