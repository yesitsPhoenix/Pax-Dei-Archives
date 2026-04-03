export function setupLockedItemSelect({
    allItems,
    inputId,
    suggestionsId,
    categorySelectId = null,
    onSelect = null,
    minSearchLength = 3
}) {
    const searchInput = document.getElementById(inputId);
    const dropdown = document.getElementById(suggestionsId);
    if (!searchInput || !dropdown) return null;

    let selectedItem = null;
    let filteredItems = allItems;
    let highlightIndex = -1;

    dropdown.innerHTML = '';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '9999';
    dropdown.style.maxHeight = '220px';
    dropdown.style.overflowY = 'auto';

    const renderList = (items) => {
        dropdown.innerHTML = '';
        highlightIndex = -1;
        if (items.length === 0) {
            const noResult = document.createElement('div');
            noResult.className = 'autocomplete-no-results';
            noResult.textContent = 'No items found';
            dropdown.appendChild(noResult);
            return;
        }

        items.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion-item';
            const query = searchInput.value.trim();
            if (query) {
                const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escaped})`, 'gi');
                div.innerHTML = item.item_name.replace(regex, '<strong>$1</strong>');
            } else {
                div.textContent = item.item_name;
            }
            div.addEventListener('mousedown', (event) => {
                event.preventDefault();
                selectItem(item);
            });
            dropdown.appendChild(div);
        });
    };

    const selectItem = (item) => {
        selectedItem = item;
        searchInput.value = item.item_name;
        searchInput.dataset.selectedItemId = item.item_id;
        searchInput.dataset.selectedPaxDeiSlug = item.pax_dei_slug || '';
        searchInput.dataset.selectedItemCategory = item.category_id || '';
        const catSelect = categorySelectId ? document.getElementById(categorySelectId) : null;
        if (catSelect) catSelect.value = String(item.category_id);
        dropdown.style.display = 'none';
        if (onSelect) onSelect(item);
    };

    const clearSelection = () => {
        selectedItem = null;
        delete searchInput.dataset.selectedItemId;
        delete searchInput.dataset.selectedPaxDeiSlug;
        delete searchInput.dataset.selectedItemCategory;
    };

    const openDropdown = () => {
        const query = searchInput.value.trim().toLowerCase();
        filteredItems = query
            ? allItems.filter(item => item.item_name.toLowerCase().includes(query))
            : allItems;
        renderList(filteredItems);
        dropdown.style.display = 'block';
    };

    const setHighlight = (idx) => {
        const items = dropdown.querySelectorAll('.autocomplete-suggestion-item');
        items.forEach((el) => el.classList.remove('highlighted'));
        if (idx >= 0 && idx < items.length) {
            items[idx].classList.add('highlighted');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
        highlightIndex = idx;
    };

    searchInput.addEventListener('input', () => {
        clearSelection();
        if (searchInput.value.trim().length >= minSearchLength) {
            openDropdown();
        } else {
            dropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= minSearchLength) openDropdown();
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.style.display = 'none';
            if (!selectedItem || searchInput.value !== selectedItem.item_name) {
                const exact = allItems.find((item) => item.item_name.toLowerCase() === searchInput.value.toLowerCase());
                if (exact) {
                    selectItem(exact);
                } else {
                    searchInput.value = selectedItem ? selectedItem.item_name : '';
                }
            }
        }, 150);
    });

    searchInput.addEventListener('keydown', (event) => {
        const visibleItems = dropdown.querySelectorAll('.autocomplete-suggestion-item');
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight(Math.min(highlightIndex + 1, visibleItems.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight(Math.max(highlightIndex - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (highlightIndex >= 0 && filteredItems[highlightIndex]) {
                selectItem(filteredItems[highlightIndex]);
            } else if (filteredItems.length === 1) {
                selectItem(filteredItems[0]);
            }
        } else if (event.key === 'Escape') {
            dropdown.style.display = 'none';
            searchInput.value = selectedItem ? selectedItem.item_name : '';
        }
    });

    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.style.display = 'none';
        }
    });

    return {
        selectItem,
        clearSelection
    };
}
