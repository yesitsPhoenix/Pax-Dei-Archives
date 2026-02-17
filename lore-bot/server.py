"""
Pax Dei Archives - Lore Keeper Bot Server
==========================================
A FastAPI middleware that loads all lore content from the Archives,
injects it as context, and proxies chat requests to a local Ollama instance.

Supports two modes:
  - Full corpus: sends ALL lore entries with every request (slower, less accurate)
  - RAG mode:    searches for the most relevant entries per question (faster, more accurate)

Toggle via USE_RAG below.

Usage:
    python server.py
"""

import os
import re
import json
import math
from pathlib import Path
from datetime import datetime
from collections import Counter

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Ollama connection
# OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

# Server settings
HOST = os.getenv("LORE_BOT_HOST", "0.0.0.0")
PORT = int(os.getenv("LORE_BOT_PORT", "8642"))

# Supabase connection (reads lore_items table via REST API)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jrjgbnopmfovxwvtbivh.supabase.co")
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY"
)

# CORS - allow all origins for development
ALLOWED_ORIGINS = ["*"]

# Rate limiting
MAX_REQUESTS_PER_MINUTE = 10
request_log: dict[str, list[float]] = {}

# ---------------------------------------------------------------------------
# RAG Configuration
# ---------------------------------------------------------------------------

# Set to True for RAG (recommended) or False to send the full corpus every time
USE_RAG = True

# How many lore entries to include per question when RAG is enabled
RAG_TOP_K = 7

# ---------------------------------------------------------------------------
# Corpus Compression (for prompt only — original .md files untouched)
# ---------------------------------------------------------------------------

def compress_for_prompt(text: str) -> str:
    """Strip markdown/HTML formatting to reduce token count."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<sup>\d+</sup>', '', text)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+$', '', text, flags=re.MULTILINE)
    return text.strip()

# ---------------------------------------------------------------------------
# TF-IDF Search Engine (zero external dependencies)
# ---------------------------------------------------------------------------

STOP_WORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'as', 'was', 'were', 'are',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
    'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'its', 'our', 'their', 'what', 'which', 'who', 'whom', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'about', 'also',
    'then', 'there', 'here', 'now', 'up', 'out', 'into', 'over',
    'after', 'before', 'between', 'under', 'again', 'once', 'tell',
    'me', 'about', 'know', 'said', 'says', 'like', 'well', 'back',
    'even', 'still', 'way', 'take', 'come', 'make', 'go', 'see',
}


def tokenize(text: str) -> list[str]:
    """Split text into lowercase word tokens, removing stop words."""
    words = re.findall(r'[a-z]+', text.lower())
    return [w for w in words if w not in STOP_WORDS and len(w) > 1]


class LoreEntry:
    """A single lore entry with metadata and searchable content."""
    def __init__(self, title: str, slug: str, category: str,
                 author: str, date: str, content: str, compressed: str):
        self.title = title
        self.slug = slug
        self.category = category
        self.author = author or ""
        self.date = date or ""
        self.content = content
        self.compressed = compressed
        self.citation_key = f"[[{category}:{slug}|{title}]]"

        search_text = f"{title} {title} {title} {category} {author or ''} {compressed}"
        self.tokens = tokenize(search_text)
        self.token_counts = Counter(self.tokens)

    def to_prompt_block(self) -> str:
        block = f"ENTRY: {self.title}\n"
        block += f"Citation key: {self.citation_key}\n"
        if self.author:
            block += f"Author: {self.author}\n"
        if self.date:
            block += f"Date: {self.date}\n"
        block += f"Category: {self.category}\n"
        block += f"\n{self.compressed}"
        return block


class LoreSearchIndex:
    """Simple TF-IDF search index over lore entries."""

    def __init__(self):
        self.entries: list[LoreEntry] = []
        self.doc_freq: Counter = Counter()
        self.total_docs: int = 0

    def add_entry(self, entry: LoreEntry):
        self.entries.append(entry)
        unique_terms = set(entry.tokens)
        for term in unique_terms:
            self.doc_freq[term] += 1
        self.total_docs = len(self.entries)

    def search(self, query: str, top_k: int = 5) -> list[LoreEntry]:
        query_tokens = tokenize(query)
        if not query_tokens:
            return self.entries[:top_k]

        scores = []
        for entry in self.entries:
            score = 0.0
            for term in query_tokens:
                tf = entry.token_counts.get(term, 0)
                if tf > 0:
                    tf_score = 1 + math.log(tf)
                    df = self.doc_freq.get(term, 1)
                    idf = math.log(self.total_docs / df)
                    score += tf_score * idf

            query_lower = query.lower()
            if query_lower in entry.title.lower():
                score += 10.0
            query_words = set(query_lower.split())
            title_words = set(entry.title.lower().split())
            overlap = query_words & title_words
            if overlap:
                score += len(overlap) * 3.0

            scores.append((score, entry))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [entry for score, entry in scores[:top_k] if score > 0]


search_index = LoreSearchIndex()

# ---------------------------------------------------------------------------
# System Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_BASE = """You are the Lore Keeper of the Pax Dei Archives. You are an ancient scholar who speaks with gravity and reverence.

