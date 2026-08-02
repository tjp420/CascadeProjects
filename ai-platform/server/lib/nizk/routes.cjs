const express = require('express');
const router = express.Router();

const { generateAndStore, verifyProof, getStoredProof, listProofsByPolicy } = require('./index.cjs');

router.post('/nizk/generate', express.json(), (req, res) => {
  const { policy_id, public_inputs, secret_inputs, scheme } = req.body || {};
  const { record, proof } = generateAndStore({ policyId: policy_id, publicInputs: public_inputs || {}, secretInputs: secret_inputs || {}, scheme });
  res.json({ record, proof });
});

router.post('/nizk/verify', express.json(), (req, res) => {
  const { policy_id, public_inputs, proof_bundle } = req.body || {};
  const result = verifyProof({ publicInputs: public_inputs || {}, proof_bundle });
  res.json(result);
});

router.get('/nizk/proofs/:id', (req, res) => {
  const rec = getStoredProof(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not_found' });
  res.json(rec);
});

module.exports = router;
