/**
 * SimpleBeacon Analytics Dispatcher
 *
 * Lightweight event tracking wrapper around Google Analytics (gtag) with
 * no-op fallback when GA is not loaded. Supports custom event dispatch
 * for CRO touchpoints: hero CTAs, split-choice buttons, pricing checkout,
 * and engagement milestones.
 *
 * Usage:
 *   SbAnalytics.track('hero_cta_click', { label: 'run_free_scan', page: 'home' });
 *   SbAnalytics.trackBeginCheckout('developer', 49);
 *   SbAnalytics.trackSplitChoice('browser_triage');
 *
 * Events are pushed to window.dataLayer (GA4) and also logged to console
 * in development mode for debugging.
 *
 * Event schema:
 *   { event: string, event_category: string, event_label: string, value: number, ...custom }
 *
 * No external dependencies. Works with or without GA loaded.
 */

(function (global) {
    'use strict';

    var DEV_MODE = global.location && global.location.hostname === 'localhost';
    var QUEUE_KEY = 'sb_analytics_queue';
    var MAX_QUEUE = 50;

    /**
     * Check if gtag is available (GA4 loaded).
     * @returns {boolean}
     */
    function hasGtag() {
        return typeof global.gtag === 'function';
    }

    /**
     * Check if dataLayer exists.
     * @returns {boolean}
     */
    function hasDataLayer() {
        return typeof global.dataLayer !== 'undefined' && Array.isArray(global.dataLayer);
    }

    /**
     * Ensure dataLayer exists (GA4 convention).
     */
    function ensureDataLayer() {
        if (!hasDataLayer()) {
            global.dataLayer = [];
        }
    }

    /**
     * Persist an event to localStorage queue for retry when GA loads later.
     * @param {Object} event - Event object
     */
    function persistEvent(event) {
        try {
            var queue = JSON.parse(global.localStorage.getItem(QUEUE_KEY) || '[]');
            queue.push({ event: event, ts: Date.now() });
            if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
            global.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (_) {
            // localStorage not available (private mode, etc.) — silently skip
        }
    }

    /**
     * Flush queued events to GA when it becomes available.
     */
    function flushQueue() {
        try {
            var queue = JSON.parse(global.localStorage.getItem(QUEUE_KEY) || '[]');
            if (queue.length === 0) return;
            for (var i = 0; i < queue.length; i++) {
                var entry = queue[i];
                if (hasGtag()) {
                    global.gtag('event', entry.event.name, entry.event.params);
                }
            }
            global.localStorage.removeItem(QUEUE_KEY);
        } catch (_) {
            // Silently skip on storage errors
        }
    }

    /**
     * Core event tracking function.
     *
     * @param {string} eventName - GA4 event name (snake_case, max 40 chars)
     * @param {Object} params - Event parameters
     * @param {string} [params.event_category] - Event category (e.g., 'engagement', 'ecommerce')
     * @param {string} [params.event_label] - Event label for identification
     * @param {number} [params.value] - Numeric value (e.g., price in USD)
     * @param {string} [params.page] - Page where event occurred
     * @param {string} [params.section] - Page section (e.g., 'hero', 'split_choice', 'pricing')
     * @returns {boolean} true if dispatched, false if queued
     */
    function track(eventName, params) {
        params = params || {};
        var enriched = {
            event_category: params.event_category || 'engagement',
            event_label: params.event_label || eventName,
            value: params.value || 0,
            page: params.page || (global.location ? global.location.pathname : 'unknown'),
            section: params.section || '',
            send_to: params.send_to || undefined
        };
        // Merge custom params
        for (var key in params) {
            if (params.hasOwnProperty(key) && !(key in enriched)) {
                enriched[key] = params[key];
            }
        }
        // Remove undefined send_to
        if (enriched.send_to === undefined) delete enriched.send_to;

        if (hasGtag()) {
            global.gtag('event', eventName, enriched);
            if (DEV_MODE) {
                console.debug('[SbAnalytics] tracked:', eventName, enriched);
            }
            return true;
        } else {
            // Queue for later flush
            persistEvent({ name: eventName, params: enriched });
            if (DEV_MODE) {
                console.debug('[SbAnalytics] queued (no gtag):', eventName, enriched);
            }
            return false;
        }
    }

    /**
     * Track a CTA button click.
     * @param {string} ctaId - CTA identifier (e.g., 'run_free_scan', 'view_cli_setup')
     * @param {string} section - Page section (e.g., 'hero', 'split_choice')
     * @param {Object} [extra] - Additional params
     */
    function trackCta(ctaId, section, extra) {
        return track('cta_click', {
            event_category: 'engagement',
            event_label: ctaId,
            section: section || 'unknown',
            cta_id: ctaId,
            send_to: extra && extra.send_to
        });
    }

    /**
     * Track the audit sandbox split-choice button click.
     * @param {string} choice - 'browser_triage' or 'deep_scan'
     */
    function trackSplitChoice(choice) {
        return track('split_choice_click', {
            event_category: 'engagement',
            event_label: choice,
            section: 'split_choice',
            choice: choice
        });
    }

    /**
     * Track beginning of a checkout flow.
     * @param {string} tier - Pricing tier (e.g., 'developer', 'team_pro', 'enterprise')
     * @param {number} [value] - Price in USD
     */
    function trackBeginCheckout(tier, value) {
        return track('begin_checkout', {
            event_category: 'ecommerce',
            event_label: tier,
            section: 'pricing',
            tier: tier,
            value: value || 0,
            currency: 'USD'
        });
    }

    /**
     * Track a page view (useful for SPA navigation).
     * @param {string} pagePath - Page path (e.g., '/pricing')
     * @param {string} [pageTitle] - Page title
     */
    function trackPageView(pagePath, pageTitle) {
        if (hasGtag()) {
            global.gtag('event', 'page_view', {
                page_path: pagePath,
                page_title: pageTitle || '',
                send_to: undefined
            });
            return true;
        }
        return track('page_view', {
            event_category: 'navigation',
            event_label: pagePath,
            page: pagePath
        });
    }

    /**
     * Track an engagement milestone (e.g., user scrolled 50%, user opened terminal).
     * @param {string} milestone - Milestone identifier
     * @param {Object} [extra] - Additional params
     */
    function trackMilestone(milestone, extra) {
        return track('engagement_milestone', {
            event_category: 'engagement',
            event_label: milestone,
            milestone: milestone,
            section: (extra && extra.section) || ''
        });
    }

    /**
     * Track a VS Code extension link click.
     * @param {string} source - Where the link was clicked (e.g., 'hero', 'audit_banner')
     */
    function trackExtensionInstall(source) {
        return track('extension_install_click', {
            event_category: 'conversion',
            event_label: 'vscode_extension',
            section: source || 'unknown',
            source: source
        });
    }

    // ── Auto-flush queue when GA loads ──
    // Check periodically for 10 seconds
    var flushAttempts = 0;
    var flushInterval = global.setInterval(function () {
        if (hasGtag()) {
            flushQueue();
            global.clearInterval(flushInterval);
        } else if (++flushAttempts >= 20) {
            global.clearInterval(flushInterval);
        }
    }, 500);

    // ── Export ──
    global.SbAnalytics = {
        track: track,
        trackCta: trackCta,
        trackSplitChoice: trackSplitChoice,
        trackBeginCheckout: trackBeginCheckout,
        trackPageView: trackPageView,
        trackMilestone: trackMilestone,
        trackExtensionInstall: trackExtensionInstall,
        flushQueue: flushQueue,
        hasGtag: hasGtag,
        hasDataLayer: hasDataLayer,
        // Test helpers
        _persistEvent: persistEvent,
        _ensureDataLayer: ensureDataLayer,
        _QUEUE_KEY: QUEUE_KEY
    };

    // Also flush on DOMContentLoaded
    if (global.document) {
        global.document.addEventListener('DOMContentLoaded', function () {
            if (hasGtag()) flushQueue();
        });
    }
})(typeof window !== 'undefined' ? window : this);
