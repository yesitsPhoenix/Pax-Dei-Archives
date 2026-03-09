import { supabase } from './supabaseClient.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const FETCH_PAGE_SIZE = 1000; // Supabase row limit per request

// ── State ─────────────────────────────────────────────────────────────────────

let allItems       = [];   // full fetched dataset
let categories     = [];   // [{category_id, category_name}]
let filteredItems  = [];   // result after applying current filters
let currentPage    = 1;
let selectedIds    = new Set();

// ── DOM Refs ──────────────────────────────────────────────────────────────────

const statTotal          = document.getElementById('stat-total');
const statUncategorized  = document.getElementById('stat-uncategorized');
const statCategorized    = document.getElementById('stat-categorized');
const searchInput        = document.getElementById('search-input');
const filterStatus       = document.getElementById('filter-status');
const filterCategory     = document.getElementById('filter-category');
const btnClearSearch     = document.getElementById('btn-clear-search');
const selectAllCheckbox  = document.getElementById('select-all-checkbox');
const selectedCount      = document.getElementById('selected-count');
const bulkCategorySelect = document.getElementById('bulk-category-select');
const btnBulkApply       = document.getElementById('btn-bulk-apply');
const tableLoader        = document.getElementById('table-loader');
const itemsTable         = document.getElementById('items-table');
const itemsTbody         = document.getElementById('items-tbody');
const tableEmpty         = document.getElementById('table-empty');
const paginationEl       = document.getElementById('pagination');

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchAllItems() {
    const results = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('items')
            .select('item_id, item_name, category_id')
            .order('item_name', { ascending: true })
            .range(from, from + FETCH_PAGE_SIZE - 1);

        if (error) throw error;
        results.push(...(data || []));
        if (!data || data.length < FETCH_PAGE_SIZE) break;
        from += FETCH_PAGE_SIZE;
    }

    return results;
}

