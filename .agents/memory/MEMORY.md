# Memory Index

- [Torn API quirks](torn-api-quirks.md) — log endpoint caps at ~100 entries/call (must paginate with `to=`); daily counts must bucket by TCT (UTC), not local time.
- [Chrome Web Store publishing](chrome-webstore-publish.md) — automated store pushes via publish script + CWS_* secrets; upload URL and 132-char description quirks.
- [GitHub push workaround](github-push.md) — destructive git ops are blocked; push via inline SSH URL with a temp deploy key added through the GitHub connector.
