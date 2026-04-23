/**
 * loreChat.js — Pax Dei Archives Lore Keeper Chat
 * 
 * Handles the chat UI, streaming responses from the local Lore Keeper server,
 * conversation state management, and citation rendering with links to lore pages.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// The URL of your Lore Keeper server.
// For local development, use the server's local IP.
// For production with Cloudflare Tunnel, use the tunnel HTTPS URL.
// const LORE_BOT_URL = 'http://192.168.1.22:8642';
const LORE_BOT_URL = 'https://lorekeeper.yesitsphoenix.dev';

const MAX_HISTORY_MESSAGES = 20; // Full local UI history
const MAX_REQUEST_MESSAGES = 6; // Smaller request window for faster server prefill
const MAX_REQUEST_MESSAGE_CHARS = 1500;

// Base URL for lore page links (relative works for same-origin)
const LORE_PAGE_BASE = 'lore.html';

// ---------------------------------------------------------------------------
// Timing Debug
// ---------------------------------------------------------------------------
// Set to true to log detailed client-side timing for every request.
// Measures: click/send -> HTTP response -> first chunk -> stream end -> finalize render.
// All output goes to browser console (F12 -> Console).
const TIMING_DEBUG = true;
let warmupStarted = false;

function createRequestId() {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `lore-${Date.now().toString(36)}-${randomPart}`;
}

function logTiming(requestId, phase, startedAt, extra = '') {
    if (!TIMING_DEBUG) return;
    const elapsed = Math.round(performance.now() - startedAt);
    const suffix = extra ? ` | ${extra}` : '';
    console.log(`[Lore Timing][${requestId}] ${phase}: ${elapsed}ms${suffix}`);
}

async function triggerWarmup(reason = 'page_load') {
    if (warmupStarted || !serverConnected) return;
    warmupStarted = true;
    const startedAt = performance.now();

    try {
        const response = await fetch(`${LORE_BOT_URL}/api/warmup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Warmup failed (${response.status})`);
        }

        const data = await response.json();
        if (TIMING_DEBUG) {
            console.log(
                `[Lore Warmup] ${reason}: ${Math.round(performance.now() - startedAt)}ms ` +
                `(keep_alive=${data.keep_alive}, starter_cache=${JSON.stringify(data.starter_cache)})`
            );
        }
    } catch (error) {
        warmupStarted = false;
        console.warn('[Lore Warmup] Unable to warm lore-bot:', error);
    }
}

function stripCitationMarkup(text) {
    return text
        .replace(/\[\[Sources\]\][\s\S]*?\[\[\/Sources\]\]/gi, '')
        .replace(/\[\[([^:\]]+):([^\]|]+)\|([^\]]+)\]\]/g, '$3')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactMessageForRequest(message) {
    const normalized = message.role === 'assistant'
        ? stripCitationMarkup(message.content)
        : message.content.replace(/\s+/g, ' ').trim();

    if (normalized.length <= MAX_REQUEST_MESSAGE_CHARS) {
        return { role: message.role, content: normalized };
    }

    return {
        role: message.role,
        content: normalized.slice(0, MAX_REQUEST_MESSAGE_CHARS - 1).trimEnd() + '…',
    };
}

function buildRequestMessages() {
    return conversationHistory
        .slice(-MAX_REQUEST_MESSAGES)
        .map(compactMessageForRequest)
        .filter(message => message.content);
}

// ---------------------------------------------------------------------------
// Category icon mapping (matches lore.js)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS = {
    'Ages':             'fa-hourglass-half',
    'Divine':           'fa-star',
    'Factions/Orders':  'fa-users-gear',
    'Factions':         'fa-users-gear',
    'Known Figures':    'fa-user-tie',
    'Redeemers':        'fa-hand-holding-heart',
    'World':            'fa-earth-americas',
    'Writings':         'fa-pen-nib',
    'Creation':         'fa-scroll',
    'Magic':            'fa-wand-magic-sparkles',
    'Geography':        'fa-mountain-sun',
};

function getCategoryIcon(category) {
    // Try exact match first, then partial
    if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
    const key = Object.keys(CATEGORY_ICONS).find(k => 
        category.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(category.toLowerCase())
    );
    return key ? CATEGORY_ICONS[key] : 'fa-book';
}

// Map category strings from citations to the actual URL category parameter
// (handles cases like "Factions/Orders" vs "Factions")
function normalizeCategoryForUrl(category) {
    const categoryMap = {
        'ages': 'Ages',
        'divine': 'Divine',
        'factions': 'Factions/Orders',
        'factions/orders': 'Factions/Orders',
        'known figures': 'Known Figures',
        'redeemers': 'Redeemers',
        'world': 'World',
        'writings': 'Writings',
    };
    return categoryMap[category.toLowerCase()] || category;
}

// ---------------------------------------------------------------------------
// Citation Parsing
// ---------------------------------------------------------------------------

/**
 * Parse [[category:slug|Title]] citations into HTML anchor tags.
 * Called on the raw text BEFORE markdown rendering.
 */
