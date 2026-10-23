# Production and test publication

- Production: [youtong](https://youtong.bangyuwen.chatgpt.site), identity in `deploy/production.json`.
- Test: [taipei-waste-lab](https://taipei-waste-lab.bangyuwen.chatgpt.site), existing `.openai/hosting.json`.
- Both use the same portal, research and browser-local demonstration. A production URL does not turn demonstration data into an operational service.

Only clean content equal to the current remote `bangyuwen/taipei-city-lab` **main** may reach production. Never publish a feature-branch delta, dirty checkout, or the independently edited test Site source as production. Detached checkouts of the exact main commit are valid. The latest main-push **Topic sites** CI for that exact commit must succeed; that workflow includes the research and demo tests. No credentials belong in Git, files or automation prompts.

## Prepare and publish

1. Fetch GitHub main into an isolated checkout. Preserve shared dirty worktrees. Use Python 3.12+ and Node 22+ with authenticated GitHub CLI.
2. Read production `/release.json`. If its `commit_sha` equals remote main, stop without publishing. If main is newer, wait for its latest main-push Topic sites CI to pass. Never redeploy an older commit over a newer publication.
3. Run `python scripts/prepare-production.py --output /absolute/new-release-directory` from the site. It verifies origin, exact remote main, clean state and CI; rebuilds, tests and checks the site; rechecks main; exports only the public runtime and a release receipt. A missing, failed or pending gate stops publication.
4. Follow the Sites skill: get the production Site and a fresh source credential, open its source with the supported helper, replace only the previous `out/` and `release.json` with the prepared export, and retain the returned production manifest. Inspect the file list and hashes against the receipt. Never copy private research inputs into `out/`.
5. Immediately before packaging/deployment, recheck GitHub main against the receipt. If it moved, discard this publication attempt and prepare from the new head. Use the Sites helper to push/package the exact production source, then save/deploy that saved version to the production project. Preserve the public audience. Continue an existing deployment after an uncertain result rather than creating duplicates.
6. Confirm deployment success and read live `/release.json`; its source commit and file hashes must match the prepared receipt. Verify `/research/#persona-crew`, `/research/#plan-crew-research`, and `/demo/` after a relevant content change. The source receipt names the GitHub commit; Sites also records its separate source-mirror commit.

## Automatic updates

A Codex thread heartbeat checks main every five minutes. This is polling, not a GitHub webhook, and depends on the local Codex host and its connected tools being available. It runs the procedure above, skips unchanged releases, and reports a failed gate without publishing. PR and feature-branch activity does not trigger a production release. If several merges arrive before one check, publish the newest eligible main head; never replay stale intermediate releases.

The heartbeat is managed in Codex, not by the GitHub validation workflows. GitHub workflows remain validation only. Native Sites access remains owner-controlled; this procedure is the repository publication gate, not a claim that Sites itself restricts owner actions by GitHub branch. Editing or direct-publishing the production Site outside this procedure violates the deployment contract.
