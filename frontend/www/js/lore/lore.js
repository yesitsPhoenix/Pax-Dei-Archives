// lore.js - Lore Wiki powered by Supabase
import { supabase } from '../supabaseClient.js';

// ── Markdown renderer ──────────────────────────────────────────
const renderMarkdown = (md) => {
    if (!md) return '';
    if (typeof marked === 'undefined') return `<p>${md}</p>`;
    return marked.parse(md);
};

// Strip HTML for previews
const stripHtml = (html) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
};

// ── URL helpers ───────────────────────────────────────────────
function getQueryParams() {
    const params = {};
    const qs = window.location.search.substring(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while ((m = regex.exec(qs))) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    return params;
}

function updateUrl(category, itemSlug = null) {
    const parts = [];
    if (category) parts.push(`category=${encodeURIComponent(category)}`);
    if (itemSlug) parts.push(`item=${encodeURIComponent(itemSlug)}`);
    const newUrl = 'lore.html' + (parts.length ? '?' + parts.join('&') : '');
    window.history.pushState({ category, item: itemSlug }, '', newUrl);
}

// ── Category icon mapping ──────────────────────────────────────
function getCategoryIcon(category) {
    switch (category) {
        case 'World':         return 'fa-earth-americas';
        case 'Divine':        return 'fa-star';
        case 'Factions':      return 'fa-users-gear';
        case 'Known Figures': return 'fa-user-tie';
        case 'Ages':          return 'fa-hourglass-half';
        case 'Redeemers':     return 'fa-hand-holding-heart';
        case 'Writings':      return 'fa-pen-nib';
        case 'Magic':         return 'fa-wand-magic-sparkles';
        case 'Geography':     return 'fa-mountain-sun';
        default:              return 'fa-book';
    }
}

// ── Supabase queries with caching ──────────────────────────────
let categoriesCache = null;
let itemsCache = {};
let itemDetailCache = {};
let allItemsCache = null;

async function fetchCategories() {
    if (categoriesCache) return categoriesCache;
    const { data, error } = await supabase
        .from('lore_items')
        .select('category')
        .order('category', { ascending: true });
    if (error) { console.error('Error fetching categories:', error); return []; }
    categoriesCache = [...new Set(data.map(r => r.category).filter(Boolean))];
    return categoriesCache;
}

async function fetchCategoryCounts() {
    const cats = await fetchCategories();
    const counts = {};
    for (const cat of cats) {
        const items = await fetchItemsByCategory(cat);
        counts[cat] = items.length;
    }
    return counts;
}

async function fetchItemsByCategory(category) {
    if (itemsCache[category]) return itemsCache[category];
    const { data, error } = await supabase
        .from('lore_items')
        .select('id, title, slug, sort_order, content, author, date')
        .eq('category', category)
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });
    if (error) { console.error('Error fetching items:', error); return []; }
    itemsCache[category] = data || [];
    return itemsCache[category];
}

async function fetchItemDetail(slug) {
    if (itemDetailCache[slug]) return itemDetailCache[slug];
    const { data, error } = await supabase
        .from('lore_items')
        .select('*')
        .eq('slug', slug)
        .single();
    if (error) { console.warn(`Lore item '${slug}' not found:`, error.message); return null; }
    itemDetailCache[slug] = data;
    return data;
}

async function fetchAllItems() {
    if (allItemsCache) return allItemsCache;
    const { data, error } = await supabase
        .from('lore_items')
        .select('id, title, slug, category')
        .order('category')
        .order('title');
    if (error) { console.error('Error fetching all items:', error); return []; }
    allItemsCache = data || [];
    return allItemsCache;
}

// ── Build Breadcrumbs ──────────────────────────────────────────
function renderBreadcrumbs(category, itemTitle) {
    const el = document.getElementById('lore-breadcrumbs');
    if (!el) return;

    let html = `<a href="lore.html" class="breadcrumb-link"><i class="fa-solid fa-book-open" style="margin-right: 4px;"></i>Lore</a>`;

    if (category) {
        html += `<span class="separator"><i class="fa-solid fa-chevron-right" style="font-size: 9px;"></i></span>`;
        html += `<a href="lore.html?category=${encodeURIComponent(category)}" class="breadcrumb-link">${category}</a>`;
    }

    if (itemTitle) {
        html += `<span class="separator"><i class="fa-solid fa-chevron-right" style="font-size: 9px;"></i></span>`;
        html += `<span class="current">${itemTitle}</span>`;
    }

    el.innerHTML = html;
}

