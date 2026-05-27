/**
 * Site config — staging vs production auto-detect by hostname.
 * Set PAYMENTS_ENABLED = true when ready to use Stripe checkout.
 */
(function () {
  var PAYMENTS_ENABLED = true;

  var host = window.location.hostname;
  var port = window.location.port;
  var onLocalDashboard =
    port === '54355' || host === 'localhost' || host === '127.0.0.1';

  var STRIPE_LINK_LIVE = 'https://buy.stripe.com/aFaaEW2JF8nJdxlch0eEo00';
  var STRIPE_LINK_TEST = 'https://buy.stripe.com/test_aFaaEW2JF8nJdxlch0eEo00';

  var isProductionSite =
    host === 'simplebeacon.ai' || host === 'www.simplebeacon.ai';
  var isStaging = !isProductionSite;

  var stripeLink = '';
  if (PAYMENTS_ENABLED) {
    stripeLink = isProductionSite ? STRIPE_LINK_LIVE : STRIPE_LINK_TEST;
  }

  window.SIMPLEBEACON_SITE = {
    brandName: 'SimpleBeacon',
    cliName: 'simplebeacon',
    prelaunch: !PAYMENTS_ENABLED,
    closedSource: true,
    staticOnly: !onLocalDashboard,
    paymentsEnabled: PAYMENTS_ENABLED,
    stagingMode: isStaging,
    productionSite: isProductionSite,
    appOrigin: '',
    waitlistWebhook: '',
    githubUrl: '',
    sampleReportUrl: '/sample-report',
    auditPriceLabel: '$499',
    auditEmail: isProductionSite ? 'audit@simplebeacon.ai' : 'trevor_punt@live.com',
    auditBookingApi: '/api/audit-booking',
    operatorInboxUrl: '/operator/bookings',
    stripePaymentLink: stripeLink,
    diagnosticEnabled: true,
    calendlyUrl: ''
  };
})();