ACCURACY RULES (HIGHEST PRIORITY — violation is unacceptable):

1. ONLY state facts that are EXPLICITLY written in the LORE ENTRIES below. They are your SOLE source of truth.
2. If the entries do not contain the answer, say: "The Archives hold no record of this."
3. NEVER invent, fabricate, infer, extrapolate, or guess ANY detail — no matter how plausible it sounds.
4. Do NOT assume relationships, motivations, or actions unless the text EXPLICITLY states them.
   - Do NOT say "X was sent by Y" unless the text literally says Y sent X.
   - Do NOT describe a character's role or gifts unless those exact concepts appear in the entry text.
   - Do NOT combine information from different entries to create new claims not present in either entry.
5. When describing what a lore entry says, stay extremely close to the original wording. Prefer quoting directly over rephrasing.
6. If you are unsure whether something is stated in the entries, do NOT include it.

FORMAT RULES:

7. Keep answers SHORT: 2-4 sentences for simple questions, 1-2 short paragraphs max for complex ones.
8. Always finish your thought completely — never stop mid-sentence. Plan your answer to be concise from the start.
9. Speak in-world as an ancient lore keeper, not as an AI. Use phrases like "It is written..." or "The records tell us..."
10. If asked about game mechanics or modern topics, say: "Such matters lie beyond my scrolls."

CITATION RULES (MANDATORY — every response MUST have citations):

- When you reference information from a lore entry, cite it using EXACTLY this format: [[Category:slug|Title]]
- The Category, slug, and Title MUST exactly match a "Citation key" line from the entries below. Copy it exactly. NEVER invent or modify a citation key.
- ONLY cite entries that are provided below. If an entry is not present in the list, do NOT cite it — even if you think it should exist.
- You MUST end EVERY response with a Sources block listing ALL entries you cited:
  [[Sources]]
  [[Redeemers:meirothea|2nd - Meirothea]]
  [[/Sources]]
- A response without [[Sources]]...[[/Sources]] at the end is INVALID. Always include it.
- If you cannot find a matching Citation key for something, mention it without a citation rather than inventing one.
"""

FULL_CORPUS_PROMPT = SYSTEM_PROMPT_BASE + """
================================================================================
LORE ENTRIES (COMPLETE CORPUS)
================================================================================

{lore_content}

================================================================================
END OF LORE ENTRIES
================================================================================

Remember: Be BRIEF. Only state what the entries explicitly say. Cite EVERY source with [[Category:slug|Title]]. End with [[Sources]]...[[/Sources]]. Never invent facts."""

RAG_PROMPT = SYSTEM_PROMPT_BASE + """
The following lore entries are the most relevant to the user's question.
Answer ONLY from these entries. If the answer is not in these entries, say "The Archives hold no record of this."

