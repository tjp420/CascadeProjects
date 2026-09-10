# Deliberately vulnerable XSS fixture (Track 2 Slice 6)

**Purpose:** End-to-end proof that SimpleBeacon can promote to **Verified** from real repository source with an independently reproducible audit trail.

**Not for production.** Do not copy into customer paths.

## Intentional chain

`req.body.comment` → `renderMarkdown()` → `element.innerHTML` (no sanitizer)

## Negative controls

Open WebUI / Gitea / Immich golden evidence fixtures must remain **0 Verified**.

## Outreach

**OFF** — this fixture does not authorize maintainer contact.
