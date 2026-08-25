# Hacker News Launch — First 60 Minutes Monitoring Cadence

**For:** Founder + 1 support person (if available)
**Goal:** Maximize engagement, respond to every comment within 15 minutes, reach front page
**Prerequisite:** Pre-launch verification script passed (`node marketing/outreach/pre-launch-verify.js`)

---

## Pre-Launch Setup (T-30 min)

### Environment

- [ ] Open 3 browser tabs:
  1. HN post page (refresh after posting to see comments)
  2. HN "new" page (https://news.ycombinator.com/newest) to verify post is live
  3. Analytics dashboard (Google Analytics / Plausible / Vercel Analytics)
- [ ] Open terminal with `watch` on install metrics:
  ```bash
  # Check npm download count every 60 seconds
  while true; do curl -s "https://api.npmjs.org/downloads/point/last-day/simplebeacon" | jq -r '.downloads'; sleep 60; done
  ```
- [ ] Open Twitter/X with a drafted thread ready to post
- [ ] Phone on Do Not Disturb (except for the support person)
- [ ] Slack/Discord notifications silenced
- [ ] Have the 8 prepared HN Q&A answers open in a document for quick copy-paste
- [ ] Have the procurement Q&A edge cases open for technical questions

### Communication

- [ ] If 2 people: Founder monitors HN comments, support person monitors Twitter/analytics
- [ ] If solo: Focus on HN comments first, check analytics every 15 minutes

---

## Minute-by-Minute Cadence

### T+0:00 — Post to HN

- [ ] Submit post to https://news.ycombinator.com/submit
- [ ] Copy the post URL
- [ ] Verify post appears on https://news.ycombinator.com/newest within 60 seconds
- [ ] Post Twitter/X thread: "Just launched on Show HN: SimpleBeacon — 100% offline scanner that catches AI slop and credential leaks. [link]"
- [ ] Share in 2-3 Discord/Slack communities (dev tools, AI, security)

### T+0:05 — First Check

- [ ] Refresh HN post page — check for first comments
- [ ] Check HN "new" page — verify post is visible
- [ ] If no comments yet: normal. First comments typically arrive at 10-15 min.
- [ ] Check analytics for initial traffic spike

### T+0:10 — Early Engagement

- [ ] Refresh HN post — check for comments
- [ ] If comments exist: respond to each one immediately (see response rules below)
- [ ] Check upvote count (visible on HN post page)
- [ ] Email warm contacts: "We just launched on HN — would appreciate an upvote if you find it interesting: [link]"
- [ ] Check analytics: traffic should be starting

### T+0:15 — First Response Window

- [ ] By now, first comments likely appearing
- [ ] **Respond to every comment within 15 minutes of it being posted**
- [ ] Track which questions match the prepared Q&A — use prepared answers
- [ ] For novel questions: take 2 minutes to write a thoughtful, technical response
- [ ] Check upvote trajectory: if on "new" page with 3+ points, on track

### T+0:20 — Momentum Check

- [ ] Check HN ranking: is the post moving up on "new"?
- [ ] Check analytics: traffic should be 50-100 visits by now
- [ ] Check npm downloads: should see first installs
- [ ] Respond to any new comments
- [ ] If traffic is low: share in 2 more communities

### T+0:30 — Front Page Check

- [ ] Check if post has reached the front page (https://news.ycombinator.com/)
- [ ] If on front page: prepare for comment volume increase
- [ ] If not on front page: check point count (need ~10-15 points for front page)
- [ ] Respond to all new comments
- [ ] Check analytics: if on front page, traffic should be 200-500 visits

### T+0:40 — Engagement Sprint

- [ ] Respond to all new comments (priority over everything else)
- [ ] Check for "flagged" or "dead" status on the post
- [ ] If someone found a bug: acknowledge publicly, fix immediately if possible
- [ ] Post a "thank you + technical deep dive" comment if on front page:
  > "Thanks for the engagement everyone. A few clarifications based on questions so far: [summarize key points]. Happy to go deeper on any of these."

### T+0:50 — Second Wind

- [ ] Respond to all new comments
- [ ] Check analytics: traffic, npm installs, GitHub stars
- [ ] Take screenshots of HN post for marketing use (points, comment count)
- [ ] If on front page: share screenshot on Twitter: "We're on the front page of HN! [screenshot]"

### T+1:00 — Hour One Assessment

- [ ] **Assess: Is this going well?**
  - Front page? → Continue monitoring for 4 more hours
  - Not front page but 10+ comments? → Continue, still valuable
  - < 5 points and < 3 comments? → Post in Reddit and Twitter instead, don't force HN
- [ ] Log all metrics for the hour:
  - HN points
  - HN comment count
  - Website visits
  - npm installs
  - GitHub stars
  - VS Code installs (check marketplace)
- [ ] Respond to all remaining comments
- [ ] Plan next 4 hours of monitoring

---

## Comment Response Rules

### Speed

- **First 60 minutes:** Respond within 15 minutes of each comment
- **Hours 1-4:** Respond within 30 minutes
- **Hours 4-24:** Respond within 2 hours
- **After 24 hours:** Respond within 24 hours

### Tone

- **Technical, not promotional** — HN downvotes marketing speak
- **Acknowledge valid criticism** — "Good point. We handle this by..."
- **Be honest about limitations** — "SSO is on the roadmap, not yet implemented"
- **Don't get defensive** — if someone says it's slow, explain the tradeoff
- **Share verified numbers only** — 48 analyzers, 67 files/sec, 6,000 files in 89s

### Response Templates

| Comment Type                         | Response Approach                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "How is this different from X?"      | Use prepared Q&A #1, adapted to the specific tool mentioned                                                                                                     |
| "Why not just use grep?"             | Use prepared Q&A #2                                                                                                                                             |
| "This is slow"                       | "It's local I/O bound, not CPU. 6,000 files in 89s on local hardware. --diff-only for CI brings it to seconds."                                                 |
| "Your pricing is too high"           | "Free tier is genuinely usable: 9,999 scans, 50 files/scan. Paid starts at $49/mo for unlimited."                                                               |
| "Your pricing is too low"            | "We wanted to make it accessible for indie devs. Enterprise is custom-priced."                                                                                  |
| "Is the code open?"                  | Use prepared Q&A #3                                                                                                                                             |
| "EU AI Act claims?"                  | Use prepared Q&A #5                                                                                                                                             |
| "Found a bug"                        | "Thanks for catching this. Filed as [issue link]. Fixing now."                                                                                                  |
| "This is just a wrapper around grep" | "The rules are regex-based, yes — you can inspect all 50 in src/rules/. The value is the curated taxonomy, CI gate, VS Code extension, and compliance mapping." |
| "Self-promotion much?"               | Don't respond. HN allows self-promotion in Show HN.                                                                                                             |

### What NOT to Do

- Don't argue with anyone
- Don't downvote critical comments
- Don't post multiple comments in a row (edit your existing comment instead)
- Don't use the word "exciting" or "revolutionary"
- Don't claim features that don't exist (SSO, Docker, SOC 2 certification)
- Don't compare yourself to competitors unfavorably
- Don't ask for upvotes (against HN guidelines)

---

## Escalation Triggers

| Trigger                                    | Action                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Post flagged/dead on HN                    | Don't repost. Share on Twitter and Reddit instead.                |
| Negative comment dominates thread          | Engage honestly, fix the issue, don't get defensive.              |
| Site goes down                             | Check Cloudflare status. Have static cache as fallback.           |
| Real security issue found                  | Acknowledge publicly, fix immediately, publish security advisory. |
| npm install fails for users                | Pin working version, publish fix within 2 hours.                  |
| Someone finds stale claim in CLI           | Acknowledge, fix immediately, push new npm version.               |
| Comment volume > 50                        | Prioritize technical questions over casual comments.              |
| Front page but can't keep up with comments | Focus on the top 10 most upvoted comments.                        |

---

## Metrics Tracking Template

```
HN Launch Metrics — [DATE]
═══════════════════════════════════════════════════════════

T+0:00  | Points: 0  | Comments: 0  | Visits: 0    | npm: 0    | Stars: 0
T+0:15  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+0:30  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+0:45  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+1:00  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+2:00  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+4:00  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+8:00  | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___
T+24:00 | Points: __ | Comments: __ | Visits: ___  | npm: ___  | Stars: ___

Front page reached at: T+___
Peak position: #___
Total comments responded to: ___
Bugs found by community: ___
Bugs fixed: ___
```

---

## Post-Launch (T+24 hours)

- [ ] Write a summary blog post: "What we learned from launching on HN"
- [ ] Share metrics on Twitter: "24 hours after our HN launch: [X] points, [Y] comments, [Z] installs, [W] GitHub stars"
- [ ] Review all comments for feature requests and bug reports
- [ ] File issues for any bugs found by the community
- [ ] Update the HN post with a "24-hour update" comment if there were significant changes
- [ ] Prepare for Product Hunt launch (T+7 days)