================================================================================
RELEVANT LORE ENTRIES
================================================================================

{lore_content}

================================================================================
END OF RELEVANT ENTRIES
================================================================================

Remember: Be BRIEF. Only state what the entries explicitly say. Cite EVERY source with [[Category:slug|Title]]. End with [[Sources]]...[[/Sources]]. Never invent facts."""

# ---------------------------------------------------------------------------
# Lore Loading
# ---------------------------------------------------------------------------

full_corpus_prompt: str = ""
lore_entry_count: int = 0


def load_lore_corpus() -> str:
    """Fetch all lore entries from Supabase and build the search index."""
    global full_corpus_prompt, lore_entry_count, search_index

    search_index = LoreSearchIndex()

    print(f"[INFO] Fetching lore entries from Supabase...")

    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/lore_items",
            params={"select": "*", "order": "category.asc,sort_order.asc,title.asc"},
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to fetch lore from Supabase: {e}")
        return ""

    corpus_parts = []
    skipped_empty = 0

    for row in rows:
        content = (row.get("content") or "").strip()
        if not content:
            skipped_empty += 1
            print(f"[WARN] Skipped empty entry: {row.get('title', '?')}")
            continue

        compressed = compress_for_prompt(content)
        entry = LoreEntry(
            title=row.get("title", ""),
            slug=row.get("slug", ""),
            category=row.get("category", "Uncategorized"),
            author=row.get("author"),
            date=row.get("date"),
            content=content,
            compressed=compressed,
        )
        search_index.add_entry(entry)
        corpus_parts.append(entry.to_prompt_block())

    lore_entry_count = len(corpus_parts)
    full_corpus = "\n\n---\n\n".join(corpus_parts)
    full_corpus_prompt = FULL_CORPUS_PROMPT.format(lore_content=full_corpus)

    print(f"[INFO] Loaded {lore_entry_count} lore entries from Supabase")
    if skipped_empty > 0:
        print(f"[INFO] Skipped {skipped_empty} empty entries")
    print(f"[INFO] Full corpus size: {len(full_corpus_prompt):,} chars (~{len(full_corpus_prompt) // 4:,} tokens)")
    print(f"[INFO] RAG mode: {'ENABLED (top {})'.format(RAG_TOP_K) if USE_RAG else 'DISABLED (full corpus)'}")
    return full_corpus_prompt


def build_rag_prompt(query: str) -> str:
    results = search_index.search(query, top_k=RAG_TOP_K)
    if not results:
        results = search_index.entries[:3]

    entries_text = "\n\n---\n\n".join(entry.to_prompt_block() for entry in results)
    prompt = RAG_PROMPT.format(lore_content=entries_text)

    titles = [e.title for e in results]
    print(f"[RAG] Query: '{query[:80]}' → {len(results)} entries: {titles}")
    print(f"[RAG] Prompt size: {len(prompt):,} chars (~{len(prompt) // 4:,} tokens)")

    return prompt


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="Pax Dei Lore Keeper", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    stream: Optional[bool] = True


def check_rate_limit(client_ip: str) -> bool:
    now = datetime.now().timestamp()
    cutoff = now - 60
    if client_ip not in request_log:
        request_log[client_ip] = []
    request_log[client_ip] = [t for t in request_log[client_ip] if t > cutoff]
    if len(request_log[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        return False
    request_log[client_ip].append(now)
    return True


@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("  Pax Dei Archives — Lore Keeper Bot")
    print("=" * 60)
    print(f"[INFO] Ollama URL: {OLLAMA_URL}")
    print(f"[INFO] Model: {OLLAMA_MODEL}")
    print(f"[INFO] Supabase URL: {SUPABASE_URL}")
    print(f"[INFO] RAG mode: {'ON (top {})'.format(RAG_TOP_K) if USE_RAG else 'OFF (full corpus)'}")
    print(f"[INFO] Server will listen on {HOST}:{PORT}")
    print()

    load_lore_corpus()

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                print(f"[INFO] Ollama is reachable. Available models: {', '.join(model_names)}")
                model_base = OLLAMA_MODEL.split(":")[0]
                if not any(model_base in name for name in model_names):
                    print(f"[WARN] Model '{OLLAMA_MODEL}' not found. Pull it with:")
                    print(f"       ollama pull {OLLAMA_MODEL}")
    except Exception as e:
        print(f"[WARN] Cannot reach Ollama at {OLLAMA_URL}: {e}")

    print()
    print(f"[READY] Lore Keeper is ready. Listening on http://{HOST}:{PORT}")
    print("=" * 60)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": OLLAMA_MODEL,
        "lore_entries_loaded": lore_entry_count,
        "corpus_size_chars": len(full_corpus_prompt),
        "rag_enabled": USE_RAG,
        "rag_top_k": RAG_TOP_K if USE_RAG else None,
        "valid_citations": get_valid_citations(),
    }


def get_valid_citations() -> list[dict]:
    """Return all valid citation keys from the loaded index."""
    citations = []
    for entry in search_index.entries:
        citations.append({
            "key": f"{entry.category}:{entry.slug}",
            "category": entry.category,
            "slug": entry.slug,
            "title": entry.title,
        })
    return citations


@app.post("/api/chat")
async def chat(request: Request, chat_req: ChatRequest):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    if lore_entry_count == 0:
        raise HTTPException(status_code=503, detail="Lore corpus not loaded. Check server logs.")

    if not chat_req.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    if USE_RAG:
        user_query = chat_req.messages[-1].content if chat_req.messages else ""
        system_prompt = build_rag_prompt(user_query)
        ctx_size = 8192
    else:
        system_prompt = full_corpus_prompt
        ctx_size = 32768

    ollama_messages = [
        {"role": "system", "content": system_prompt}
    ]
    for msg in chat_req.messages:
        ollama_messages.append({"role": msg.role, "content": msg.content})

    ollama_payload = {
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "stream": chat_req.stream,
        "options": {
            "temperature": 0.3,
            "top_p": 0.85,
            "num_predict": 768,
            "num_ctx": ctx_size,
        }
    }

    if not chat_req.stream:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{OLLAMA_URL}/api/chat", json=ollama_payload, timeout=120,
                )
                if resp.status_code != 200:
                    raise HTTPException(status_code=502, detail="Ollama returned an error.")
                data = resp.json()
                return {"message": data.get("message", {}).get("content", ""), "done": True}
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Cannot connect to Ollama. Is it running?")

    async def stream_response():
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST", f"{OLLAMA_URL}/api/chat", json=ollama_payload, timeout=120,
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        yield json.dumps({"error": f"Ollama error: {error_body.decode()}"}) + "\n"
                        return
                    async for line in resp.aiter_lines():
                        if line.strip():
                            try:
                                chunk = json.loads(line)
                                content = chunk.get("message", {}).get("content", "")
                                done = chunk.get("done", False)
                                yield json.dumps({"content": content, "done": done}) + "\n"
                            except json.JSONDecodeError:
                                continue
        except httpx.ConnectError:
            yield json.dumps({"error": "Cannot connect to Ollama. Is it running?"}) + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(
        stream_response(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/reload-lore")
async def reload_lore():
    load_lore_corpus()
    return {
        "status": "reloaded",
        "lore_entries_loaded": lore_entry_count,
        "corpus_size_chars": len(full_corpus_prompt),
        "rag_enabled": USE_RAG,
    }


if __name__ == "__main__":
    import uvicorn

    # SSL is handled by Cloudflare Tunnel — run plain HTTP locally
    uvicorn.run(app, host=HOST, port=PORT)