// ── Build Sidebar ──────────────────────────────────────────────
async function buildSidebar(selectedCategory, selectedSlug) {
    const catList = document.getElementById('lore-category-list');
    const itemList = document.getElementById('lore-item-list');

    // Categories
    catList.innerHTML = '';
    const categories = await fetchCategories();
    categories.forEach(cat => {
        const active = selectedCategory === cat ? 'active-lore-category' : '';
        const icon = getCategoryIcon(cat);
        const li = document.createElement('li');
        li.innerHTML = `<a href="lore.html?category=${encodeURIComponent(cat)}" class="${active}"><i class="fa-solid ${icon}" style="width: 16px; margin-right: 6px; font-size: 11px; opacity: 0.6;"></i>${cat}</a>`;
        catList.appendChild(li);
    });

    // Items
    itemList.innerHTML = '';
    if (!selectedCategory) {
        itemList.innerHTML = '<li style="padding: 0.5rem 0.75rem; color: #4B5563; font-size: 13px;">Select a category</li>';
        return;
    }

    const items = await fetchItemsByCategory(selectedCategory);
    if (!items.length) {
        itemList.innerHTML = '<li style="padding: 0.5rem 0.75rem; color: #4B5563; font-size: 13px;">No entries found</li>';
        return;
    }

    items.forEach(item => {
        const active = selectedSlug === item.slug ? 'active-lore-item' : '';
        const li = document.createElement('li');
        li.innerHTML = `<a href="lore.html?category=${encodeURIComponent(selectedCategory)}&item=${encodeURIComponent(item.slug)}" class="${active}">${item.title}</a>`;
        itemList.appendChild(li);
    });
}

// ── Category Pill Bar ──────────────────────────────────────────
async function renderCategoryBar(selectedCategory) {
    const bar = document.getElementById('lore-category-bar');
    if (!bar) return;

    const categories = await fetchCategories();
    bar.innerHTML = '';

    categories.forEach(cat => {
        const icon = getCategoryIcon(cat);
        const active = selectedCategory === cat ? 'active' : '';
        const pill = document.createElement('a');
        pill.href = `lore.html?category=${encodeURIComponent(cat)}`;
        pill.className = `lore-category-pill ${active}`;
        pill.innerHTML = `<i class="fa-solid ${icon}"></i> ${cat}`;
        bar.appendChild(pill);
    });
}

// ── Build Infobox ──────────────────────────────────────────────
function buildInfobox(item) {
    const rows = [];

    if (item.titles)      rows.push({ label: 'Titles', value: renderMarkdown(item.titles) });
    if (item.association) rows.push({ label: 'Association', value: renderMarkdown(item.association) });
    if (item.author)      rows.push({ label: 'Author', value: renderMarkdown(item.author) });
    if (item.date)        rows.push({ label: 'Date', value: item.date });
    if (item.known_works) rows.push({ label: 'Known Works', value: renderMarkdown(item.known_works) });

    if (rows.length === 0) return '';

    const rowsHtml = rows.map(r =>
        `<div class="lore-infobox-row">
            <div class="lore-infobox-label">${r.label}</div>
            <div class="lore-infobox-value">${r.value}</div>
        </div>`
    ).join('');

    return `<div class="lore-infobox">
        <div class="lore-infobox-title">${item.title}</div>
        ${rowsHtml}
    </div>`;
}

