package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"os"
    "bytes"
	"sort"
	"strconv"
)

const MaxSignificant = 21

func normalizeNumber(f float64) string {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return "null"
	}
	if math.Signbit(f) && f == 0 {
		return "0"
	}
	// toPrecision-like: use strconv with FormatFloat and precision
	// We'll use %.[prec]g formatting which is similar to toPrecision
	s := strconv.FormatFloat(f, 'g', MaxSignificant, 64)
	// split mantissa and exponent (if present)
	mant := s
	exp := ""
	for i := 0; i < len(s); i++ {
		if s[i] == 'e' || s[i] == 'E' {
			mant = s[:i]
			exp = s[i+1:]
			break
		}
	}

	// strip trailing zeros after decimal from mantissa only
	if dot := findDot(mant); dot >= 0 {
		for len(mant) > 0 && mant[len(mant)-1] == '0' {
			mant = mant[:len(mant)-1]
		}
		if len(mant) > 0 && mant[len(mant)-1] == '.' {
			mant = mant[:len(mant)-1]
		}
	}

	// normalize exponent: remove leading + and leading zeros
	if exp != "" {
		// remove leading +
		if exp[0] == '+' {
			exp = exp[1:]
		}
		// remove leading zeros but keep single 0
		neg := false
		if len(exp) > 0 && exp[0] == '-' {
			neg = true
			exp = exp[1:]
		}
		// trim leading zeros
		i := 0
		for i < len(exp) && exp[i] == '0' {
			i++
		}
		exp = exp[i:]
		if exp == "" {
			exp = "0"
		}
		if neg {
			exp = "-" + exp
		}
		s = mant + "e" + exp
	} else {
		s = mant
	}
	return s
}

func normalizeExp(s string) string {
	// replace E with e, remove + in exponent
	out := ""
	i := 0
	for i < len(s) {
		if s[i] == 'E' {
			out += "e"
			i++
			continue
		}
		out += string(s[i])
		i++
	}
	// remove + after e
	out2 := ""
	for i := 0; i < len(out); i++ {
		if out[i] == 'e' && i+1 < len(out) && out[i+1] == '+' {
			out2 += "e"
			i++
			continue
		}
		out2 += string(out[i])
	}
	return out2
}

func findDot(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return i
		}
	}
	return -1
}

func canonicalize(v interface{}) (string, error) {
	switch x := v.(type) {
	case nil:
		return "null", nil
	case bool:
		if x {
			return "true", nil
		}
		return "false", nil
	case float64:
		return normalizeNumber(x), nil
	case string:
		b, _ := json.Marshal(x)
		return string(b), nil
	case json.Number:
		// parse as float
		f, err := x.Float64()
		if err != nil {
			return "null", nil
		}
		return normalizeNumber(f), nil
	case map[string]interface{}:
			// detect bigint hex marker
			if v0, ok := x["__bigint_hex"]; ok {
				switch vv := v0.(type) {
				case string:
					b, _ := json.Marshal(vv)
					return string(b), nil
				case float64:
					// convert numeric to string
					s := strconv.FormatFloat(vv, 'f', -1, 64)
					b, _ := json.Marshal(s)
					return string(b), nil
				default:
					// fallback: stringify generically
					s := fmt.Sprintf("%v", vv)
					b, _ := json.Marshal(s)
					return string(b), nil
				}
			}
			keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			if x[k] == nil {
				continue
			}
			kv, err := canonicalize(x[k])
			if err != nil {
				return "", err
			}
			parts = append(parts, jsonMarshalToString(k)+":"+kv)
		}
		return "{" + join(parts, ",") + "}", nil
	case []interface{}:
		parts := make([]string, 0, len(x))
		for _, it := range x {
			c, err := canonicalize(it)
			if err != nil {
				return "", err
			}
			parts = append(parts, c)
		}
		return "[" + join(parts, ",") + "]", nil
	case *big.Int:
		// big ints: hex string
		b, _ := json.Marshal(x.Text(16))
		return string(b), nil
	default:
		// attempt to handle numeric types
		switch y := x.(type) {
		case int64:
			return strconv.FormatInt(y, 10), nil
		case int:
			return strconv.Itoa(y), nil
		case uint64:
			return strconv.FormatUint(y, 10), nil
		case json.RawMessage:
			var v2 interface{}
			if err := json.Unmarshal(y, &v2); err != nil {
				return "", err
			}
			return canonicalize(v2)
		default:
			return "null", nil
		}
	}
}

// helper: join strings
func join(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += sep + parts[i]
	}
	return out
}

// helper to marshal string key to JSON string without error
func jsonMarshalToString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func main() {
	// read stdin fully
	r := bufio.NewReader(os.Stdin)
	data, err := io.ReadAll(r)
	if err != nil {
		fmt.Fprintln(os.Stderr, "read stdin:", err)
		os.Exit(2)
	}
	var v interface{}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if err := dec.Decode(&v); err != nil {
		fmt.Fprintln(os.Stderr, "invalid json:", err)
		os.Exit(2)
	}
	can, err := canonicalize(v)
	if err != nil {
		fmt.Fprintln(os.Stderr, "canonicalize:", err)
		os.Exit(2)
	}
	h := sha256.Sum256([]byte(can))
	fmt.Println(can)
	fmt.Println(hex.EncodeToString(h[:]))
}
