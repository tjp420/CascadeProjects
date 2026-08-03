const { SchnorrShareEvaluator } = require('./ai-platform/server/lib/mpc/schnorr/signature_share.cjs');
const { normalizeToBigInt } = require('./ai-platform/server/lib/mpc/schnorr/field.cjs');
const SECP256K1_Q='115792089237316195423570985008687907852837564279074904382605163141518161494494337';
const evaluator = new SchnorrShareEvaluator(SECP256K1_Q);
const challengeNum = 12345n;
const secret = 100n;
const lambda = 1n;
const nonces = { k1: 5n, k2: 7n };
const binding = 3n;

const inputsNumeric = { challenge: challengeNum, secretKeyShare: secret, lagrangeWeight: lambda, secretNonces: nonces, bindingFactor: binding };
const inputsMixed = { challenge: '0x' + challengeNum.toString(16), secretKeyShare: '64', lagrangeWeight: '1', secretNonces: { k1: '5', k2: '7' }, bindingFactor: '0x3' };

function trace(inputs, label) {
  console.log('---', label);
  console.log('challenge raw:', inputs.challenge, 'normalized:', normalizeToBigInt(inputs.challenge).toString());
  console.log('secret raw:', inputs.secretKeyShare, 'normalized:', normalizeToBigInt(inputs.secretKeyShare).toString());
  console.log('lambda raw:', inputs.lagrangeWeight, 'normalized:', normalizeToBigInt(inputs.lagrangeWeight).toString());
  console.log('k1 raw:', inputs.secretNonces.k1, 'normalized:', normalizeToBigInt(inputs.secretNonces.k1).toString());
  console.log('k2 raw:', inputs.secretNonces.k2, 'normalized:', normalizeToBigInt(inputs.secretNonces.k2).toString());
  console.log('b raw:', inputs.bindingFactor, 'normalized:', normalizeToBigInt(inputs.bindingFactor).toString());
  const out = evaluator.evaluatePartialShare(inputs);
  console.log('out:', out.toString());
}

trace(inputsNumeric, 'numeric');
trace(inputsMixed, 'mixed');
