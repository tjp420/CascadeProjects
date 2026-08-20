"use strict";
/**
 * Inlines auth.js, site-config.js, and app-links.js into coming-soon HTML pages.
 * Eliminates NS_BINDING_ABORTED on Firefox by removing external script dependencies.
 */
const fs = require("fs");
const path = require("path");

const AUTH_INLINE = `<script>(function(){var TOKEN_KEYS=['cascadeAuthToken','cascadeAuthUser','access_token','token','authToken','simplebeacon_token','sb-token-vault'];function clearLocalStorageItems(keys){try{for(var i=0;i<keys.length;i++){localStorage.removeItem(keys[i]);}}catch(_){}}function clearCookies(keys){try{for(var i=0;i<keys.length;i++){document.cookie=keys[i]+'=;path=/;max-age=0;SameSite=Lax;';}}catch(_){}}function signOut(){clearLocalStorageItems(TOKEN_KEYS);clearCookies(TOKEN_KEYS);try{sessionStorage.clear();}catch(_){}window.location.reload();}function propagateTokenToLinks(){try{var params=new URLSearchParams(window.location.search);var token=params.get('token');if(!token)return;var links=document.querySelectorAll('.nav-links a');for(var i=0;i<links.length;i++){var a=links[i];var href=a.getAttribute('href')||'';if(href.indexOf('#')===-1&&href.indexOf('http')!==0){var sep=href.indexOf('?')===-1?'?':'&';a.setAttribute('href',href+sep+'token='+encodeURIComponent(token));}}}catch(e){}}window.SbAuth={signOut:signOut,propagateTokenToLinks:propagateTokenToLinks};})();</script>`;

const SITE_CONFIG_INLINE = `<script>
window.SIMPLEBEACON_SITE = window.SIMPLEBEACON_SITE || {
  env: 'production', githubUrl: 'https://github.com/tjp420/simplebeacon',
  vsixDownloadUrl: 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix',
  sampleReportUrl: 'sample-report.html', sampleCertificateUrl: 'sample-certificate.html',
  sampleEuAiActReportUrl: null, pricingUrl: 'pricing.html', communityUrl: 'community.html',
  contactUrl: 'contact.html', contactPageUrl: 'contact.html', termsUrl: 'terms.html',
  privacyUrl: 'privacy.html', refundUrl: 'refund.html', cloudTeamsUrl: null, auditEmail: null,
  pricing: {
    developer: { name: 'Free', price: 0, stripeLink: null, testStripeLink: null },
    startup: { name: 'Pro', price: 9, stripeLink: null, testStripeLink: null },
    compliance: { name: 'Compliance Suite', price: 399, stripeLink: null, testStripeLink: null },
    enterprise: { name: 'Enterprise Air-Gapped', price: null, stripeLink: null, testStripeLink: null }
  },
  instantReportLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
  stripePaymentLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
  euAiActPackLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',
  apiBase: (typeof location!=='undefined'&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='simplebeacon.ai'||location.hostname==='www.simplebeacon.ai'||location.hostname.endsWith('.onrender.com')))?'':'https://simplebeacon.ai',
  dashboardUrl: '/dashboard/', dashboardAppUrl: '/dashboard/',
  stagingMode: false, paymentsEnabled: true, closedSource: false,
  products: {}, analysisTypes: {}, tierProfiles: {}, features: [], faqs: []
};
(function(){try{var apiBase=window.SIMPLEBEACON_SITE.apiBase||'';fetch(apiBase+'/api/config/pricing').then(function(res){if(!res.ok)return null;return res.json();}).then(function(data){if(!data||!data.success||!data.pricing)return;var cfg=window.SIMPLEBEACON_SITE;var p=data.pricing;if(p.instant&&p.instant.stripeLink){cfg.pricing.instant.stripeLink=p.instant.stripeLink;cfg.instantReportLink=p.instant.stripeLink;}if(p.executive&&p.executive.stripeLink){cfg.pricing.executive.stripeLink=p.executive.stripeLink;cfg.stripePaymentLink=p.executive.stripeLink;}if(p.euSprint&&p.euSprint.stripeLink){cfg.pricing.euSprint.stripeLink=p.euSprint.stripeLink;cfg.euAiActPackLink=p.euSprint.stripeLink;}}).catch(function(){});}catch(e){}})();
</script>`;

