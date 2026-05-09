# Pax Dei Archives Quart Migration Plan

## Goal

Move Pax Dei Archives from GitHub Pages to a Quart/Jinja application hosted behind the existing Cloudflared tunnel, while continuing to use Supabase for authentication and data.

The primary migration target is removing the static GitHub Pages hosting layer and moving the site as a whole to a backend-rendered app. Server-rendered metadata for share previews is an important benefit, but publications are not the only reason for the migration.

## Guiding Principles

- Run the GitHub Pages site and the new Quart site in parallel until the Quart site reaches parity.
- Keep Supabase authentication as-is during and after the migration.
- Keep Supabase as the primary database and core data layer.
- Keep browser-side Supabase reads/writes where they already work.
- Keep admin/editor writes browser-side unless a future security or validation need changes that decision.
- Prefer clean canonical routes for the new site.
- Prefer migrating directly to clean canonical routes instead of carrying old `.html` URLs forward.
- Treat old URL redirects as optional, short-term convenience routes only when they prevent a known problem.
- Migrate page-by-page instead of doing one large rewrite.
- Use server-rendered Jinja layout pieces for header, footer, and metadata.
- Make best-practice route/path updates during migration when they are low-risk.
- Move toward cleaner backend static paths instead of keeping `frontend/www/` permanently.

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

Target asset paths should eventually become:

```text
/static/css/
/static/js/
/static/assets/
```

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

- Add the new tunnel domain to allowed site URLs. The likely placeholder domain is `archives.yesitsphoenix.dev`, but the final domain is not yet locked.
- Add the new tunnel domain callback URL for Discord OAuth.
- Keep GitHub Pages URLs during the parallel run.

## Migration Phases

### Phase 1: Quart Foundation

Create the backend app without changing the public GitHub Pages site. This phase is focused on establishing the whole-site foundation, not a publications-only proof of concept.

- [ ] Add Quart project dependencies and startup instructions.
- [ ] Create `app/main.py`.
- [ ] Add `/healthz` route.
- [ ] Mount existing static folders for transition.
- [ ] Add the intended `/static/...` structure.
- [ ] Define how old `frontend/www/...` asset references will migrate to `/static/...`.
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

### Phase 3: Core Page Migration

Migrate the core user-facing page shells into Quart/Jinja so the backend represents the site as a whole.

- [ ] Convert `index.html` into `templates/pages/home.html`.
- [ ] Replace static `index` language with canonical `home` naming internally.
- [ ] Keep current recent comments/news JavaScript behavior.
- [ ] Add server-rendered home metadata.
- [ ] Verify quick links point to canonical backend routes.
- [ ] Create backend routes and Jinja shells for `publications`, `publication archive`, `lore`, and `quests`.
- [ ] Confirm the core navigation works across backend-rendered pages.
- [ ] Confirm existing client-side Supabase rendering still works on migrated pages.

### Phase 4: Publications Metadata

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

- [ ] Keep generated publication and quest files until backend routes are validated.
- [ ] Remove publication share-page generator after backend issue routes are validated.
- [ ] Remove or archive generated `publications/issue-*.html` files after validation.
- [ ] Remove or archive generated quest HTML files after validation.
- [ ] Replace root-relative GitHub Pages URLs with backend canonical URLs.
- [ ] Add canonical tags to migrated pages.
- [ ] Add only intentional temporary redirects for known high-value old URLs.
- [ ] Update Discord/community links to the new domain.
- [ ] Leave GitHub Pages alone during migration.
- [ ] Replace GitHub Pages with a site-moved page only after all validations are complete.

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

1. Build Quart foundation and static serving.
2. Establish clean route and asset conventions.
3. Convert header/footer to Jinja partials.
4. Migrate the home route and core page shells.
5. Deploy behind Cloudflared on the temporary/test hostname.
6. Migrate publication metadata and issue routes.
7. Continue page-by-page migration.
8. Validate whole-site parity before cutover.

## Open Decisions

- [ ] Final tunnel domain name. Current working assumption: `archives.yesitsphoenix.dev`.
- [ ] Whether any specific old `.html` URLs need temporary redirects after cutover.
- [ ] Exact timing for removing generated publication and quest share files after backend validation.