// ── Build Cross References (manual from related_entries field) ──
async function buildCrossReferences(currentItem) {
    if (!currentItem.related_entries) return '';

    const slugs = currentItem.related_entries.split(',').map(s => s.trim()).filter(Boolean);
    if (slugs.length === 0) return '';

    const allItems = await fetchAllItems();
    const related = [];

    for (const slug of slugs) {
        const item = allItems.find(i => i.slug === slug);
        if (item) related.push(item);
    }

    if (related.length === 0) return '';

    const linksHtml = related.map(item => {
        const icon = getCategoryIcon(item.category);
        return `<a class="lore-see-also-link" href="lore.html?category=${encodeURIComponent(item.category)}&item=${encodeURIComponent(item.slug)}">
            <i class="fa-solid ${icon}"></i> ${item.title}
        </a>`;
    }).join('');

    return `<div class="lore-see-also">
        <h4><i class="fa-solid fa-link" style="margin-right: 6px;"></i>Related Entries</h4>
        <div class="lore-see-also-grid">${linksHtml}</div>
    </div>`;
}

// ── Render Category Landing Page ───────────────────────────────
async function renderCategoryLanding(category) {
    const main = document.getElementById('lore-content-area');
    const items = await fetchItemsByCategory(category);

    const cardsHtml = items.map(item => {
        const preview = item.content ? stripHtml(renderMarkdown(item.content)).substring(0, 120) + '...' : 'No content yet.';
        const meta = [];
        if (item.author) meta.push(item.author);
        if (item.date) meta.push(item.date);

        return `<a class="lore-entry-card" href="lore.html?category=${encodeURIComponent(category)}&item=${encodeURIComponent(item.slug)}">
            <h5>${item.title}</h5>
            <div class="entry-preview">${preview}</div>
            ${meta.length ? `<div class="entry-meta">${meta.join(' · ')}</div>` : ''}
        </a>`;
    }).join('');

    main.innerHTML = `
        <div class="lore-category-landing">
            <h3>${category}</h3>
            <div class="lore-category-count">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</div>
            <div class="lore-entry-cards">${cardsHtml}</div>
        </div>
    `;
}

// ── Render Article Detail ──────────────────────────────────────
async function renderArticle(slug, category) {
    const main = document.getElementById('lore-content-area');
    main.innerHTML = '<div class="lore-loading-indicator"><i class="fa-solid fa-spinner fa-spin"></i>Loading entry...</div>';

    const item = await fetchItemDetail(slug);

    if (!item) {
        main.innerHTML = '<div class="lore-no-content-message">Lore entry not found. Please select an entry from the sidebar.</div>';
        return;
    }

    // Infobox
    const infoboxHtml = buildInfobox(item);

    // Sources / research footer
    let footerHtml = '';
    if (item.sources || item.research) {
        footerHtml = `<div class="lore-article-footer">
            <h4><i class="fa-solid fa-scroll" style="margin-right: 6px;"></i>Sources & Research</h4>
            ${item.sources ? `<div class="footer-section">${renderMarkdown(item.sources)}</div>` : ''}
            ${item.research ? `<div class="footer-section"><strong>Research Notes:</strong><br>${renderMarkdown(item.research)}</div>` : ''}
        </div>`;
    }

    // Cross references (built async)
    const crossRefsHtml = await buildCrossReferences(item);

    main.innerHTML = `
        <div class="lore-article-header">
            <div class="lore-article-category"><i class="fa-solid ${getCategoryIcon(item.category)}" style="margin-right: 4px;"></i>${item.category}</div>
            <h2>${item.title}</h2>
        </div>
        <div class="lore-article-body">
            ${infoboxHtml}
            ${renderMarkdown(item.content || '')}
        </div>
        ${footerHtml}
        ${crossRefsHtml}
    `;
}

// ── Render Home (no category selected) ─────────────────────────
async function renderHome() {
    const main = document.getElementById('lore-content-area');
    const categories = await fetchCategories();
    const counts = await fetchCategoryCounts();

    const cardsHtml = categories.map(cat => {
        const icon = getCategoryIcon(cat);
        return `<a class="lore-home-card" href="lore.html?category=${encodeURIComponent(cat)}">
            <i class="fa-solid ${icon}"></i>
            <h5>${cat}</h5>
            <div class="card-count">${counts[cat] || 0} entries</div>
        </a>`;
    }).join('');

    main.innerHTML = `
        <div style="text-align: center; padding: 1rem 0;">
            <h2 style="font-size: 1.25rem; font-weight: 600; color: #6B7280; max-width: 500px; margin: 0 auto 1.5rem;">Select a category to explore the collected histories, writings, and figures of the world.</h2>
        </div>
        <div class="lore-home-cards">${cardsHtml}</div>
    `;
}

