# Auto-update (pull + restart on new release)

The production box runs `docker-compose.prod.yml` with `IMAGE_TAG=latest`, which
tracks the newest image pushed to GHCR on merge to `main`. This doc describes a
small **host-side script + scheduled job** that periodically pulls that tag and
restarts the container only when the image has actually changed.

This is deliberately not a Watchtower container — it keeps the Docker socket out
of any container and lives entirely on the host, which suits the LAN-only
Synology NAS. The trade-off: `IMAGE_TAG` must stay a moving tag (`latest`). If
you pin to a `sha-`/semver tag for a reproducible deploy, the tag never moves and
this script will (correctly) never update it.

## The script

The script is tracked in this repo as [`auto-update.sh`](auto-update.sh). Copy it
to the prod box next to the compose file — e.g.
`/volume1/docker/padelerodouleies/auto-update.sh` — and make it executable
(`chmod +x auto-update.sh`).

What it does:

1. Computes the image ref from the compose file (so it respects `IMAGE_TAG`/`.env`).
2. Records the local image ID, `docker compose pull`s, then re-reads the ID.
3. If the ID changed, `docker compose up -d` recreates the container (volumes and
   env preserved) and prunes the old dangling image. If nothing changed it logs a
   one-line no-op and exits.

Adjust `COMPOSE_DIR`, `COMPOSE_FILE`, and the `LOG` path to match the box. On
Synology, the compose project usually lives under `/volume1/docker/...`.

## Scheduling it

### Synology DS220+ (DSM)

The DS220+ ships **no `crontab` utility**, so add the job by editing `/etc/crontab`
directly (as root over SSH) and reloading the cron daemon. The Synology crontab
format has a **7-field** layout — the usual five time fields, then a `user`
column, then the command — and the fields **must be tab-separated** (spaces
silently break the entry):

```cron
#minute	hour	mday	month	wday	who	command
0	4	*	*	*	root	/volume1/docker/padelerodouleies/auto-update.sh
```

That runs the script daily at 04:00 — a quiet hour, so a restart never lands while
a kid is mid-exercise. For faster pickup use `*/5` in the minute field instead.

Reload `crond` so it picks up the change:

```bash
sudo synosystemctl restart crond   # DSM 7 (DS220+)
# DSM 6: sudo synoservicectl --reload crond
```

Note: DSM may rewrite `/etc/crontab` on a major DSM upgrade — re-check the entry
afterwards.

### Plain cron (non-Synology host)

```cron
# Check for a new image every 5 minutes
*/5 * * * * /volume1/docker/padelerodouleies/auto-update.sh

# …or once a day at 04:00 (quieter — restart won't interrupt active use)
# 0 4 * * * /volume1/docker/padelerodouleies/auto-update.sh
```

## Operating it

- **Watch the log:** `tail -f /volume1/docker/padelerodouleies/auto-update.log`
- **Force an update now:** run the script by hand — same effect as the scheduled run.
- **Pause auto-updates / pin a version:** set `IMAGE_TAG=sha-<...>` (or a semver
  tag) in `.env`. The script then tracks that fixed tag and stops auto-updating
  until you move it back to `latest`.
- **Roll back:** set `IMAGE_TAG` to a known-good `sha-`/semver tag in `.env` and
  run `docker compose -f docker-compose.prod.yml up -d`.

See the **Versioning** and **CI/CD** sections of `CLAUDE.md` for how image tags
are produced.
