# SimpleBeacon Launch Kit

## One-liner

SimpleBeacon is a CI gate that catches AI-generated slop, mock metrics, and placeholder credentials in PRs — free for individuals, paid for teams that need org-wide history and dashboards.

## Problem / solution story

Vibe coding is fast, but the AI produces fake KPIs, placeholder URLs, and `console.log` blobs that slip into production. Code review is too late, and most security tools ignore the new class of AI artifacts.

SimpleBeacon runs in the PR, fails the gate on real problems, and gives the team an instant report. The free tier is zero-friction: add the GitHub Action, no token required. When the team needs unlimited history, multi-project dashboards, and team-wide policy, the Team license unlocks everything.

## Links

- Repo: https://github.com/tjp420/CascadeProjects
- Pricing: https://simplebeacon.ai/pricing
- NPM: https://www.npmjs.com/package/simplebeacon

## Reddit posts

### r/cursor

**Title:** I built a CI gate for vibe-coded PRs — it catches AI slop before it ships

**Body:**

I’m building SimpleBeacon, a gate that runs on every PR and blocks the AI-generated slop that code review usually misses: fake KPIs like `completion_rate: 98.5%`, placeholder URLs like `https://api.example.com/v1`, mock paths in production code, and leftover `console.log` / `sk-...` tokens.

It is free for personal use and open source projects. Add the GitHub Action and it starts commenting on PRs with zero setup or license token.

When your team needs shared configs, multi-repo dashboards, and enforceable policy, the Team license is $15/dev/mo.

Repo: https://github.com/tjp420/CascadeProjects
NPM: `npx simplebeacon scan --gate`

I’d love feedback on the rule set and the GitHub Action flow.

### r/vibecoding

**Title:** Free PR gate for AI-generated code — try it with no token

**Body:**

Vibe coding is great until a fake metric or placeholder API URL makes it to prod. I built SimpleBeacon to run as a GitHub Action on every PR and catch those artifacts before merge.

Zero friction: add the action, run `npx simplebeacon scan --gate`, and it comments the report on the PR. No account, no token, no upload required.

Paid Team tier unlocks the dashboard, multi-repo history, and custom policy.

Links and install in the repo: https://github.com/tjp420/CascadeProjects

Let me know what I should add next.

## First 10 teams playbook

1. Post the r/cursor thread and respond to comments quickly.
2. Cross-post to r/vibecoding the same day.
3. Share the repo in AI/LLM dev Discord servers and the Cursor Discord.
4. Pin a “Try it in your PR” issue with a one-click action snippet.
5. Reach out to 10 teams who are actively complaining about AI slop in public.
6. Offer a 14-day Team trial in exchange for a testimonial.
7. Convert the first 3 testimonials into a /customers page.

## GitHub Action snippet for posts

```yaml
- name: Run SimpleBeacon
  uses: tjp420/CascadeProjects/github-action@main
  with:
    license-token: ${{ secrets.SIMPLEBEACON_LICENSE_TOKEN }}
```

For the free tier, omit `license-token` entirely.
