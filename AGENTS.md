# Repository guidance

- Topic models, data and research are maintained in `topics/`; shared UI source is in `shared/web/template/`. Rebuild generated site copies with `npm run build`.
- Frontend design work uses the shared Impeccable skill at `shared/skills/impeccable/SKILL.md`, discovered through `.agents/skills/impeccable`. Read its instructions only when the task calls for that skill.
- Product and design context lives in `shared/docs/`; standard tool paths are relative links to those sources. Keep the repository root as the working directory and name the actual target when using the skill.
- Shared-template visual rules apply to the integrated site and its six generated topic sites. Preserve the existing design and navigation of `sites/taipei-waste-lab/` when working on that separate site.
- After extracting the portable source package, run `npm run setup-skills` to create discovery links. Validate them with `python scripts/setup-skills.py --check`.
- Keep runtime binaries, generated QA, screenshots and extra Git backups out of version control. Preserve third-party skill licenses and notices.