// ── Main Display Function ──────────────────────────────────────
async function displayLoreContent(category, slug) {
    const container = document.getElementById('lore-wiki-container');
    const breadcrumbs = document.getElementById('lore-breadcrumbs');

    // Always show the wiki container
    container.style.display = '';

    const topbar = document.getElementById('lore-topbar');

    if (!category && !slug) {
        // Home view — hide sidebar, show category cards in main area
        document.getElementById('lore-sidebar').style.display = 'none';
        if (topbar) topbar.style.display = 'none';
        if (breadcrumbs) breadcrumbs.style.display = 'none';
        await renderHome();
        return;
    }

    // Show sidebar and bar
    document.getElementById('lore-sidebar').style.display = '';
    if (topbar) topbar.style.display = '';
    if (breadcrumbs) breadcrumbs.style.display = '';

    // Build sidebar
    await buildSidebar(category, slug);
    await renderCategoryBar(category);

    if (category && !slug) {
        // Category landing page
        renderBreadcrumbs(category, null);
        await renderCategoryLanding(category);
    } else if (category && slug) {
        // Article detail
        const item = await fetchItemDetail(slug);
        renderBreadcrumbs(category, item ? item.title : slug);
        await renderArticle(slug, category);
    }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    const params = getQueryParams();
    const category = params.category || null;
    const slug = params.item || null;

    await displayLoreContent(category, slug);

    // Delegate all lore link clicks
    document.addEventListener('click', function (e) {
        const anchor = e.target.closest('a[href^="lore.html"]');
        if (anchor) {
            e.preventDefault();
            const url = new URL(anchor.getAttribute('href'), window.location.origin);
            const newCat = url.searchParams.get('category');
            const newSlug = url.searchParams.get('item');
            updateUrl(newCat, newSlug);
            displayLoreContent(newCat, newSlug);

            const scrollArea = document.getElementById('lore-content-area');
            if (scrollArea) scrollArea.scrollTop = 0;
        }
    });

    // Popstate (browser back/forward)
    window.onpopstate = async function () {
        const p = getQueryParams();
        await displayLoreContent(p.category || null, p.item || null);
    };

    // ── Smart Search ──────────────────────────────────────────
    const searchInput = document.getElementById('lore-search-input');
    const searchResults = document.getElementById('lore-search-results');

    if (searchInput && searchResults) {
        let searchDebounce = null;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            const query = searchInput.value.trim().toLowerCase();

            if (!query) {
                searchResults.innerHTML = '';
                searchResults.classList.remove('active');
                return;
            }

            searchDebounce = setTimeout(async () => {
                const allItems = await fetchAllItems();
                const matches = allItems.filter(item =>
                    item.title.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query)
                ).slice(0, 10);

                if (!matches.length) {
                    searchResults.innerHTML = '<div class="lore-search-no-results">No entries found</div>';
                    searchResults.classList.add('active');
                    return;
                }

                searchResults.innerHTML = matches.map(item => {
                    const icon = getCategoryIcon(item.category);
                    const idx = item.title.toLowerCase().indexOf(query);
                    const titleHighlighted = idx >= 0
                        ? item.title.slice(0, idx) + '<mark>' + item.title.slice(idx, idx + query.length) + '</mark>' + item.title.slice(idx + query.length)
                        : item.title;
                    return `<a class="lore-search-result-item" href="lore.html?category=${encodeURIComponent(item.category)}&item=${encodeURIComponent(item.slug)}">
                        <i class="fa-solid ${icon} lore-search-result-icon"></i>
                        <span class="lore-search-result-title">${titleHighlighted}</span>
                        <span class="lore-search-result-category">${item.category}</span>
                    </a>`;
                }).join('');

                searchResults.classList.add('active');
            }, 200);
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#lore-search-wrapper')) {
                searchResults.innerHTML = '';
                searchResults.classList.remove('active');
            }
        });

        // Clear on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                searchResults.innerHTML = '';
                searchResults.classList.remove('active');
            }
        });
    }
});
