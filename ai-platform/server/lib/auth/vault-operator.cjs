'use strict';

const logger = require('../app-logger.cjs');
const { isVaultAuthenticated } = require('../dashboard-vault-auth.cjs');
const { trustLevels } = require('./trust-levels.cjs');

function applyVaultOperatorUser(req) {
  const email = process.env.SIMPLEBEACON_BYPASS_EMAIL;
  if (!email) {
    logger.warn(
      '[auth] SIMPLEBEACON_BYPASS_EMAIL not set — vault operator user will use anonymous identity'
    );
  }
  req.user = {
    id: 'vault-operator',
    email: email || 'anonymous@localhost',
    name: 'Vault Operator',
    trustLevel: 'gold',
    permissions: trustLevels.gold.permissions,
    vaultSession: true,
  };
}

function vaultOperatorSessionActive(req) {
  const devBypass = process.env.SIMPLEBEACON_DEV_BYPASS_AUTH === 'true';
  if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) && devBypass) {
    return true;
  }
  const vaultPassword = process.env.DASHBOARD_VAULT_PASSWORD;
  if (!vaultPassword) return false;
  return isVaultAuthenticated(req, {
    internalDashboard: true,
    vaultPassword,
  });
}

module.exports = { applyVaultOperatorUser, vaultOperatorSessionActive };