const APP_LINKS_INLINE = `<script>(function(){'use strict';var cfg=window.SIMPLEBEACON_SITE||{};var closedSource=cfg.closedSource!==false;function auditEmail(){return cfg.auditEmail||'audit@simplebeacon.ai';}function isStripeUrl(url){return/^https:\\/\\/buy\\.stripe\\.com\\//i.test(String(url||'').trim());}function clearLinkHandlers(el){el.removeAttribute('target');el.removeAttribute('rel');el.removeAttribute('role');el.onclick=null;}function wireStripe(el,url){el.href=url;clearLinkHandlers(el);}function wireBookingForm(el){el.href='#auditBookingForm';clearLinkHandlers(el);}function contactPageHref(topic){var base=String(cfg.contactPageUrl||'contact.html').trim();if(!topic)return base;var sep=base.indexOf('?')>=0?'&':'?';return base+sep+'topic='+encodeURIComponent(topic);}function applyCheckoutLinks(){var auditLink=String(cfg.stripePaymentLink||'').trim();var projectLink=String(cfg.agencyProjectPackLink||'').trim();var growthLink=String(cfg.agencyGrowthPackLink||'').trim();document.querySelectorAll('a.checkout-audit, [data-stripe-checkout]').forEach(function(el){if(isStripeUrl(auditLink))wireStripe(el,auditLink);else wireBookingForm(el);});document.querySelectorAll('[data-agency-checkout="agency_project_pack"], a.checkout-agency-project').forEach(function(el){if(isStripeUrl(projectLink))wireStripe(el,projectLink);else el.href=contactPageHref('agency');});document.querySelectorAll('[data-agency-checkout="agency_growth_pack"], a.checkout-agency-growth').forEach(function(el){if(isStripeUrl(growthLink))wireStripe(el,growthLink);else el.href=contactPageHref('agency');});var euAiActLink=String(cfg.euAiActPackLink||'').trim();document.querySelectorAll('[data-eu-ai-checkout], a.checkout-eu-ai-act').forEach(function(el){if(isStripeUrl(euAiActLink))wireStripe(el,euAiActLink);else el.href=contactPageHref('eu-ai-act');});document.querySelectorAll('a.checkout-direct').forEach(function(el){if(el.hasAttribute('data-agency-checkout'))return;var href=String(el.getAttribute('href')||'');if(isStripeUrl(href)&&!isStripeUrl(auditLink)&&!isStripeUrl(projectLink)&&!isStripeUrl(growthLink)){wireBookingForm(el);}});}function applyDataTierCheckoutLinks(){var pricing=cfg.pricing||{};var isStaging=cfg.stagingMode===true||cfg.env!=='production';document.querySelectorAll('.checkout-btn[data-tier]').forEach(function(el){var tierKey=el.getAttribute('data-tier');var tierData=pricing[tierKey];if(!tierData)return;if(el.tagName==='A'){var url=isStaging?(tierData.testStripeLink||tierData.stripeLink):tierData.stripeLink;if(isStripeUrl(url)){wireStripe(el,url);}else if(tierKey==='free'){el.href='index.html#audit';}else{el.href=contactPageHref(tierKey);}return;}el.addEventListener('click',function(e){e.preventDefault();var url=isStaging?(tierData.testStripeLink||tierData.stripeLink):tierData.stripeLink;if(isStripeUrl(url)){window.location.href=url;}else if(tierKey==='free'){window.location.href='index.html#audit';}else{window.location.href=contactPageHref(tierKey);}});});}function applyStagingCheckoutSwap(){if(!cfg.stagingMode)return;var testStripe=String(cfg.stripePaymentLink||'').trim();if(!/^https:\\/\\/buy\\.stripe\\.com\\/test_/i.test(testStripe))return;document.querySelectorAll('a.checkout-audit, [data-stripe-checkout]').forEach(function(el){wireStripe(el,testStripe);});}function applySampleReportLinks(){var sampleUrl=String(cfg.sampleReportUrl||'sample-report.html').trim();if(!sampleUrl.startsWith('/')&&window.location.protocol!=='file:'){sampleUrl='/'+sampleUrl.replace(/^\\/+/, '');}document.querySelectorAll('[data-sample-report]').forEach(function(el){el.href=sampleUrl;clearLinkHandlers(el);});var euSampleUrl=cfg.sampleEuAiActReportUrl?String(cfg.sampleEuAiActReportUrl).trim():'';if(euSampleUrl){if(!euSampleUrl.startsWith('/')&&window.location.protocol!=='file:'){euSampleUrl='/'+euSampleUrl.replace(/^\\/+/, '');}document.querySelectorAll('[data-eu-ai-sample-report]').forEach(function(el){el.href=euSampleUrl;clearLinkHandlers(el);});}}function applyAuditEmailLinks(){var email=auditEmail();document.querySelectorAll('[data-audit-email-display]').forEach(function(el){el.textContent=email;});document.querySelectorAll('[data-audit-email-link]').forEach(function(el){if(el.tagName!=='A')return;if(el.hasAttribute('data-audit-email-mailto')){var subject=String(el.getAttribute('data-audit-email-subject')||'SimpleBeacon inquiry').trim();el.href='mailto:'+email+'?subject='+encodeURIComponent(subject);el.textContent=el.getAttribute('data-audit-email-label')||email;}else{var topic=String(el.getAttribute('data-audit-email-topic')||'audit').trim();el.href=contactPageHref(topic);el.textContent=el.getAttribute('data-audit-email-label')||'Contact us';}clearLinkHandlers(el);});document.querySelectorAll('[data-contact-link]').forEach(function(el){if(el.tagName!=='A')return;var topic=el.getAttribute('data-contact-topic')||'';el.href=contactPageHref(topic);clearLinkHandlers(el);});}function applyEnvironmentBanner(){if(document.getElementById('stagingBanner')||!cfg.stagingMode)return;var banner=document.createElement('div');banner.id='stagingBanner';banner.className='staging-banner';banner.setAttribute('role','status');banner.innerHTML='<strong>Staging / test environment</strong> — Stripe test checkout only (card 4242…). Live billing activates only on <code>simplebeacon.ai</code>.';document.body.insertBefore(banner,document.body.firstChild);document.documentElement.setAttribute('data-staging-mode','true');}applyCheckoutLinks();applyDataTierCheckoutLinks();applyStagingCheckoutSwap();applySampleReportLinks();applyAuditEmailLinks();applyEnvironmentBanner();if(closedSource){document.documentElement.setAttribute('data-closed-source','true');}})();</script>`;