function parseCitationsToMarkdown(text) {
    // Replace inline citations: [[Category:slug|Display Title]]
    // Convert to a markdown-friendly format that won't be mangled
    return text.replace(/\[\[([^:\]]+):([^\]|]+)\|([^\]]+)\]\]/g, (match, category, slug, title) => {
        const urlCategory = normalizeCategoryForUrl(category.trim());
        const cleanSlug = slug.trim();
        const cleanTitle = title.trim();
        const url = `${LORE_PAGE_BASE}?category=${encodeURIComponent(urlCategory)}&item=${encodeURIComponent(cleanSlug)}`;
        const icon = getCategoryIcon(urlCategory);
        // Return an HTML span that will survive markdown parsing
        return `<a href="${url}" class="lore-citation-link" title="${cleanTitle} (${urlCategory})"><i class="fa-solid ${icon}"></i> ${cleanTitle}</a>`;
    });
}

/**
 * Extract and render the [[Sources]]...[[/Sources]] block into a styled card section.
 * Called on the rendered HTML AFTER markdown.
 */
function renderSourcesBlock(html) {
    // Match the sources block — it might be wrapped in <p> tags by markdown
    const sourcesRegex = /(?:<p>)?\[\[Sources\]\](?:<\/p>)?([\s\S]*?)(?:<p>)?\[\[\/Sources\]\](?:<\/p>)?/i;
    const match = html.match(sourcesRegex);
    
    if (!match) return html;

    const sourcesContent = match[1];
    
    // Parse individual source citations from the block
    const citationRegex = /<a href="([^"]+)" class="lore-citation-link" title="([^"]*)">([\s\S]*?)<\/a>/g;
    const sources = [];
    let citMatch;
    
    while ((citMatch = citationRegex.exec(sourcesContent)) !== null) {
        const href = citMatch[1];
        const titleAttr = citMatch[2]; // "Title (Category)"
        const innerHtml = citMatch[3];
        
        // Extract category from title attr
        const catMatch = titleAttr.match(/\(([^)]+)\)$/);
        const category = catMatch ? catMatch[1] : '';
        const title = titleAttr.replace(/\s*\([^)]+\)$/, '');
        const icon = getCategoryIcon(category);

        sources.push({ href, title, category, icon, innerHtml });
    }

    // Also catch any raw [[category:slug|title]] that weren't pre-parsed
    const rawCitRegex = /\[\[([^:\]]+):([^\]|]+)\|([^\]]+)\]\]/g;
    let rawMatch;
    while ((rawMatch = rawCitRegex.exec(sourcesContent)) !== null) {
        const category = normalizeCategoryForUrl(rawMatch[1].trim());
        const slug = rawMatch[2].trim();
        const title = rawMatch[3].trim();
        const icon = getCategoryIcon(category);
        const href = `${LORE_PAGE_BASE}?category=${encodeURIComponent(category)}&item=${encodeURIComponent(slug)}`;
        sources.push({ href, title, category, icon });
    }

    if (sources.length === 0) {
        // Remove the empty sources block
        return html.replace(sourcesRegex, '');
    }

    // Build the styled sources section
    const sourceCards = sources.map(s => `
        <a href="${s.href}" class="lore-source-card" title="View in Archives">
            <div class="source-card-icon">
                <i class="fa-solid ${s.icon}"></i>
            </div>
            <div class="source-card-info">
                <span class="source-card-title">${s.title}</span>
                <span class="source-card-category">${s.category}</span>
            </div>
            <div class="source-card-arrow">
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        </a>
    `).join('');

    const sourcesHtml = `
        <div class="lore-sources-section">
            <div class="lore-sources-header">
                <i class="fa-solid fa-scroll"></i> Referenced Scrolls
            </div>
            <div class="lore-sources-grid">
                ${sourceCards}
            </div>
        </div>
    `;

    return html.replace(sourcesRegex, sourcesHtml);
}

