/**
 * Account type definitions — tier metadata + default TTLs for time-based tokens.
 * Consumed by time-tokens.cjs, checkout routes, and the dashboard tier decoder.
 */

'use strict';

const { getPlan } = require('./plans.cjs');

const ACCOUNT_TYPES = {
  starter: {
    tierId: 'starter',
    tag: 'Starter',
    name: 'Free',
    defaultTtlDays: 365,
    maxRenewals: 0,
    gracePeriodDays: 0,
    billing: 'free'
  },
  pro: {
    tierId: 'pro',
    tag: 'Pro',
    name: 'Continuous Shield',
    defaultTtlDays: 30,
    maxRenewals: null,
    gracePeriodDays: 3,
    billing: 'monthly'
  },
  enterprise: {
    tierId: 'enterprise',
    tag: 'Enterprise',
    name: 'Compliance Suite',
    defaultTtlDays: 365,
    maxRenewals: null,
    gracePeriodDays: 14,
    billing: 'annual'
  },
  trial: {
    tierId: 'pro',
    tag: 'Trial',
    name: '14-Day Trial',
    defaultTtlDays: 14,
    maxRenewals: 0,
    gracePeriodDays: 0,
    billing: 'trial'
  }
};

const TIME_TOKEN_PERIODS = {
  trial: { label: '14-Day Trial', days: 14, tierHint: 'pro' },
  monthly: { label: 'Monthly', days: 30, tierHint: 'pro' },
  quarterly: { label: 'Quarterly', days: 90, tierHint: 'pro' },
  annual: { label: 'Annual', days: 365, tierHint: 'enterprise' },
  lifetime: { label: 'Lifetime', days: 100 * 365, tierHint: 'enterprise' }
};

function getAccountType(typeId) {
  return ACCOUNT_TYPES[typeId] || null;
}

function getTimePeriod(periodId) {
  return TIME_TOKEN_PERIODS[periodId] || null;
}

function resolveAccountTokenConfig(typeId, periodId) {
  const account = getAccountType(typeId);
  if (!account) return null;

  const period = periodId ? getTimePeriod(periodId) : null;
  const ttlDays = period ? period.days : account.defaultTtlDays;
  const plan = getPlan(account.tierId);

  return {
    typeId,
    periodId: period?.label || 'default',
    tier: account.tierId,
    tag: account.tag,
    ttlDays,
    maxRenewals: account.maxRenewals,
    gracePeriodDays: account.gracePeriodDays,
    billing: account.billing,
    features: plan ? plan.moduleAccess : [],
    limits: plan ? plan.limits : {}
  };
}

module.exports = {
  ACCOUNT_TYPES,
  TIME_TOKEN_PERIODS,
  getAccountType,
  getTimePeriod,
  resolveAccountTokenConfig
};
