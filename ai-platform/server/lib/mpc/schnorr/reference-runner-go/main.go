package main

import (
    "encoding/json"
    "fmt"
    "io"
    "os"
    "sort"
    "strings"

    "golang.org/x/text/unicode/norm"
)

// Minimal JCS-like canonicalizer with NFC normalization for strings and
// Unicode codepoint ordering for object keys. This intentionally keeps
// numeric formatting simple — extend to match production rules as needed.
func canonicalize(v interface{}) string {
    switch vv := v.(type) {
    case nil:
        return "null"
    case bool:
        if vv {
            return "true"
        }
        return "false"
    case float64:
        // JSON numbers are float64 when decoded with encoding/json
        if !isFinite(vv) {
            return "null"
        }
        if vv == 0 {
            return "0"
        }
        // Use Go's shortest representation similar to JS toPrecision 21
        s := strings.ReplaceAll(fmtFloat(vv), "E", "e")
        return s
    case string:
        // Normalize to NFC
        normed := norm.NFC.String(vv)
        b, _ := json.Marshal(normed)
        return string(b)
    case []interface{}:
        parts := make([]string, 0, len(vv))
        for _, e := range vv {
            parts = append(parts, canonicalize(e))
        }
        return "[" + strings.Join(parts, ",") + "]"
    case map[string]interface{}:
        // BigInt marker support
        if len(vv) == 1 {
            if s, ok := vv["__bigint_hex"]; ok {
                if str, ok := s.(string); ok {
                    b, _ := json.Marshal(str)
                    return string(b)
                }
            }
        }
        // Collect original keys and sort by NFC-normalized codepoint order
        keys := make([]string, 0, len(vv))
        for k := range vv {
            keys = append(keys, k)
        }
        sort.Slice(keys, func(i, j int) bool {
            ni := norm.NFC.String(keys[i])
            nj := norm.NFC.String(keys[j])
            return compareByCodepoints(ni, nj) < 0
        })
        parts := make([]string, 0, len(keys))
        for _, k := range keys {
            kn := norm.NFC.String(k)
            b, _ := json.Marshal(kn)
            parts = append(parts, string(b)+":"+canonicalize(vv[k]))
        }
        return "{" + strings.Join(parts, ",") + "}"
    default:
        // Fallback: marshal and return
        b, _ := json.Marshal(vv)
        return string(b)
    }
}

func isFinite(f float64) bool {
    return !((f != f) || (f > 1e308) || (f < -1e308))
}

// Simple float formatting to mimic trimmed fractional zeros.
func fmtFloat(f float64) string {
    s := fmt.Sprintf("%.21g", f)
    s = strings.ReplaceAll(s, "e+", "e")
    s = strings.ReplaceAll(s, "E", "e")
    return s
}

// compareByCodepoints returns -1 if a<b, 0 if equal, 1 if a>b by Unicode scalar values
func compareByCodepoints(a, b string) int {
    ra := []rune(a)
    rb := []rune(b)
    la := len(ra)
    lb := len(rb)
    for i := 0; i < la && i < lb; i++ {
        if ra[i] < rb[i] {
            return -1
        }
        if ra[i] > rb[i] {
            return 1
        }
    }
    if la < lb {
        return -1
    }
    if la > lb {
        return 1
    }
    return 0
}

func main() {
    var input interface{}
    data, err := io.ReadAll(os.Stdin)
    if err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(2)
    }
    if err := json.Unmarshal(data, &input); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(2)
    }
    fmt.Println(canonicalize(input))
}
