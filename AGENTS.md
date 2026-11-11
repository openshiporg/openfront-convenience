NEVER build outbox/texting/email notification machinery or cron/worker services. External events = Openfront Commerce webhooks (features/webhooks) only.

Time-based state is computed on read, advanced idempotently on the request that touches it, or advanced by a staff button (operational alerts: Exceptions > "Evaluate now"). No setInterval/setTimeout loops, cron services or workers.
