# Pax Dei Archives

This project is being refactored to focus more on Lore and information instead of resource tracking/database.

Welcome to the Pax Dei Archives! This is a basic website I put together to document items, mobs, maps, skills, magic, and more.
Please do not consider this a full/complete project, it's a proof-of-concept for ideas I had while testing. 

I'm by no means a web developer and barely a programmer. Most of my dev time is spent on Discord-based Bot projects. I used this project to push me out of my comfort zone.

Pax Dei Archives - 2025 Phoenix

## Publication Discord Embeds

Discord reads static Open Graph meta tags before the publication page JavaScript loads Supabase content. After publishing an issue in the Publication Editor, generate static share pages before posting publication links to Discord:

```bash
python3 scripts/generate_publication_pages.py
```

This creates one generated HTML file in `publications/` for each published issue. Each issue page combines the saved entries into a short Discord-friendly summary. Share those generated issue URLs in Discord, for example:

```text
https://yesitsphoenix.github.io/Pax-Dei-Archives/publications/issue-24.html
```

To regenerate only one issue:

```bash
python3 scripts/generate_publication_pages.py --issue 24
```

The script only rewrites an issue page when the generated HTML actually changes. Use `--prune` if you want to remove generated issue pages that no longer match published Supabase issues.
