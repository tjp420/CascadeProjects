"use strict";

/**
 * RFC 3394 AES Key Wrap (AES-KW) and RFC 5649 AES Key Wrap with Padding
 * (AES-KWP) test vectors.
 *
 * Sources:
 *   - RFC 3394 Section 4 (test vectors 4.1–4.6)
 *   - RFC 5649 Section 6 (padded key wrap examples)
 *   - NIST SP 800-38F
 *
 * All vectors are exported as Buffer objects for direct use with
 * crypto.createCipheriv / createDecipheriv and AES-KW implementations.
 *
 * @module aes-kw-vectors
 */

// ── Helpers ─────────────────────────────────────────────────────────────

function hex(s) {
  return Buffer.from(s.replace(/\s+/g, ""), "hex");
}

// ── RFC 3394 AES-KW Vectors (Section 4.1–4.6) ──────────────────────────
//
// Each vector has:
//   id       — RFC section number
//   kekBits  — KEK size in bits (128, 192, 256)
//   keyBits  — key data size in bits (128, 192, 256)
//   kek      — Buffer, key-encrypting key
//   plaintext  — Buffer, key data to wrap
//   ciphertext — Buffer, expected wrapped output
// ──────────────────────────────────────────────────────────────────────

const KW_VECTORS = [
  {
    id: "4.1",
    name: "128-bit key with 128-bit KEK",
    kekBits: 128,
    keyBits: 128,
    kek: hex("000102030405060708090A0B0C0D0E0F"),
    plaintext: hex("00112233445566778899AABBCCDDEEFF"),
    ciphertext: hex("1FA68B0A8112B447 AEF34BD8FB5A7B82 9D3E862371D2CFE5"),
  },
  {
    id: "4.2",
    name: "128-bit key with 192-bit KEK",
    kekBits: 192,
    keyBits: 128,
    kek: hex("000102030405060708090A0B0C0D0E0F1011121314151617"),
    plaintext: hex("00112233445566778899AABBCCDDEEFF"),
    ciphertext: hex("96778B25AE6CA435 F92B5B97C050AED2 468AB8A17AD84E5D"),
  },
  {
    id: "4.3",
    name: "128-bit key with 256-bit KEK",
    kekBits: 256,
    keyBits: 128,
    kek: hex(
      "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F",
    ),
    plaintext: hex("00112233445566778899AABBCCDDEEFF"),
    ciphertext: hex("64E8C3F9CE0F5BA2 63E9777905818A2A 93C8191E7D6E8AE7"),
  },
  {
    id: "4.4",
    name: "192-bit key with 192-bit KEK",
    kekBits: 192,
    keyBits: 192,
    kek: hex("000102030405060708090A0B0C0D0E0F1011121314151617"),
    plaintext: hex("00112233445566778899AABBCCDDEEFF0001020304050607"),
    ciphertext: hex(
      "031D33264E15D332 68F24EC260743EDC E1C6C7DDEE725A93 6BA814915C6762D2",
    ),
  },
  {
    id: "4.5",
    name: "192-bit key with 256-bit KEK",
    kekBits: 256,
    keyBits: 192,
    kek: hex(
      "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F",
    ),
    plaintext: hex("00112233445566778899AABBCCDDEEFF0001020304050607"),
    ciphertext: hex(
      "A8F9BC1612C68B3F F6E6F4FBE30E71E4 769C8B80A32CB895 8CD5D17D6B254DA1",
    ),
  },
  {
    id: "4.6",
    name: "256-bit key with 256-bit KEK",
    kekBits: 256,
    keyBits: 256,
    kek: hex(
      "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F",
    ),
    plaintext: hex(
      "00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F",
    ),
    ciphertext: hex(
      "28C9F404C4B810F4 CBCCB35CFB87F826 3F5786E2D80ED326 CBC7F0E71A99F43B FB988B9B7A02DD21",
    ),
  },
];

// ── RFC 5649 AES-KWP Vectors (Section 6) ────────────────────────────────
//
// AES-KWP wraps key data of arbitrary length (not just multiples of 64 bits).
// The AIV is A65959A6 || MLI (32-bit message length indicator).
//
// Each vector has:
//   id       — RFC section number
//   kekBits  — KEK size in bits
//   keyOctets — number of key data octets (may not be a multiple of 8)
//   kek      — Buffer, key-encrypting key
//   plaintext  — Buffer, key data to wrap (arbitrary length)
//   ciphertext — Buffer, expected wrapped output
// ──────────────────────────────────────────────────────────────────────

const KWP_VECTORS = [
  {
    id: "6.1",
    name: "20-octet key with 192-bit KEK (non-multiple-of-8 padding)",
    kekBits: 192,
    keyOctets: 20,
    kek: hex("5840df6e29b02af1 ab493b705bf16ea1 ae8338f4dcc176a8"),
    plaintext: hex("c37b7e6492584340 bed1220780894115 5068f738"),
    ciphertext: hex(
      "138bdeaa9b8fa7fc 61f97742e72248ee 5ae6ae5360d1ae6a 5f54f373fa543b6a",
    ),
  },
  {
    id: "6.2",
    name: "7-octet key with 192-bit KEK (single block, short key)",
    kekBits: 192,
    keyOctets: 7,
    kek: hex("5840df6e29b02af1 ab493b705bf16ea1 ae8338f4dcc176a8"),
    plaintext: hex("466f7250617369"),
    ciphertext: hex("afbeb0f07dfbf541 9200f2ccb50bb24f"),
  },
];

// ── Default IV (RFC 3394 Section 2.2.3.1) ───────────────────────────────

const DEFAULT_IV = hex("A6A6A6A6A6A6A6A6");

// ── AIV constant for AES-KWP (RFC 5649 Section 3) ───────────────────────

const KWP_AIV_CONSTANT = hex("A65959A6");

module.exports = {
  KW_VECTORS,
  KWP_VECTORS,
  DEFAULT_IV,
  KWP_AIV_CONSTANT,
  hex,
};
