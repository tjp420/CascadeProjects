# Simplebeacon Launch Plan

This document outlines the step-by-step plan to launch Simplebeacon and start accepting payments.

## Current Status

**Completed Engineering Tasks (90% done):**
- ✅ Extension product (v0.5.11) with real-time scanning, tier validation, webview dashboard
- ✅ CLI scanner with 38 rule engines, gate enforcement, fix suggestions
- ✅ Billing backend with Stripe integration, webhook handlers, email delivery
- ✅ Marketing site with landing page, pricing page, certificate upload flow
- ✅ Legal docs (EULA, Privacy Policy, Terms of Service)
- ✅ Sales copy for marketplace listing
- ✅ GitHub Action for CI gate integration
- ✅ License token system (JWT generation and validation)

**Completed Go-to-Market Prep:**
- ✅ Icon scaled to 128x128px for marketplace validation
- ✅ Screenshot capture guide created
- ✅ Stripe configuration guide created
- ✅ License flow test guide created
- ✅ Extension README updated with polished sales copy

## Remaining Blockers

### Critical (Must Complete Before Launch)

1. **VS Code Marketplace Publisher Account**
   - Register publisher account for `simplebeacon`
   - Claim extension ID
   - Complete publisher verification

2. **Marketplace Screenshots**
   - Capture 5 screenshots at 1280x800px
   - Upload to marketplace listing
   - Add captions

3. **Stripe Live Mode Configuration**
   - Create 7 products in Stripe Dashboard
   - Configure webhook endpoints
   - Set up live API keys and Price IDs
   - Configure email service (Resend/SMTP)

4. **Domain and Hosting**
   - Deploy marketing site to live domain
   - Configure DNS for `simplebeacon.ai` and `simplebeacon.com`
   - Deploy billing API endpoints
   - Set up SSL certificates

5. **End-to-End License Flow Test**
   - Complete test purchase in Stripe
   - Verify webhook delivery
   - Confirm email with license token
   - Test token activation in extension
   - Verify Pro features unlock

6. **Support Email Setup**
   - Create `support@simplebeacon.com`
   - Configure email forwarding
   - Test email delivery

### Important (Should Complete Before Launch)

7. **Extension Package and Publish**
   - Build extension package
   - Upload to VSCode Marketplace
   - Set pricing and tiers
   - Publish as public

8. **Monitoring and Analytics**
   - Set up error monitoring (Sentry, etc.)
   - Configure analytics for extension usage
   - Set up Stripe webhook monitoring
   - Configure email delivery monitoring

9. **Documentation Site**
   - Deploy documentation to live domain
   - Verify all links work
   - Add getting started guide
   - Include troubleshooting section

10. **GitHub Action Integration**
    - Test GitHub Action in real repository
    - Verify gate enforcement works
    - Add to public documentation

### Nice to Have (Can Defer)

11. **Featured Image**
    - Create 1280x720px featured image
    - Upload to marketplace
    - Test in search results

12. **Social Media Setup**
    - Create Twitter/X account
    - Set up LinkedIn page
    - Prepare launch announcement

13. **Blog Content**
    - Write launch blog post
    - Create technical deep-dive posts
    - Prepare case studies

## Launch Sequence

### Phase 1: Foundation (Week 1)

**Day 1-2: Domain and Hosting**
- [ ] Purchase domains (simplebeacon.ai, simplebeacon.com)
- [ ] Set up hosting (Render, Vercel, or similar)
- [ ] Configure DNS records
- [ ] Set up SSL certificates
- [ ] Deploy marketing site to production
- [ ] Test all marketing site flows

**Day 3-4: Stripe Configuration**
- [ ] Create Stripe account (if not already done)
- [ ] Complete Stripe onboarding (bank account, business details)
- [ ] Create 7 products in Stripe Dashboard
- [ ] Configure webhook endpoints
- [ ] Set up email service (Resend recommended)
- [ ] Test email delivery
- [ ] Generate license secret
- [ ] Update environment variables with live keys

**Day 5: Support Email**
- [ ] Create support@simplebeacon.com
- [ ] Configure email forwarding to personal inbox
- [ ] Test email delivery
- [ ] Set up auto-responder (optional)

### Phase 2: Marketplace Preparation (Week 2)

**Day 1-2: VS Code Marketplace Account**
- [ ] Register publisher account at https://marketplace.visualstudio.com/manage
- [ ] Choose publisher name: `simplebeacon`
- [ ] Complete publisher verification
- [ ] Claim extension ID

**Day 3-4: Screenshots and Assets**
- [ ] Capture 5 screenshots (1280x800px) following guide
- [ ] Review screenshots for quality and consistency
- [ ] Create featured image (1280x720px) if desired
- [ ] Prepare icon (already scaled to 128x128px)
- [ ] Organize assets in sales/marketplace/screenshots/

**Day 5: Extension Package**
- [ ] Update version number if needed
- [ ] Run `npm run build` in vscode-extension/
- [ ] Create VSIX package: `vsce package`
- [ ] Test package locally: `code --install-extension simplebeacon-*.vsix`
- [ ] Verify all features work

