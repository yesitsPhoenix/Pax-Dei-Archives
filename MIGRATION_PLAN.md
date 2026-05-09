# Pax Dei Archives Quart Migration Plan

## Goal

Move Pax Dei Archives from GitHub Pages to a Quart/Jinja application hosted behind the existing Cloudflared tunnel, while continuing to use Supabase for authentication and data.

The first migration target is removing the static GitHub Pages layer so pages can render dynamic metadata server-side. This solves Discord embeds for commonly shared URLs such as `/publications`.

## Guiding Principles

- Run the GitHub Pages site and the new Quart site in parallel until the Quart site reaches parity.
- Keep Supabase authentication as-is during the first migration pass.
- Keep browser-side Supabase reads/writes where they already work unless there is a clear reason to move them server-side.
- Prefer clean canonical routes for the new site.
- Prefer migrating directly to clean canonical routes instead of carrying old `.html` URLs forward.
- Treat old URL redirects as optional, short-term convenience routes only when they prevent a known problem.
- Migrate page-by-page instead of doing one large rewrite.
- Use server-rendered Jinja layout pieces for header, footer, and metadata.
- Make best-practice route/path updates during migration when they are low-risk.

## Proposed Canonical Routes

| Current Route | New Canonical Route | Migration Behavior |
| --- | --- | --- |
| `/index.html` | `/` | Migrate internal links to `/`; optional temporary redirect only if needed |
| `/publications.html` | `/publications` | Migrate directly to `/publications` |
| `/publication_archive.html` | `/publications/archive` | Migrate directly to `/publications/archive` |
| Generated `/publications/issue-XX.html` | `/publications/issue/<issue_number>` | Retire generated files after backend route works |
| `/lore.html` | `/lore` | Migrate directly to `/lore` |
| `/quests.html` | `/quests` | Migrate directly to `/quests` |
| `/quests/<quest>.html` | `/quests/<quest>` | Retire generated files after backend route works |

## Target Backend Shape

```text
app/
  __init__.py
  main.py
  config.py
  supabase_client.py
  seo.py
  routes/
    home.py
    publications.py
    lore.py
    quests.py
    static_pages.py
  templates/
    base.html
    partials/
      header.html
      footer.html
      auth_modal.html
    pages/
      home.html
      publications.html
      publication_archive.html
  static/
```

During the first pass, continue serving existing assets from:

```text
frontend/www/css/
frontend/www/js/
frontend/www/assets/
```

Those paths can be normalized later after the backend is stable.

## Environment

Expected runtime:

```bash
hypercorn app.main:app --bind 127.0.0.1:8080
```

Cloudflared public hostname points to:

```text
http://127.0.0.1:8080
```

