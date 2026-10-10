# Multi-source release monitoring — v2.5.2 (develop)

All 91 catalog applications participate in the same 12-hour minimum source check window.
The queue contains 12 Craft projects, 79 independent projects, and one separate routine owner-directory discovery task.
No creator or project has a privileged polling cadence or skip-the-queue release check.

## Sources and precedence
- GitHub Atom public release feeds, with conditional ETag / Last-Modified requests by default.
- Verified GitLab and KDE Invent project release feeds where the project is officially maintained there.
- Codeberg and GitLab tag feeds, strictly informational (not necessarily published releases).
- A mirror tag never downgrades or replaces a previously validated release.

## Polling and throttling
- One queued task approximately every 20 seconds, process-local (92 tasks per complete round).
- Default due interval 12 hours; user may select 6 or 24 hours.
- Conditional HTTP requests, cached prior signals, and provider-specific backoff after 403/429.
- Force scan is a queued fair cycle with a 30-minute global cooldown, not a burst of API requests.
- GitHub API is reserved for bounded verification of a changed stable release: at most eight attempts per hour per local process.
- The owner-directory scan uses one ordinary task slot; it does not receive separate privileged priority.

## Trust boundary
- Data from any release feed or mirror does not directly alter allowed installer adapters.
- GitHub release API verification still requires official repository tag, platform allowlist and verified digest for installation.
- New project discovery never grants automatic installation permission.
- GitLab/Codeberg tags do not authorize updates or installer execution.

## Known limitations
- First full round lasts approximately 30 minutes; it is incremental and nonblocking.
- Each host has its own cache and budget, so machines do not yet share a server-side global cache.
- Current alternate mirror mappings cover explicitly verified projects, not an internet-wide untrusted auto-mirror index.
- Native wrapper binaries are unchanged; managed install E2E should be tested only in an isolated sandbox.