### Phase 3: Testing (Week 3)

**Day 1-2: End-to-End License Flow Test**
- [ ] Follow license flow test guide
- [ ] Complete test purchase in Stripe (use test mode first)
- [ ] Verify webhook delivery
- [ ] Confirm email with license token
- [ ] Test token activation in extension
- [ ] Verify Pro features unlock
- [ ] Test subscription management (if applicable)
- [ ] Document any issues and fix

**Day 3-4: Integration Testing**
- [ ] Test GitHub Action in real repository
- [ ] Verify gate enforcement works
- [ ] Test CLI scanner with various projects
- [ ] Test export report functionality
- [ ] Test full scan mode
- [ ] Verify all 38 rule engines work

**Day 5: Documentation**
- [ ] Deploy documentation site to production
- [ ] Verify all documentation links work
- [ ] Test getting started guide
- [ ] Verify troubleshooting section
- [ ] Add FAQ based on testing findings

### Phase 4: Launch (Week 4)

**Day 1: Marketplace Publish**
- [ ] Upload extension package to VSCode Marketplace
- [ ] Add screenshots with captions
- [ ] Add icon and featured image
- [ ] Copy polished description from sales/marketplace/description.md
- [ ] Set pricing (Free tier with Pro upgrade)
- [ ] Submit for review
- [ ] Wait for marketplace approval (usually 1-3 business days)

**Day 2-3: Monitoring Setup**
- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Configure analytics for extension usage
- [ ] Set up Stripe webhook monitoring
- [ ] Configure email delivery monitoring
- [ ] Set up uptime monitoring for API endpoints
- [ ] Test all monitoring alerts

**Day 4: Final Checks**
- [ ] Verify all environment variables are set correctly
- [ ] Test live purchase flow (small amount, refundable)
- [ ] Verify license token generation works
- [ ] Test email delivery in production
- [ ] Verify extension download and install works
- [ ] Test Pro tier activation
- [ ] Verify all documentation links work

**Day 5: Launch**
- [ ] Switch Stripe to live mode (if using test mode)
- [ ] Announce launch on social media
- [ ] Send launch email to waitlist (if exists)
- [ ] Publish launch blog post
- [ ] Monitor for issues and respond quickly
- [ ] Celebrate! 🎉

## Post-Launch Tasks

### Week 1-2: Support and Monitoring

- [ ] Monitor extension downloads and ratings
- [ ] Respond to marketplace reviews and issues
- [ ] Track Stripe payments and webhooks
- [ ] Monitor email delivery rates
- [ ] Fix any critical bugs immediately
- [ ] Gather user feedback

### Week 3-4: Iteration

- [ ] Analyze usage patterns
- [ ] Identify most common issues
- [ ] Plan feature improvements
- [ ] Update documentation based on feedback
- [ ] Consider pricing adjustments if needed

### Month 2-3: Growth

- [ ] Create case studies from early users
- [ ] Develop enterprise sales materials
- [ ] Explore partnerships
- [ ] Attend relevant conferences/meetups
- [ ] Write technical blog posts
- [ ] Build community around the product

## Risk Mitigation

### Technical Risks

**Risk:** Extension fails marketplace validation
- **Mitigation:** Test package locally before upload, follow all marketplace guidelines

**Risk:** Stripe webhooks fail
- **Mitigation:** Set up retry logic, monitor webhook delivery, have manual fallback

**Risk:** Email delivery fails
- **Mitigation:** Use reputable email service (Resend), monitor delivery rates, have backup SMTP

**Risk:** License token validation fails
- **Mitigation:** Thorough testing, clear error messages, support contact info

### Business Risks

**Risk:** Low adoption
- **Mitigation:** Focus on developer experience, create compelling content, leverage existing networks

**Risk:** Pricing too high/low
- **Mitigation:** Start with competitive pricing, be willing to adjust based on feedback

**Risk:** Support overwhelmed
- **Mitigation:** Clear documentation, FAQ, automated responses, prioritize critical issues

## Success Metrics

### Technical Metrics
- Extension downloads: 100+ in first month
- Active users: 50+ in first month
- License activation rate: 20%+ of downloads
- Webhook success rate: 95%+
- Email delivery rate: 95%+

### Business Metrics
- Revenue: $1,000+ in first month
- Customer satisfaction: 4.0+ star rating
- Support response time: <24 hours
- Churn rate: <10% monthly

## Contact Information

For questions about this launch plan:
- **Product:** simplebeacon
- **Support:** support@simplebeacon.com
- **GitHub:** https://github.com/tjp420/simplebeacon/issues

## Next Steps

1. Review this launch plan
2. Assign tasks to team members (if applicable)
3. Set timeline for each phase
4. Begin Phase 1: Foundation
5. Track progress and adjust as needed

---

**Last Updated:** 2026-06-09
**Status:** Ready for execution
