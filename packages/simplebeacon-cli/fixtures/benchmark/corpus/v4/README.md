# V4 out-of-sample corpus

**Purpose:** Genuinely new positives + adversarial hard/borderline negatives.  
**Control:** V3 baseline `d4a11503b` — do not modify `labels.v3.json` / `corpus/v3/`.  
**Rules:** Labels and extracts only. **No verifier / gate / dashboard changes.**

OOS positives must not duplicate V3 sink shapes. Hard negatives are designed to look convincing to detectors but must remain unverified.