async function fetchCategories() {
    const { data, error } = await supabase
        .from('item_categories')
        .select('category_id, category_name')
        .order('category_name', { ascending: true });

    if (error) throw error;
    return data || [];
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function updateStats() {
    const total        = allItems.length;
    const uncategorized = allItems.filter(i => i.category_id === null).length;
    const categorized  = total - uncategorized;

    statTotal.textContent         = total.toLocaleString();
    statUncategorized.textContent = uncategorized.toLocaleString();
    statCategorized.textContent   = categorized.toLocaleString();
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function applyFilters() {
    const search   = searchInput.value.trim().toLowerCase();
    const status   = filterStatus.value;       // 'null' | 'categorized' | 'all'
    const catId    = filterCategory.value;     // '' or category_id string

    filteredItems = allItems.filter(item => {
        if (search && !item.item_name.toLowerCase().includes(search)) return false;

        if (status === 'null'       && item.category_id !== null) return false;
        if (status === 'categorized' && item.category_id === null) return false;

        if (catId !== '' && String(item.category_id) !== catId) return false;

        return true;
    });

    currentPage = 1;
    selectedIds.clear();
    selectAllCheckbox.checked = false;
    renderTable();
    renderPagination();
    updateSelectedCount();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function getCategoryName(categoryId) {
    if (categoryId === null) return null;
    const cat = categories.find(c => c.category_id === categoryId);
    return cat ? cat.category_name : `Unknown (${categoryId})`;
}

function renderTable() {
    const start    = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(start, start + PAGE_SIZE);

    tableLoader.classList.add('hidden');

    if (filteredItems.length === 0) {
        itemsTable.classList.add('hidden');
        tableEmpty.classList.remove('hidden');
        return;
    }

    tableEmpty.classList.add('hidden');
    itemsTable.classList.remove('hidden');

    itemsTbody.innerHTML = pageItems.map(item => {
        const catName  = getCategoryName(item.category_id);
        const isNull   = item.category_id === null;
        const checked  = selectedIds.has(item.item_id) ? 'checked' : '';

        const currentBadge = isNull
            ? `<span class="text-red-400 text-xs italic">None</span>`
            : `<span class="text-green-400 text-xs">${catName}</span>`;

        const categoryOptions = categories.map(cat =>
            `<option value="${cat.category_id}" ${item.category_id === cat.category_id ? 'selected' : ''}>${cat.category_name}</option>`
        ).join('');

        return `
        <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors" data-item-id="${item.item_id}">
            <td class="px-4 py-2 text-center">
                <input type="checkbox" class="row-checkbox rounded text-violet-600 w-4 h-4 cursor-pointer" data-id="${item.item_id}" ${checked}>
            </td>
            <td class="px-4 py-2 text-gray-500 text-xs">${item.item_id}</td>
            <td class="px-4 py-2 text-white text-sm font-medium">${item.item_name}</td>
            <td class="px-4 py-2">${currentBadge}</td>
            <td class="px-4 py-2">
                <select class="category-select bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-xs w-full outline-none focus:border-violet-500 transition-colors" data-id="${item.item_id}">
                    <option value="">— Select —</option>
                    ${categoryOptions}
                </select>
            </td>
            <td class="px-4 py-2 text-right">
                <button class="save-btn bg-violet-700 hover:bg-violet-600 text-white text-xs px-3 py-1 rounded transition-colors" data-id="${item.item_id}">
                    Save
                </button>
            </td>
        </tr>`;
    }).join('');

    attachRowListeners();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
    paginationEl.innerHTML = '';

    if (totalPages <= 1) return;

    const makeBtn = (label, page, disabled, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = [
            'px-3 py-1 rounded text-sm transition-colors',
            active   ? 'bg-violet-600 text-white font-bold'            : '',
            disabled ? 'bg-gray-800 text-gray-600 cursor-not-allowed'  : (!active ? 'bg-gray-700 hover:bg-gray-600 text-white' : ''),
        ].filter(Boolean).join(' ');
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', () => { currentPage = page; renderTable(); renderPagination(); });
        return btn;
    };

    paginationEl.appendChild(makeBtn('«', 1, currentPage === 1));
    paginationEl.appendChild(makeBtn('‹', currentPage - 1, currentPage === 1));

    // Page window
    const window_size = 5;
    let startPage = Math.max(1, currentPage - Math.floor(window_size / 2));
    let endPage   = Math.min(totalPages, startPage + window_size - 1);
    if (endPage - startPage < window_size - 1) startPage = Math.max(1, endPage - window_size + 1);

    for (let p = startPage; p <= endPage; p++) {
        paginationEl.appendChild(makeBtn(String(p), p, false, p === currentPage));
    }

    paginationEl.appendChild(makeBtn('›', currentPage + 1, currentPage === totalPages));
    paginationEl.appendChild(makeBtn('»', totalPages, currentPage === totalPages));

    const info = document.createElement('span');
    info.className = 'text-gray-500 text-xs ml-2';
    info.textContent = `${filteredItems.length} items`;
    paginationEl.appendChild(info);
}

// ── Row Event Listeners ───────────────────────────────────────────────────────

function attachRowListeners() {
    // Individual save buttons
    itemsTbody.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', () => handleSingleSave(parseInt(btn.dataset.id)));
    });

    // Row checkboxes
    itemsTbody.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = parseInt(cb.dataset.id);
            if (cb.checked) {
                selectedIds.add(id);
            } else {
                selectedIds.delete(id);
                selectAllCheckbox.checked = false;
            }
            updateSelectedCount();
        });
    });
}

function updateSelectedCount() {
    selectedCount.textContent = `${selectedIds.size} selected`;
}

// ── Save Operations ───────────────────────────────────────────────────────────

