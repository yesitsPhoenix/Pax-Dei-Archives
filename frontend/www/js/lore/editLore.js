// editLore.js
import { supabase } from '../supabaseClient.js';

// ── State ─────────────────────────────────────────────────────────
let allItems = [];       // all lore items from Supabase
let filteredItems = [];  // currently displayed in sidebar
let currentItem = null;  // the item being edited (null = new)
let categories = [];     // distinct categories
let activeCatFilter = 'all';
let currentTab = 'edit';

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllItems();
});

async function loadAllItems() {
    const { data, error } = await supabase
        .from('lore_items')
        .select('id, title, slug, category, author, date, titles, association, known_works, sources, research, sort_order, content, created_at, updated_at')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });

    if (error) {
        console.error('Error loading lore items:', error);
        showToast('Failed to load lore entries: ' + error.message, 'error');
        return;
    }

    allItems = data || [];
    categories = [...new Set(allItems.map(i => i.category))].filter(Boolean).sort();
    filteredItems = [...allItems];

    buildCategoryFilters();
    buildCategoryDatalist();
    renderList(filteredItems);

    // Check for ?id= in URL (edit specific item)
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    const editSlug = params.get('slug');
    if (editId || editSlug) {
        const match = allItems.find(i => (editId && i.id === editId) || (editSlug && i.slug === editSlug));
        if (match) selectItem(match);
    }
}

// ── Sidebar / List ─────────────────────────────────────────────────
function buildCategoryFilters() {
    const container = document.getElementById('cat-filters');
    // Keep 'All' button, remove others
    const existing = container.querySelectorAll('[data-cat]:not([data-cat="all"])');
    existing.forEach(el => el.remove());

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.dataset.cat = cat;
        btn.textContent = cat;
        btn.onclick = () => setCatFilter(cat, btn);
        container.appendChild(btn);
    });
}

function buildCategoryDatalist() {
    const dl = document.getElementById('category-datalist');
    dl.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        dl.appendChild(opt);
    });
}

window.setCatFilter = function(cat, btn) {
    activeCatFilter = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterList();
};

window.filterList = function() {
    const search = document.getElementById('sidebar-search').value.trim().toLowerCase();
    filteredItems = allItems.filter(item => {
        const catMatch = activeCatFilter === 'all' || item.category === activeCatFilter;
        const searchMatch = !search ||
            item.title.toLowerCase().includes(search) ||
            (item.slug && item.slug.toLowerCase().includes(search)) ||
            (item.author && item.author.toLowerCase().includes(search));
        return catMatch && searchMatch;
    });
    renderList(filteredItems);
};

function renderList(items) {
    const listEl = document.getElementById('lore-list');
    if (items.length === 0) {
        listEl.innerHTML = '<div class="p-4 text-gray-500 text-sm text-center">No entries found.</div>';
        return;
    }

    listEl.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'lore-list-item' + (currentItem?.id === item.id ? ' active' : '');
        div.id = `list-item-${item.id}`;
        div.innerHTML = `
            <div class="item-title">${item.title}</div>
            <div class="item-cat">${item.category || '—'}</div>
        `;
        div.onclick = () => selectItem(item);
        listEl.appendChild(div);
    });
}

// ── Select / Load item ─────────────────────────────────────────────
async function selectItem(item) {
    currentItem = item;

    // Update sidebar active state
    document.querySelectorAll('.lore-list-item').forEach(el => el.classList.remove('active'));
    const listEl = document.getElementById(`list-item-${item.id}`);
    if (listEl) {
        listEl.classList.add('active');
        listEl.scrollIntoView({ block: 'nearest' });
    }

    // Populate form
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('edit-form').classList.remove('hidden');

    document.getElementById('form-title').textContent = 'Edit: ' + item.title;
    document.getElementById('entry-id-badge').textContent = 'ID: ' + item.id.substring(0, 8) + '…';
    document.getElementById('entry-id-badge').classList.remove('hidden');

    const viewLink = document.getElementById('view-link');
    viewLink.href = `lore.html?category=${encodeURIComponent(item.category)}&item=${encodeURIComponent(item.slug)}`;
    viewLink.classList.remove('hidden');

    document.getElementById('field-title').value = item.title || '';
    document.getElementById('field-slug').value = item.slug || '';
    document.getElementById('field-category').value = item.category || '';
    document.getElementById('field-author').value = item.author || '';
    document.getElementById('field-date').value = item.date || '';
    document.getElementById('field-titles').value = item.titles || '';
    document.getElementById('field-association').value = item.association || '';
    document.getElementById('field-known-works').value = item.known_works || '';
    document.getElementById('field-sources').value = item.sources || '';
    document.getElementById('field-research').value = item.research || '';
    document.getElementById('field-sort-order').value = item.sort_order ?? 0;
    document.getElementById('field-content').value = item.content || '';

    updateMetaFields();
    updatePreview();

    document.getElementById('delete-btn').classList.remove('hidden');
    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i> Save Changes';

    // Update URL without reload
    window.history.replaceState({}, '', `edit_lore.html?slug=${encodeURIComponent(item.slug)}`);
}

