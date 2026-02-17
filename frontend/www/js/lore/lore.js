// lore.js - reads from Supabase lore_items table
import { supabase } from '../supabaseClient.js';

// ── Markdown renderer ──────────────────────────────────────────────
const renderMarkdown = (md) => {
    if (typeof marked === 'undefined') return `<p>${md}</p>`;
    return marked.parse(md);
};

// ── URL helpers ───────────────────────────────────────────────────
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

// ── Supabase queries ───────────────────────────────────────────────
let categoriesCache = null;
let itemsCache = {};     // { [category]: items[] }
let itemDetailCache = {}; // { [slug]: item }

async function fetchCategories() {
    if (categoriesCache) return categoriesCache;
    const { data, error } = await supabase
        .from('lore_items')
        .select('category')
        .order('category', { ascending: true });
    if (error) { console.error('Error fetching categories:', error); return []; }
    const unique = [...new Set(data.map(r => r.category).filter(Boolean))];
    categoriesCache = unique;
    return unique;
}

async function fetchItemsByCategory(category) {
    if (itemsCache[category]) return itemsCache[category];
    const { data, error } = await supabase
        .from('lore_items')
        .select('id, title, slug, sort_order')
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

// ── Category icon mapping ──────────────────────────────────────────
function getCategoryIcon(category) {
    switch (category) {
        case 'World':        return 'fa-earth-americas';
        case 'Divine':       return 'fa-star';
        case 'Factions':     return 'fa-users-gear';
        case 'Known Figures':return 'fa-user-tie';
        case 'Ages':         return 'fa-hourglass-half';
        case 'Redeemers':    return 'fa-hand-holding-heart';
        case 'Writings':     return 'fa-pen-nib';
        case 'Magic':        return 'fa-wand-magic-sparkles';
        case 'Geography':    return 'fa-mountain-sun';
        default:             return 'fa-book';
    }
}

// ── Render small category cards ────────────────────────────────────
async function renderSmallCategoryCards(selectedCategory = null) {
    const container = $('#small-lore-category-cards');
    container.empty();
    const categories = await fetchCategories();
    categories.forEach(cat => {
        const icon = getCategoryIcon(cat);
        const active = selectedCategory === cat ? 'active-small-card' : '';
        container.append(`
            <div class="col-auto">
                <div class="feature-card small-feature-card ${active}">
                    <a href="lore.html?category=${encodeURIComponent(cat)}">
                        <i class="fa-solid ${icon}"></i>
                        <h5>${cat}</h5>
                    </a>
                </div>
            </div>
        `);
    });
}

// ── Build sidebar category list ────────────────────────────────────
async function buildSidebarCategories(selectedCategory) {
    const list = $('#lore-category-list');
    list.empty();
    const categories = await fetchCategories();
    if (!categories.length) { list.append('<li>No categories found.</li>'); return; }
    categories.forEach(cat => {
        const active = selectedCategory === cat ? 'active-lore-category' : '';
        list.append(`<li><a href="lore.html?category=${encodeURIComponent(cat)}" class="${active}">${cat}</a></li>`);
    });
}

// ── Build sidebar items list ───────────────────────────────────────
async function buildSidebarItems(category, selectedSlug) {
    const list = $('#lore-item-list');
    list.empty();
    if (!category) { list.append('<li>Select a category.</li>'); return; }
    const items = await fetchItemsByCategory(category);
    if (!items.length) { list.append('<li>No entries in this category.</li>'); return; }
    items.forEach(item => {
        const active = selectedSlug === item.slug ? 'active-lore-item' : '';
        list.append(`<li><a href="lore.html?category=${encodeURIComponent(category)}&item=${encodeURIComponent(item.slug)}" class="${active}">${item.title}</a></li>`);
    });
}

// ── Render main content area ───────────────────────────────────────
async function renderMainContent(category, slug) {
    const main = $('#dynamic-lore-main-content');
    main.empty();

    if (!slug) {
        main.html(`
            <div class="lore-item-header">
                <h4>${category ? category + ' Archives' : 'Lore Archives'}</h4>
            </div>
            <div class="lore-no-content-message">
                ${category ? 'Select an entry from the "Entries" sidebar to view its content.' : '<h3>Welcome to the Lore Archives.</h3><p>Please select a category to begin exploring the world\'s history.</p>'}
            </div>
        `);
        return;
    }

    main.html('<div class="lore-loading-indicator">Loading entry...</div>');
    const item = await fetchItemDetail(slug);

    if (!item) {
        main.html('<div class="lore-no-content-message">Lore entry not found. Please select an entry from the list.</div>');
        return;
    }

    // Build meta section
    let metaHtml = '';
    if (item.author)      metaHtml += `<p><strong>Author:</strong> ${item.author}</p>`;
    if (item.titles)      metaHtml += `<p><strong>Titles:</strong> ${item.titles}</p>`;
    if (item.association) metaHtml += `<p><strong>Association:</strong> ${item.association}</p>`;
    if (item.date)        metaHtml += `<p><strong>Date:</strong> ${item.date}</p>`;
    if (item.known_works) metaHtml += `<p><strong>Known Works:</strong> ${renderMarkdown(item.known_works)}</p>`;

    // Build sources/research footer
    let footerHtml = '';
    if (item.sources || item.research) {
        footerHtml = `
            <div class="lore-item-footer">
                <h5>Sources & Research Notes</h5>
                ${item.sources  ? `<p><strong>Source(s):</strong> ${renderMarkdown(item.sources)}</p>` : ''}
                ${item.research ? `<p><strong>Future Research/Notes/Cross References:</strong> ${renderMarkdown(item.research)}</p>` : ''}
            </div>
        `;
    }

    main.html(`
        <div class="lore-item-header">
            <h4>${item.title}</h4>
            ${metaHtml ? `<div class="lore-meta">${metaHtml}</div>` : ''}
        </div>
        <div class="lore-item-content">
            ${renderMarkdown(item.content || '')}
        </div>
        ${footerHtml}
    `);
}

// ── Main display function ──────────────────────────────────────────
async function displayLoreContent(category, slug = null) {
    const categoriesSection = $('#lore-categories-section');
    const contentWrapper    = $('#dynamic-lore-content-wrapper');

    if (!category && !slug) {
        categoriesSection.show();
        contentWrapper.hide();
        $('#small-lore-category-cards').empty();
        return;
    }

    categoriesSection.hide();
    contentWrapper.show();

    await Promise.all([
        buildSidebarCategories(category),
        buildSidebarItems(category, slug),
        renderMainContent(category, slug),
        renderSmallCategoryCards(category)
    ]);
}

// ── On DOM ready ──────────────────────────────────────────────────
$(document).ready(async function() {
    const params = getQueryParams();
    let category = params.category || null;
    let slug = params.item || null;

    // If we have a category but no slug, load the first item
    if (category && !slug) {
        const items = await fetchItemsByCategory(category);
        if (items.length > 0) {
            slug = items[0].slug;
            updateUrl(category, slug);
        }
    }

    await displayLoreContent(category, slug);

    // ── Populate main category cards dynamically (if empty) ──────
    // The hardcoded cards in lore.html still work; this adds any new categories
    const categoriesSection = document.getElementById('lore-categories-section');
    if (categoriesSection) {
        const existingCategories = [...categoriesSection.querySelectorAll('.feature-card a')].map(a => {
            const url = new URL(a.href, window.location.origin);
            return url.searchParams.get('category');
        });
        const allCats = await fetchCategories();
        const missing = allCats.filter(c => !existingCategories.includes(c));
        if (missing.length > 0) {
            const row = categoriesSection.querySelector('.row');
            if (row) {
                missing.forEach(cat => {
                    const icon = getCategoryIcon(cat);
                    const col = document.createElement('div');
                    col.className = 'col-lg-2 col-md-4 col-sm-6';
                    col.innerHTML = `
                        <div class="feature-card">
                            <a href="lore.html?category=${encodeURIComponent(cat)}">
                                <i class="fa-solid ${icon}"></i>
                                <h5>${cat}</h5>
                            </a>
                        </div>
                    `;
                    row.appendChild(col);
                });
            }
        }
    }

    // ── Click handlers ────────────────────────────────────────────
    async function handleCategoryClick(e, anchor) {
        e.preventDefault();
        const href = anchor.getAttribute('href');
        const url = new URL(href, window.location.origin);
        const newCat = url.searchParams.get('category');
        let newSlug = null;

        // Invalidate items cache for fresh load
        delete itemsCache[newCat];
        const items = await fetchItemsByCategory(newCat);
        if (items.length > 0) newSlug = items[0].slug;

        updateUrl(newCat, newSlug);
        displayLoreContent(newCat, newSlug);
    }

    $(document).on('click', '#lore-categories-section .feature-card a', function(e) {
        handleCategoryClick(e, this);
    });

    $(document).on('click', '#small-lore-category-cards .feature-card a, #lore-category-list a', function(e) {
        handleCategoryClick(e, this);
    });

    $(document).on('click', '#lore-item-list a', async function(e) {
        e.preventDefault();
        const url = new URL($(this).attr('href'), window.location.origin);
        const newCat  = url.searchParams.get('category');
        const newSlug = url.searchParams.get('item');
        updateUrl(newCat, newSlug);
        displayLoreContent(newCat, newSlug);
    });

    // ── Popstate (browser back/forward) ───────────────────────────
    window.onpopstate = async function() {
        const p = getQueryParams();
        if (!p.category && !p.item) {
            displayLoreContent(null, null);
            return;
        }
        let cat  = p.category || null;
        let slug = p.item || null;
        if (cat && !slug) {
            const items = await fetchItemsByCategory(cat);
            if (items.length > 0) slug = items[0].slug;
        }
        displayLoreContent(cat, slug);
    };
});
