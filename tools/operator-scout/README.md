# Challenger Operator Scout

**Private operator workflow.** This is an explicit, local CLI for the owner of Challenger Hub. It is NOT part of the public Explore interface, is not bundled into the EXE, does not run on app launch, has no daemon or scheduled task, and does not change the 181-project Preview 10 catalog.

## Purpose

Find young, independent challengers rather than familiar flagship apps. The first working source is **authenticated GitHub repository search** using the user's existing gh login: a dozen focused creative, local-first, AI-native, agentic, CAD, video, image, music and office discovery searches. Search by creation date rather than all-time stars. The ranking rewards recent creation, current maintenance, compact teams' early traction, product signals and developer activity. It penalizes stale/famous/library-only repositories. It excludes existing Challenger projects and the 15 Preview 10 candidates.

Do NOT describe any repo as "built with AI" based on topics/README alone. AI-native claims are hypotheses requiring manual verification; exact platforms, product quality, licensing, download packages and dependencies must also be checked. Search output is a **research queue only**.

## Run on Chris Windows

From the repo checkout:

    node tools/operator-scout/scout.cjs --months 12 --limit 35

It reads public GitHub search metadata via gh api using the **existing authenticated CLI**. There is no paid API, new token, browser automation or install operation. GitHub rate limits apply. The tool reports each query's outcome and exposes any query failures.

By default it writes one private Markdown review report and one JSON report under:

    %LOCALAPPDATA%\ChallengerOperator\Scout\

Override with --out "C:\absolute\private\folder" (never a directory within the public repo). Other controls: --months 1..24, --per-query 1..30, --limit 1..100, and --fixture path for offline inspection. Nothing is uploaded to GitHub or Google Drive automatically.

## Test

    node --test tools/operator-scout/scout.test.cjs

## Review before any catalog update

Check the actual product/demo and practical differentiation; verify project identity and the latest upstream source; confirm license, OS, real binaries/releases and potential paid API dependence. Approve a catalog entry manually with separate provenance. **Adding a source entry must never grant an installer adapter.**

This tool intentionally has no dashboard, automated approval, background polling, public route or dependency on the app's frontend.
