# Lore-Bot — How It Works & Keeping It Updated

## Architecture Overview

The lore-bot is a Python FastAPI server (`server.py`) that acts as middleware between the frontend chat UI and a local Ollama LLM instance.

**Request flow:** `lore-chat.html` → `loreChat.js` → `lore-bot server` → `Ollama (qwen2.5:7b)`

---

## Data Source — Supabase `lore_items` Table

On startup, the server fetches all rows from the `lore_items` table via the Supabase REST API. It pulls `title`, `slug`, `category`, `author`, `date`, and `content` fields, ordered by `category.asc, sort_order.asc, title.asc`.

> **Note:** `backend/data/lore-index.json` is a separate frontend concern and is **not** read by the bot. The bot reads directly from the database.

---

## Search Modes

**RAG mode (default — `USE_RAG = True`)**
When a question comes in, a TF-IDF search index finds the 7 most relevant lore entries and injects only those into the prompt. Faster and more accurate.

**Full corpus mode (`USE_RAG = False`)**
Sends every lore entry with every request. Much heavier — requires `num_ctx = 32768`.

---

## Prompt & Citations

The bot operates as a strict "Lore Keeper" persona — it can only cite what is present in the provided entries. Citations are formatted as `[[Category:slug|Title]]` and every response must close with a `[[Sources]]...[[/Sources]]` block.

`loreChat.js` validates those citations against the keys returned by `/health`, strips any hallucinated ones, and renders valid citations as clickable links to `lore.html`.

---

## Keeping the Bot Updated with New Lore Entries

Because the bot reads from Supabase at startup, no bot code needs to be touched when adding new lore.

**Workflow:**

1. **Add the entry to Supabase** — insert a new row in `lore_items` with the following fields:
   - `title`, `slug`, `category`, `content` (markdown is fine — it gets stripped for the prompt)
   - Optionally: `author`, `date`, `sort_order`

2. **Restart or reload the bot** — the corpus is only loaded once at startup. Two options:
   - Restart `server.py` by running `start.bat` again, **or**
   - Hit the reload endpoint without a full restart:
     ```
     POST https://lorekeeper.yesitsphoenix.dev/api/reload-lore
     ```

3. **Verify** — hit the health endpoint and confirm `lore_entries_loaded` incremented and your new entry's citation key (`Category:slug`) is present:
   ```
   GET https://lorekeeper.yesitsphoenix.dev/health
   ```

---

## Common Issues

**Entry not appearing after reload**
Entries with an empty `content` field are silently skipped with a `[WARN]` log. Ensure new entries have actual content populated before reloading.

**Hallucinated citations**
`loreChat.js` strips any citation keys not returned by `/health`. If a valid entry's citations are being stripped, verify the `slug` and `category` in Supabase exactly match what the bot is generating — the check is case-insensitive but the key format must be `Category:slug`.