// ---------------------------------------------------------------------------
// Citation Validation
// ---------------------------------------------------------------------------

// Set of valid "Category:slug" keys — populated from server health check
let validCitationMap = new Map();

function normalizeCitationKey(key) {
    return key.trim().toLowerCase();
}

function buildCitationMap(citations = []) {
    const map = new Map();
    for (const citation of citations) {
        if (!citation || !citation.key) continue;
        map.set(normalizeCitationKey(citation.key), citation);
    }
    return map;
}

function resolveCitationMeta(category, slug, registry) {
    const key = `${category.trim()}:${slug.trim()}`;
    return registry.get(normalizeCitationKey(key)) || null;
}

/**
 * Remove any [[Category:slug|Title]] citations where Category:slug
 * does not exist in the valid set. Prevents hallucinated links.
 */
function stripInvalidCitations(text, registry = validCitationMap) {
    if (registry.size === 0) return text;

    return text.replace(/\[\[([^:\]]+):([^\]|]+)\|([^\]]+)\]\]/g, (match, category, slug, title) => {
        const meta = resolveCitationMeta(category, slug, registry);
        if (meta) {
            const canonical = `[[${meta.category}:${meta.slug}|${meta.title}]]`;
            if (title.trim() !== meta.title || category.trim() !== meta.category || slug.trim() !== meta.slug) {
                console.warn(`[Lore Chat] Canonicalized citation: ${match} -> ${canonical}`);
            }
            return canonical;
        }
        console.warn(`[Lore Chat] Stripped invalid citation: ${match}`);
        return title.trim();
    });
}

/**
 * Also strip invalid citations from [[Sources]]...[[/Sources]] blocks.
 * Remove source lines that reference invalid keys, and remove the
 * entire block if no valid sources remain.
 */
function stripInvalidSources(text, registry = validCitationMap) {
    if (registry.size === 0) return text;

    return text.replace(/\[\[Sources\]\]([\s\S]*?)\[\[\/Sources\]\]/gi, (match, inner) => {
        // Find all citations within the sources block
        const validLines = [];
        const citationRegex = /\[\[([^:\]]+):([^\]|]+)\|([^\]]+)\]\]/g;
        let citMatch;
        while ((citMatch = citationRegex.exec(inner)) !== null) {
            const meta = resolveCitationMeta(citMatch[1], citMatch[2], registry);
            if (meta) {
                validLines.push(`[[${meta.category}:${meta.slug}|${meta.title}]]`);
            } else {
                console.warn(`[Lore Chat] Stripped invalid source: ${citMatch[0]}`);
            }
        }

        if (validLines.length === 0) return ''; // Remove entire block
        return `[[Sources]]\n${validLines.join('\n')}\n[[/Sources]]`;
    });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let conversationHistory = [];