async function handleSingleSave(itemId) {
    const row    = itemsTbody.querySelector(`tr[data-item-id="${itemId}"]`);
    const select = row?.querySelector('.category-select');
    const saveBtn = row?.querySelector('.save-btn');

    if (!select || select.value === '') {
        flashBtn(saveBtn, 'error');
        return;
    }

    const newCategoryId = parseInt(select.value);

    saveBtn.disabled    = true;
    saveBtn.textContent = '...';

    const { error } = await supabase
        .from('items')
        .update({ category_id: newCategoryId })
        .eq('item_id', itemId);

    if (error) {
        console.error('Save failed for item', itemId, error);
        flashBtn(saveBtn, 'error');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save';
        return;
    }

    // Update local data
    const item = allItems.find(i => i.item_id === itemId);
    if (item) item.category_id = newCategoryId;

    flashBtn(saveBtn, 'success');
    updateStats();

    // Refresh the current badge in the row
    const catCell = row.querySelector('td:nth-child(4)');
    const catName = getCategoryName(newCategoryId);
    if (catCell) catCell.innerHTML = `<span class="text-green-400 text-xs">${catName}</span>`;

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save';
}

async function handleBulkApply() {
    const newCategoryId = parseInt(bulkCategorySelect.value);
    if (!newCategoryId || selectedIds.size === 0) return;

    btnBulkApply.disabled    = true;
    btnBulkApply.textContent = 'Saving...';

    const ids = [...selectedIds];
    const { error } = await supabase
        .from('items')
        .update({ category_id: newCategoryId })
        .in('item_id', ids);

    if (error) {
        console.error('Bulk save failed:', error);
        btnBulkApply.disabled    = false;
        btnBulkApply.innerHTML   = '<i class="fas fa-tag mr-1"></i> Apply to Selected';
        return;
    }

    // Update local data for all affected items
    ids.forEach(id => {
        const item = allItems.find(i => i.item_id === id);
        if (item) item.category_id = newCategoryId;
    });

    selectedIds.clear();
    selectAllCheckbox.checked = false;
    updateSelectedCount();
    updateStats();
    applyFilters(); // Re-render with updated data

    btnBulkApply.disabled  = false;
    btnBulkApply.innerHTML = '<i class="fas fa-tag mr-1"></i> Apply to Selected';
}

function flashBtn(btn, type) {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = type === 'success' ? '✓' : '✗';
    btn.style.backgroundColor = type === 'success' ? '#059669' : '#dc2626';
    setTimeout(() => {
        btn.textContent = original;
        btn.style.backgroundColor = '';
    }, 1200);
}

// ── Dropdowns ─────────────────────────────────────────────────────────────────

function populateCategoryDropdowns() {
    const makeOptions = (includeBlank = true) =>
        (includeBlank ? '<option value="">All Categories</option>' : '') +
        categories.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join('');

    filterCategory.innerHTML     = makeOptions(true);
    bulkCategorySelect.innerHTML = '<option value="">— Assign category —</option>' +
        categories.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        [allItems, categories] = await Promise.all([fetchAllItems(), fetchCategories()]);

        populateCategoryDropdowns();
        updateStats();
        applyFilters();

    } catch (err) {
        console.error('categorize_items init error:', err);
        tableLoader.innerHTML = `<p class="text-red-400 text-sm">Failed to load items: ${err.message}</p>`;
    }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

searchInput.addEventListener('input', applyFilters);
filterStatus.addEventListener('change', applyFilters);
filterCategory.addEventListener('change', applyFilters);

btnClearSearch.addEventListener('click', () => {
    searchInput.value    = '';
    filterStatus.value   = 'null';
    filterCategory.value = '';
    applyFilters();
});

selectAllCheckbox.addEventListener('change', () => {
    const start     = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(start, start + PAGE_SIZE);
    pageItems.forEach(item => {
        if (selectAllCheckbox.checked) {
            selectedIds.add(item.item_id);
        } else {
            selectedIds.delete(item.item_id);
        }
    });
    itemsTbody.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    updateSelectedCount();
});

btnBulkApply.addEventListener('click', handleBulkApply);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

init();
