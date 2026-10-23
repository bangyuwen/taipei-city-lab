# Repository guidance

- Topic models, data and research are maintained in `topics/`; shared UI source is in `shared/web/template/`. Rebuild generated site copies with `npm run build`.
- Frontend design work uses the shared Impeccable skill at `shared/skills/impeccable/SKILL.md`, discovered through `.agents/skills/impeccable`. Read its instructions only when the task calls for that skill.
- Product and design context lives in `shared/docs/`; standard tool paths are relative links to those sources. Keep the repository root as the working directory and name the actual target when using the skill.
- Shared-template visual rules apply to the integrated site and its six generated topic sites. Preserve the existing design and navigation of `sites/taipei-waste-lab/` when working on that separate site.
- After extracting the portable source package, run `npm run setup-skills` to create discovery links. Validate them with `python scripts/setup-skills.py --check`.
- Keep runtime binaries, generated QA, screenshots and extra Git backups out of version control. Preserve third-party skill licenses and notices.

## Youtong deployment destinations

- Production is `https://youtong.bangyuwen.chatgpt.site`; test is `https://taipei-waste-lab.bangyuwen.chatgpt.site`. Do not describe a test deployment or test-site verification as production.
- Before any Sites source push, version save, or deployment, read `sites/taipei-waste-lab/deploy/production.json` and `sites/taipei-waste-lab/docs/production-deployment.md` from current remote `main`. Match the requested environment, URL, and exact project ID against Sites `get_site`. Do not infer the destination from the checkout name, an open browser tab, or old instructions. If these files are missing in an older checkout, retrieve them from current remote `main`; do not substitute another destination.
- `sites/taipei-waste-lab/.openai/hosting.json` identifies the **test** Site. Production identity comes from `deploy/production.json`. Preserve the selected Site's audience.
- Production requires a clean checkout equal to current remote `main`, successful latest main-push **Topic sites** CI, and the canonical `scripts/prepare-production.py` gate run from `sites/taipei-waste-lab/`. Follow the deployment document for packaging and publication. Recheck `main` before deployment; skip an unchanged release and never publish an older revision over a newer one.
- After production deployment, verify its live `/release.json` against the prepared source commit and file hashes, then open the affected pages on the **production URL**. GitHub CI success alone is not deployment evidence; the Codex publication heartbeat is a separate mechanism whose current operation must be verified before claiming automatic deployment.
