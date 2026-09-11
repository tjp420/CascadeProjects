'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    AUTH_TOKEN_KEYS,
    navAuthScript,
    transformHtml,
    stripCloudflareBeaconHtml
} = require('../lib/site-html.cjs');

const pageConfig = {
    origin: 'https://simplebeacon.ai',
    ogImage: '/favicon.svg',
    pages: {
        'faq.html': {
            title: 'FAQ',
            description: 'FAQ',
            includeNav: true,
            includeFooter: true
        }
    }
};

describe('site-html nav auth', () => {
    it('includes the token keys used by audit and dashboard sign-in', () => {
        assert.ok(AUTH_TOKEN_KEYS.includes('sb_auth_token'));
        assert.ok(AUTH_TOKEN_KEYS.includes('sb-token'));
        assert.ok(AUTH_TOKEN_KEYS.includes('cascadeAuthToken'));
    });

    it('emits parseable auth JS without interpolating $& as <body>', () => {
        const script = navAuthScript();
        assert.doesNotMatch(script, /\\<body>/);
        assert.doesNotMatch(script, /replace\([^,]+,'\\\$&'\)/);
        const start = script.indexOf('(function(){');
        const end = script.lastIndexOf('})();');
        assert.ok(start >= 0 && end > start);
        const js = script.slice(start, end + 5);
        assert.doesNotThrow(() => new Function(js));
    });

    it('keeps auth JS valid after injecting nav after <body>', () => {
        const html = [
            '<!doctype html><html><head>',
            '<meta charset="UTF-8">',
            '</head><body class="faq">',
            '<p>hello</p></body></html>'
        ].join('');
        const out = transformHtml(html, 'faq.html', pageConfig);
        assert.match(out, /sb_auth_token/);
        assert.match(out, /sb-token/);
        assert.match(out, /data-sb-beacon-neutralize=/);
        assert.doesNotMatch(out, /getCookieVal[\s\S]{0,120}\\<body>/);

        const match = out.match(/<script>\(function\(\)\{var TOKEN_KEYS[\s\S]*?\}\)\(\);<\/script>/);
        assert.ok(match, 'injected nav auth script');
        assert.doesNotThrow(() => new Function(match[0].replace(/^<script>/, '').replace(/<\/script>$/, '')));
    });

    it('strips Cloudflare beacon tags from HTML', () => {
        const html =
            '<html><body><script defer src="https://static.cloudflareinsights.com/beacon.min.js" integrity="sha512-abc"></script></body></html>';
        const stripped = stripCloudflareBeaconHtml(html);
        assert.doesNotMatch(stripped, /cloudflareinsights/);
        assert.doesNotMatch(stripped, /integrity=/);
    });
});