const AUTH_PATTERN =
  /<script\s+src=["']\/js-es2018\/auth\.js["'][^>]*>\s*<\/script>/gi;
const SITE_CONFIG_PATTERN =
  /<script\s+src=["']site-config\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/gi;
const APP_LINKS_PATTERN =
  /<script\s+src=["']app-links\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/gi;

function walk(dir) {
  return fs.readdirSync(dir).flatMap((f) => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) return walk(fp);
    if (f.endsWith(".html")) return [fp];
    return [];
  });
}

const publicDir = path.resolve(__dirname, "..", "coming-soon", "public");
const files = walk(publicDir);
let changed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;
  const rel = path.relative(publicDir, file);

  if (AUTH_PATTERN.test(content)) {
    content = content.replace(AUTH_PATTERN, AUTH_INLINE);
    modified = true;
    console.log(`  Inlined auth.js -> ${rel}`);
  }
  if (SITE_CONFIG_PATTERN.test(content)) {
    content = content.replace(SITE_CONFIG_PATTERN, SITE_CONFIG_INLINE);
    modified = true;
    console.log(`  Inlined site-config.js -> ${rel}`);
  }
  if (APP_LINKS_PATTERN.test(content)) {
    content = content.replace(APP_LINKS_PATTERN, APP_LINKS_INLINE);
    modified = true;
    console.log(`  Inlined app-links.js -> ${rel}`);
  }

  if (modified) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
  }
}

console.log(`\nDone: ${changed} file(s) updated`);
