"""
embed_lore.py
=============
Generates vector embeddings for lore_items rows using Ollama's nomic-embed-text
model and writes them back to Supabase.

Usage:
    python embed_lore.py           # only process rows where embedding IS NULL
    python embed_lore.py --all     # re-embed every row regardless

Requirements:
    pip install httpx
    ollama pull nomic-embed-text
"""

import sys
import json
import httpx

# ---------------------------------------------------------------------------
# Config — mirrors server.py so they stay in sync
# ---------------------------------------------------------------------------

SUPABASE_URL = "https://jrjgbnopmfovxwvtbivh.supabase.co"
# Service role key required — anon key is blocked by RLS from writing embeddings.
# Find this in Supabase → Settings → API → service_role key.
# This script is local-only and never exposed publicly, so service role is safe here.
SUPABASE_ANON_KEY = "YOUR_SERVICE_ROLE_KEY_HERE"

OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text"

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
}


def fetch_rows(only_null: bool) -> list[dict]:
    """Fetch lore_items rows that need embedding."""
    params = {
        "select": "id,title,slug,category,content",
        "order": "category.asc,title.asc",
    }
    if only_null:
        params["embedding"] = "is.null"

    resp = httpx.get(
        f"{SUPABASE_URL}/rest/v1/lore_items",
        headers=HEADERS,
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def write_embedding(row_id: str, vector: list[float]) -> None:
    """PATCH a single row's embedding column."""
    resp = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/lore_items",
        headers={**HEADERS, "Prefer": "return=minimal"},
        params={"id": f"eq.{row_id}"},
        content=json.dumps({"embedding": vector}),
        timeout=30,
    )
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Ollama embedding
# ---------------------------------------------------------------------------

def get_embedding(text: str) -> list[float]:
    """Call Ollama's embedding endpoint and return the vector."""
    resp = httpx.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


def check_ollama() -> None:
    """Verify Ollama is reachable and nomic-embed-text is available."""
    try:
        resp = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        resp.raise_for_status()
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        if not any("nomic-embed-text" in m for m in models):
            print(f"[WARN] nomic-embed-text not found in Ollama.")
            print(f"       Run: ollama pull nomic-embed-text")
            print(f"       Available models: {', '.join(models)}")
            sys.exit(1)
        print(f"[INFO] Ollama reachable. nomic-embed-text is available.")
    except httpx.ConnectError:
        print(f"[ERROR] Cannot connect to Ollama at {OLLAMA_URL}. Is it running?")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    re_embed_all = "--all" in sys.argv

    print("=" * 60)
    print("  Pax Dei Archives — Lore Embedding Script")
    print("=" * 60)
    print(f"[INFO] Mode: {'re-embed ALL rows' if re_embed_all else 'only NULL embeddings'}")
    print(f"[INFO] Model: {EMBED_MODEL}")
    print()

    check_ollama()

    print(f"[INFO] Fetching rows from Supabase...")
    rows = fetch_rows(only_null=not re_embed_all)

    if not rows:
        print("[INFO] No rows to process. All entries are already embedded.")
        print("       Use --all to force re-embedding of every entry.")
        return

    print(f"[INFO] {len(rows)} row(s) to embed.\n")

    success = 0
    skipped = 0
    failed = 0

    for i, row in enumerate(rows, start=1):
        title = row.get("title", "?")
        row_id = row.get("id")
        content = (row.get("content") or "").strip()

        if not content:
            print(f"  [{i}/{len(rows)}] SKIP  '{title}' — empty content")
            skipped += 1
            continue

        # Embed title + content so the vector reflects both
        input_text = f"{title}\n\n{content}"

        try:
            vector = get_embedding(input_text)
            write_embedding(row_id, vector)
            print(f"  [{i}/{len(rows)}] OK    '{title}'  ({len(vector)}d)")
            success += 1
        except Exception as e:
            print(f"  [{i}/{len(rows)}] FAIL  '{title}' — {e}")
            failed += 1

    print()
    print("=" * 60)
    print(f"  Done.")
    print(f"  Embedded : {success}")
    print(f"  Skipped  : {skipped}  (empty content)")
    print(f"  Failed   : {failed}")
    print("=" * 60)
    if success > 0:
        print()
        print("[NEXT] Reload the lore-bot to pick up new embeddings:")
        print("       POST https://lorekeeper.yesitsphoenix.dev/api/reload-lore")


if __name__ == "__main__":
    main()