// ── New item ──────────────────────────────────────────────────────
window.newItem = function() {
    currentItem = null;

    document.querySelectorAll('.lore-list-item').forEach(el => el.classList.remove('active'));

    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('edit-form').classList.remove('hidden');
    document.getElementById('entry-id-badge').classList.add('hidden');
    document.getElementById('view-link').classList.add('hidden');
    document.getElementById('form-title').textContent = 'New Lore Entry';
    document.getElementById('delete-btn').classList.add('hidden');

    document.getElementById('field-title').value = '';
    document.getElementById('field-slug').value = '';
    document.getElementById('field-category').value = '';
    document.getElementById('field-author').value = '';
    document.getElementById('field-date').value = '';
    document.getElementById('field-titles').value = '';
    document.getElementById('field-association').value = '';
    document.getElementById('field-known-works').value = '';
    document.getElementById('field-sources').value = '';
    document.getElementById('field-research').value = '';
    document.getElementById('field-sort-order').value = 0;
    document.getElementById('field-content').value = '';

    updateMetaFields();
    updatePreview();

    document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i> Create Entry';
    window.history.replaceState({}, '', 'edit_lore.html');
    document.getElementById('field-title').focus();
};

window.clearForm = function() {
    currentItem = null;
    document.querySelectorAll('.lore-list-item').forEach(el => el.classList.remove('active'));
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('edit-form').classList.add('hidden');
    window.history.replaceState({}, '', 'edit_lore.html');
};

// ── Auto-slug from title ──────────────────────────────────────────
window.autoSlug = function() {
    if (currentItem) return; // Don't auto-slug when editing existing
    const title = document.getElementById('field-title').value;
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    document.getElementById('field-slug').value = slug;
};

// ── Show/hide meta fields based on category ───────────────────────
window.updateMetaFields = function() {
    const cat = document.getElementById('field-category').value.toLowerCase().trim();
    const figureFields = document.getElementById('meta-figure-fields');
    const isKnownFigure = cat === 'known figures';
    if (isKnownFigure) {
        figureFields.classList.remove('hidden');
    } else {
        figureFields.classList.add('hidden');
    }
};

// ── Markdown preview ──────────────────────────────────────────────
window.updatePreview = function() {
    const md = document.getElementById('field-content').value;
    const html = typeof marked !== 'undefined' ? marked.parse(md) : `<p>${md}</p>`;
    document.getElementById('preview-render').innerHTML = html;

    // Sync split mode if active
    if (currentTab === 'split') {
        const splitContent = document.getElementById('field-content-split');
        if (splitContent && splitContent.value !== md) splitContent.value = md;
        document.getElementById('preview-render-split').innerHTML = html;
    }
};

window.syncSplit = function() {
    const md = document.getElementById('field-content-split').value;
    document.getElementById('field-content').value = md;
    const html = typeof marked !== 'undefined' ? marked.parse(md) : `<p>${md}</p>`;
    document.getElementById('preview-render-split').innerHTML = html;
    document.getElementById('preview-render').innerHTML = html;
};