let isStreaming = false;
let serverConnected = false;

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const messagesContainer = document.getElementById('lore-chat-messages');
const chatInput = document.getElementById('lore-chat-input');
const sendButton = document.getElementById('lore-chat-send');
const suggestionsContainer = document.getElementById('lore-chat-suggestions');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const charCount = document.getElementById('char-count');

// ---------------------------------------------------------------------------
// Server Health Check
// ---------------------------------------------------------------------------

async function checkServerHealth() {
    setStatus('loading', 'Connecting to Lore Keeper...');
    try {
        const response = await fetch(`${LORE_BOT_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const data = await response.json();
            serverConnected = true;
            setStatus('connected', `Connected · ${data.lore_entries_loaded} lore entries loaded`);
            sendButton.disabled = false;

            // Store valid citation keys for validation
            if (data.valid_citations && Array.isArray(data.valid_citations)) {
                validCitationMap = buildCitationMap(data.valid_citations);
                console.log(`[Lore Chat] Loaded ${validCitationMap.size} valid citation keys`);
            }

            void triggerWarmup('health_check');

            return true;
        }
    } catch (e) {
        // Connection failed
    }

    serverConnected = false;
    setStatus('disconnected', 'Lore Keeper offline — start the server to chat');
    sendButton.disabled = true;
    return false;
}

function setStatus(state, text) {
    statusDot.className = `status-dot ${state}`;
    statusText.textContent = text;
}

// ---------------------------------------------------------------------------
// Message Rendering
// ---------------------------------------------------------------------------

/**
 * Render markdown with citation support.
 * @param {string} text - Raw text from model (may contain [[citations]])
 * @param {boolean} withCitations - If true, parse citations. False during streaming.
 */
function renderMarkdownSafe(text, withCitations = false) {
    let processed = text;

    // Parse citations to HTML links before markdown processes them
    if (withCitations) {
        processed = parseCitationsToMarkdown(processed);
    }

    let html;
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
        });
        html = marked.parse(processed);
    } else {
        html = processed.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    }

    // Post-process: render the sources block into cards
    if (withCitations) {
        html = renderSourcesBlock(html);
    }

    return html;
}

function addMessage(role, content, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message`;

    const isAssistant = role === 'assistant';
    const avatarIcon = isAssistant ? 'fa-book-open' : 'fa-user';
    const senderName = isAssistant ? 'Lore Keeper' : 'You';

    let renderedContent;
    if (isError) {
        renderedContent = `<div class="chat-error"><i class="fa-solid fa-triangle-exclamation"></i>${content}</div>`;
    } else {
        // User messages don't need citation parsing
        renderedContent = renderMarkdownSafe(content, isAssistant);
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-sender">${senderName}</div>
            <div class="message-text">${renderedContent}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

function addStreamingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant-message';
    messageDiv.id = 'streaming-message';

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid fa-book-open"></i>
        </div>
        <div class="message-content">
            <div class="message-sender">Lore Keeper</div>
            <div class="message-text" id="streaming-text">
                <div class="streaming-status" id="streaming-status">Searching the Archives...</div>
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

function updateStreamingStatus(text) {
    const streamingStatus = document.getElementById('streaming-status');
    if (!streamingStatus) return;
    streamingStatus.textContent = text;
    scrollToBottom();
}

function updateStreamingMessage(content) {
    const streamingText = document.getElementById('streaming-text');
    if (!streamingText) return;

    // During streaming, render markdown but NOT citations (they may be incomplete)
    const rendered = renderMarkdownSafe(content, false);
    streamingText.innerHTML = rendered + '<span class="streaming-cursor"></span>';
    scrollToBottom();
}

function finalizeStreamingMessage(content, allowedCitationMap = null) {
    const streamingText = document.getElementById('streaming-text');
    if (!streamingText) return;

    // Validate citations — strip any the model invented
    const registry = allowedCitationMap && allowedCitationMap.size > 0 ? allowedCitationMap : validCitationMap;
    let validated = stripInvalidCitations(content, registry);
    validated = stripInvalidSources(validated, registry);

    // Final render WITH full citation parsing and source cards
    streamingText.innerHTML = renderMarkdownSafe(validated, true);

    // Remove BOTH streaming IDs so the next message doesn't target these elements
    streamingText.removeAttribute('id');

    const streamingMsg = document.getElementById('streaming-message');
    if (streamingMsg) {
        streamingMsg.removeAttribute('id');
    }

    scrollToBottom();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ---------------------------------------------------------------------------
// Chat Sending & Streaming
// ---------------------------------------------------------------------------

async function sendMessage(text, source = 'text_entry') {
    if (!text.trim() || isStreaming || !serverConnected) return;

    const userMessage = text.trim();
    const requestId = createRequestId();

    // Hide suggestions after first message
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }

    // Add user message to UI
    addMessage('user', userMessage);

    // Add to conversation history
    conversationHistory.push({ role: 'user', content: userMessage });

    // Trim history if too long
    if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
    }

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    updateCharCount();
    setInputState(false);

    // Start streaming response
    isStreaming = true;
    const streamingDiv = addStreamingMessage();
    let fullResponse = '';
    let renderScheduled = false;
    const requestMessages = buildRequestMessages();

    // Timing
    const t_send = performance.now();
    logTiming(requestId, 'submit', t_send, `source=${source} request_messages=${requestMessages.length}`);
    let t_http_response = null;
    let t_first_chunk = null;
    let t_last_chunk = null;
    let t_done_chunk = null;
    let chunkCount = 0;
    let allowedCitationMap = null;

    function scheduleRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        setTimeout(() => {
            updateStreamingMessage(fullResponse);
            renderScheduled = false;
        }, 50);
    }

    try {
        const response = await fetch(`${LORE_BOT_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: requestMessages,
                stream: true,
                request_id: requestId,
                request_source: source,
            }),
        });

        t_http_response = performance.now();
        logTiming(
            requestId,
            'http_response',
            t_send,
            `status=${response.status}${response.ok ? '' : ' error'}`
        );

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Server error (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (newline-delimited JSON)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const chunk = JSON.parse(line);

                    if (chunk.error) {
                        throw new Error(chunk.error);
                    }

                    if (chunk.meta) {
                        if (chunk.meta.phase === 'search_complete') {
                            if (Array.isArray(chunk.meta.allowed_citations)) {
                                allowedCitationMap = buildCitationMap(chunk.meta.allowed_citations);
                            }
                            const count = chunk.meta.relevant_scrolls;
                            if (typeof count === 'number' && count > 0) {
                                updateStreamingStatus(`Found ${count} relevant scrolls...`);
                                logTiming(requestId, 'search_complete', t_send, `relevant_scrolls=${count}`);
                            } else if (count === 0) {
                                updateStreamingStatus('No relevant scrolls found.');
                                logTiming(requestId, 'search_complete', t_send, 'relevant_scrolls=0');
                            } else {
                                updateStreamingStatus('Searching the Archives...');
                                logTiming(requestId, 'search_complete', t_send);
                            }
                        }
                        continue;
                    }

                    if (chunk.content) {
                        chunkCount++;
                        t_last_chunk = performance.now();
                        if (t_first_chunk === null) {
                            t_first_chunk = t_last_chunk;
                            const afterHttp = t_http_response === null ? 'n/a' : Math.round(t_first_chunk - t_http_response);
                            logTiming(requestId, 'first_chunk', t_send, `after_http=${afterHttp}ms`);
                        }
                        fullResponse += chunk.content;
                        scheduleRender();
                    }

                    if (chunk.done) {
                        t_done_chunk = performance.now();
                        logTiming(requestId, 'done_chunk', t_send, `chunks=${chunkCount}`);
                        break;
                    }
                } catch (parseErr) {
                    if (parseErr.message && !parseErr.message.includes('JSON')) {
                        throw parseErr;
                    }
                    // Skip malformed JSON chunks
                }
            }
        }

        // Finalize with full citation rendering
        const t_stream_end = performance.now();
        if (t_first_chunk !== null) {
            const genMs = Math.round(t_last_chunk - t_first_chunk);
            const tps = genMs > 0 ? (chunkCount / (genMs / 1000)).toFixed(1) : '?';
            logTiming(requestId, 'stream_complete', t_send, `chunks=${chunkCount} stream_window=${genMs}ms chunks_per_sec=${tps}`);
        } else {
            logTiming(requestId, 'stream_complete', t_send, `chunks=${chunkCount}`);
        }

        const t_render_start = performance.now();
        finalizeStreamingMessage(fullResponse, allowedCitationMap);
        const finalizeMs = Math.round(performance.now() - t_render_start);
        const totalMs = Math.round(performance.now() - t_send);
        const firstVisibleMs = t_first_chunk === null ? 'n/a' : Math.round(t_first_chunk - t_send);
        const doneGapMs = t_done_chunk === null ? 'n/a' : Math.round(performance.now() - t_done_chunk);
        logTiming(requestId, 'finalize_render', t_send, `render_ms=${finalizeMs}`);
        logTiming(
            requestId,
            'complete',
            t_send,
            `first_visible=${firstVisibleMs}ms total=${totalMs}ms post_done_render=${doneGapMs}ms`
        );

        // Add assistant response to history
        if (fullResponse) {
            conversationHistory.push({ role: 'assistant', content: fullResponse });
        }

    } catch (error) {
        console.error('Chat error:', error);
        logTiming(requestId, 'error', t_send, error.message || 'unknown');

        // Remove the streaming message
        const streamingMsg = document.getElementById('streaming-message');
        if (streamingMsg) {
            streamingMsg.remove();
        }

        // Show error
        let errorMessage = 'Something went wrong. ';
        if (error.message.includes('Cannot connect') || error.message.includes('Failed to fetch')) {
            errorMessage += 'The Lore Keeper server appears to be offline.';
            setStatus('disconnected', 'Connection lost');
            serverConnected = false;
        } else if (error.message.includes('429')) {
            errorMessage += 'Too many questions at once — please wait a moment.';
        } else {
            errorMessage += error.message;
        }

        addMessage('assistant', errorMessage, true);

        // Remove the failed user message from history so it can be retried
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            conversationHistory.pop();
        }
    } finally {
        isStreaming = false;
        setInputState(true);
        chatInput.focus();
    }
}

// ---------------------------------------------------------------------------
// Input Management
// ---------------------------------------------------------------------------

function setInputState(enabled) {
    chatInput.disabled = !enabled;
    sendButton.disabled = !enabled || !chatInput.value.trim();
}

function updateCharCount() {
    if (charCount) {
        charCount.textContent = chatInput.value.length;
    }
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

// Send on button click
sendButton.addEventListener('click', () => {
    sendMessage(chatInput.value, 'text_entry');
});

// Send on Enter (Shift+Enter for new line)
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value, 'text_entry');
    }
});

// Update char count and button state on input
chatInput.addEventListener('input', () => {
    updateCharCount();
    autoResizeTextarea();
    sendButton.disabled = !chatInput.value.trim() || isStreaming || !serverConnected;
});

// Suggestion chips
if (suggestionsContainer) {
    suggestionsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.suggestion-chip');
        if (chip) {
            const question = chip.dataset.question;
            if (question) {
                sendMessage(question, 'starter_pill');
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

(async function init() {
    // Check server health
    const connected = await checkServerHealth();

    if (!connected) {
        // Retry every 10 seconds
        const retryInterval = setInterval(async () => {
            const ok = await checkServerHealth();
            if (ok) {
                clearInterval(retryInterval);
            }
        }, 10000);
    }

    // Focus input
    chatInput.focus();
})();