Initial environment variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SITE_BASE_URL
QUART_ENV
```

Supabase dashboard updates needed:

- Add the new tunnel domain to allowed site URLs.
- Add the new tunnel domain callback URL for Discord OAuth.
- Keep GitHub Pages URLs during the parallel run.

## Migration Phases

### Phase 1: Quart Shell

Create the backend app without changing the public GitHub Pages site.

- [ ] Add Quart project dependencies and startup instructions.
- [ ] Create `app/main.py`.
- [ ] Add `/healthz` route.
- [ ] Mount existing static folders.
- [ ] Add basic `base.html`.
- [ ] Add Jinja partials for header, footer, and auth modal.
- [ ] Serve `/` as the new home route.
- [ ] Migrate backend links to `/` instead of `/index.html`.
- [ ] Decide whether `/index.html` gets a temporary redirect or is intentionally left behind.
- [ ] Confirm Cloudflared can reach the local Quart app.

### Phase 2: Shared Layout

Move shared browser-loaded fragments into server-rendered Jinja includes.

- [ ] Convert `frontend/www/templates/header_template.html` into `templates/partials/header.html`.
- [ ] Convert `frontend/www/templates/footer_template.html` into `templates/partials/footer.html`.
- [ ] Preserve dynamic auth/admin nav behavior that still depends on browser-side Supabase auth.
- [ ] Remove backend-page dependency on `loadHeader.js`.
- [ ] Remove backend-page dependency on `loadFooter.js`.
- [ ] Confirm mobile nav, dropdowns, and floating auth avatar still work.

### Phase 3: Publications First

Solve the Discord embed issue early.

- [ ] Add `app/routes/publications.py`.
- [ ] Add server-side Supabase publication fetch helper.
- [ ] Render `/publications` with latest issue metadata.
- [ ] Render `/publications/archive`.
- [ ] Render `/publications/issue/<issue_number>`.
- [ ] Generate Open Graph and Twitter tags server-side.
- [ ] Preserve existing frontend publication UI behavior during hydration.
- [ ] Migrate publication links to `/publications`.
- [ ] Migrate archive links to `/publications/archive`.
- [ ] Remove generated `publications/issue-XX.html` files after backend issue routes replace them.
- [ ] Test Discord embeds for `/publications` and `/publications/issue/<issue_number>`.

### Phase 4: Home Page

Migrate the home page and clean up route naming.

- [ ] Convert `index.html` into `templates/pages/home.html`.
- [ ] Replace static `index` language with canonical `home` naming internally.
- [ ] Keep current recent comments/news JavaScript behavior.
- [ ] Add server-rendered home metadata.
- [ ] Verify quick links point to canonical backend routes.

### Phase 5: Lore

Move lore pages behind server routes while keeping Supabase-backed client rendering initially.

- [ ] Add `/lore`.
- [ ] Add `/lore/<category>`.
- [ ] Add `/lore/<category>/<slug>`.
- [ ] Render item-specific metadata server-side for share previews.
- [ ] Update internal lore links to canonical backend routes.
- [ ] Decide whether any high-value old lore links deserve temporary redirects.

### Phase 6: Quests

Replace generated static quest share pages with backend-rendered quest routes.

- [ ] Add `/quests`.
- [ ] Add `/quests/<quest_key>`.
- [ ] Render quest-specific metadata server-side.
- [ ] Update internal quest links to canonical backend routes.
- [ ] Replace or retire `quests.py` static generator.
- [ ] Verify Discord previews for quest routes.

### Phase 7: Remaining Pages

Migrate remaining static shells page-by-page.

- [ ] `developer-comments.html`
- [ ] `abilities.html`
- [ ] `gems.html`
- [ ] `grace.html`
- [ ] `gathering.html`
- [ ] `runs.html`
- [ ] `ledger.html`
- [ ] `listings.html`
- [ ] `trends.html`
- [ ] `map.html`
- [ ] `profile.html`
- [ ] `contracts.html`
- [ ] `post_contract.html`
- [ ] `chronicles.html`
- [ ] `panel.html`
- [ ] `edit_quest.html`
- [ ] `edit_lore.html`
- [ ] `publication_editor.html`
- [ ] `admin.html`
- [ ] Other legacy/static pages as needed.

### Phase 8: Auth And Redirect Review

Keep Supabase auth, but remove GitHub Pages assumptions.

- [ ] Audit OAuth `redirectTo` values.
- [ ] Remove `/Pax-Dei-Archives` path assumptions from frontend auth code.
- [ ] Confirm login/logout flows on new tunnel domain.
- [ ] Confirm admin role checks still work.
- [ ] Confirm publication editor permissions still work.
- [ ] Confirm profile and market tools still work.

### Phase 9: Cleanup And Cutover

Once the backend site has parity, clean up static-hosting workarounds.

- [ ] Remove publication share-page generator if backend issue routes replace it.
- [ ] Remove or archive generated `publications/issue-*.html` files.
- [ ] Remove or archive generated quest HTML files if backend quest routes replace them.
- [ ] Replace root-relative GitHub Pages URLs with backend canonical URLs.
- [ ] Add canonical tags to migrated pages.
- [ ] Add only intentional temporary redirects for known high-value old URLs.
- [ ] Update Discord/community links to the new domain.
- [ ] Decide whether GitHub Pages becomes a redirect-only fallback.

## Testing Checklist

- [ ] `/healthz` returns OK.
- [ ] Static CSS loads.
- [ ] Static JS loads.
- [ ] Images load.
- [ ] Header navigation works.
- [ ] Footer clock works.
- [ ] Supabase login works.
- [ ] Supabase logout works.
- [ ] Admin-only navigation still hides/shows correctly.
- [ ] `/publications` shows latest issue.
- [ ] `/publications` has latest issue Open Graph tags in raw HTML.
- [ ] `/publications/issue/<issue_number>` has issue-specific Open Graph tags in raw HTML.
- [ ] Discord preview works for `/publications`.
- [ ] Discord preview works for `/publications/issue/<issue_number>`.
- [ ] Canonical backend routes work without relying on `.html` URLs.
- [ ] Existing GitHub Pages site remains available during migration.

## Initial Implementation Order

1. Build Quart shell and static serving.
2. Convert header/footer to Jinja partials.
3. Migrate publications and server-render metadata.
4. Deploy behind Cloudflared on a test hostname.
5. Test Discord embeds.
6. Migrate home route.
7. Continue page-by-page migration.

## Open Decisions

- [ ] Final tunnel domain name.
- [ ] Whether GitHub Pages should redirect to the new domain after cutover.
- [ ] Whether admin/publication writes should eventually move behind backend APIs.
- [ ] Whether any specific old `.html` URLs need temporary redirects after cutover.
- [ ] Whether frontend assets should remain under `frontend/www/` or move into `app/static/`.
