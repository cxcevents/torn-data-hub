---
name: Torn API quirks
description: Non-obvious Torn (torn.com) API behaviors that affect log-based features
---

- The activity log endpoint (`selections=log`) returns at most ~100 entries per call across ALL log types. Multi-day history must paginate backwards with `to=` until the `from=` boundary is covered.
  - **Why:** older entries are silently missing otherwise; busy logs bury events beyond the 100-entry cap.
  - **How to apply:** log record IDs (object keys) are the unique identity — timestamps repeat within a second, so paginate with inclusive `to=oldest` plus ID-based dedupe (with a progress guard), never dedupe by timestamp. Keep full-history refetches infrequent: Torn allows ~100 req/min per key.
- Prefer server-side log-type filtering over pagination: `selections=log&log=<typeId>` (e.g. 2290 = "Item use xanax") makes the 100-entry cap apply only to that type. Discover a type id by reading the `log` field of a matching entry.
- Torn's daily reset runs on TCT = UTC. All "per day" counting (xanax/day, refills) must bucket by UTC dates, never the browser's local timezone, or counts disagree with Torn's own log view.