window.switchTab = function(tab) {
    currentTab = tab;

    document.getElementById('tab-edit').classList.remove('active');
    document.getElementById('tab-preview').classList.remove('active');
    document.getElementById('tab-split').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    document.getElementById('edit-mode').classList.add('hidden');
    document.getElementById('preview-mode').classList.add('hidden');
    document.getElementById('split-mode').classList.add('hidden');
    document.getElementById('split-mode').style.display = 'none';

    if (tab === 'edit') {
        document.getElementById('edit-mode').classList.remove('hidden');
    } else if (tab === 'preview') {
        updatePreview();
        document.getElementById('preview-mode').classList.remove('hidden');
    } else if (tab === 'split') {
        const md = document.getElementById('field-content').value;
        document.getElementById('field-content-split').value = md;
        updatePreview();
        document.getElementById('split-mode').classList.remove('hidden');
        document.getElementById('split-mode').style.display = 'grid';
    }
};

// ── Save ──────────────────────────────────────────────────────────
window.saveItem = async function() {
    const title    = document.getElementById('field-title').value.trim();
    const slug     = document.getElementById('field-slug').value.trim();
    const category = document.getElementById('field-category').value.trim();
    const content  = document.getElementById('field-content').value;

    if (!title || !slug || !category) {
        showToast('Title, slug, and category are required.', 'error');
        return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
        showToast('Slug must only contain lowercase letters, numbers, and hyphens.', 'error');
        return;
    }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...';

    const payload = {
        title,
        slug,
        category,
        content,
        author:      document.getElementById('field-author').value.trim() || null,
        date:        document.getElementById('field-date').value.trim() || null,
        titles:      document.getElementById('field-titles').value.trim() || null,
        association: document.getElementById('field-association').value.trim() || null,
        known_works: document.getElementById('field-known-works').value.trim() || null,
        sources:     document.getElementById('field-sources').value.trim() || null,
        research:    document.getElementById('field-research').value.trim() || null,
        sort_order:  parseInt(document.getElementById('field-sort-order').value) || 0,
        updated_at:  new Date().toISOString()
    };

    try {
        let result;
        if (currentItem) {
            // Update
            const { data, error } = await supabase
                .from('lore_items')
                .update(payload)
                .eq('id', currentItem.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
            showToast('Entry updated successfully!', 'success');
        } else {
            // Insert
            const { data, error } = await supabase
                .from('lore_items')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            result = data;
            showToast('Entry created successfully!', 'success');
        }

        // Update local state
        if (currentItem) {
            const idx = allItems.findIndex(i => i.id === currentItem.id);
            if (idx !== -1) allItems[idx] = { ...allItems[idx], ...result };
        } else {
            allItems.push(result);
        }

        currentItem = result;
        categories = [...new Set(allItems.map(i => i.category))].filter(Boolean).sort();
        buildCategoryFilters();
        buildCategoryDatalist();
        filterList();

        document.getElementById('entry-id-badge').textContent = 'ID: ' + result.id.substring(0, 8) + '…';
        document.getElementById('entry-id-badge').classList.remove('hidden');
        document.getElementById('view-link').href = `lore.html?category=${encodeURIComponent(result.category)}&item=${encodeURIComponent(result.slug)}`;
        document.getElementById('view-link').classList.remove('hidden');
        document.getElementById('form-title').textContent = 'Edit: ' + result.title;
        document.getElementById('delete-btn').classList.remove('hidden');
        document.getElementById('save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-2"></i> Save Changes';
        window.history.replaceState({}, '', `edit_lore.html?slug=${encodeURIComponent(result.slug)}`);

    } catch (err) {
        console.error('Save error:', err);
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
    }
};

// ── Delete ──────────────────────────────────────────────────────
window.confirmDelete = function() {
    if (!currentItem) return;
    document.getElementById('delete-title').textContent = currentItem.title;
    document.getElementById('confirm-modal').classList.remove('hidden');
};

window.deleteItem = async function() {
    if (!currentItem) return;
    document.getElementById('confirm-modal').classList.add('hidden');

    const { error } = await supabase
        .from('lore_items')
        .delete()
        .eq('id', currentItem.id);

    if (error) {
        showToast('Delete failed: ' + error.message, 'error');
        return;
    }

    allItems = allItems.filter(i => i.id !== currentItem.id);
    categories = [...new Set(allItems.map(i => i.category))].filter(Boolean).sort();
    buildCategoryFilters();
    buildCategoryDatalist();
    filterList();
    clearForm();
    showToast('Entry deleted.', 'success');
};

// ── Toast ──────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}
