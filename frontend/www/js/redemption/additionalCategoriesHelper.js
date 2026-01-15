/**
 * Additional Categories Helper
 * Manages the UI and logic for selecting additional categories for quests
 */

export function createAdditionalCategoriesUI(categories, currentPrimaryCategory, existingAdditionalCategories = []) {
    const container = document.createElement('div');
    container.id = 'additional-categories-container';
    container.className = 'space-y-3';

    const header = document.createElement('div');
    header.innerHTML = `
        <label class="block text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">
            Additional Categories
            <span class="text-gray-500 font-normal ml-2">(Quest will appear in multiple categories)</span>
        </label>
        <div class="text-xs text-gray-500 mb-3 italic">
            Select categories where this quest should also appear. It will count toward completion in all selected categories.
        </div>
    `;
    container.appendChild(header);

    // Search box
    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.id = 'additional-cat-search';
    searchBox.placeholder = 'Search categories...';
    searchBox.className = 'w-full bg-[#374151] border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-[#FFD700] outline-none mb-3';
    container.appendChild(searchBox);

    // List container with scrolling
    const listContainer = document.createElement('div');
    listContainer.id = 'additional-cat-list';
    listContainer.className = 'max-h-64 overflow-y-auto space-y-1 border border-gray-700 rounded-lg p-3 bg-[#1f2937]';
    container.appendChild(listContainer);

    // Selected count badge
    const badge = document.createElement('div');
    badge.id = 'additional-cat-badge';
    badge.className = 'mt-2 text-xs text-[#FFD700] font-bold';
    container.appendChild(badge);

    // Render categories
    const renderCategories = (filter = '') => {
        const filteredCategories = categories.filter(cat => {
            // Don't show the primary category
            if (cat.name === currentPrimaryCategory) return false;
            // Apply search filter
            if (filter && !cat.name.toLowerCase().includes(filter.toLowerCase())) return false;
            return true;
        });

        listContainer.innerHTML = filteredCategories.map(cat => {
            const isChecked = existingAdditionalCategories.includes(cat.name);
            return `
                <label class="flex items-center space-x-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                    <input 
                        type="checkbox" 
                        name="additional-category" 
                        value="${cat.name}" 
                        ${isChecked ? 'checked' : ''}
                        class="w-4 h-4 rounded border-gray-700 text-[#FFD700] focus:ring-[#FFD700] bg-gray-900"
                    >
                    <span class="text-sm text-gray-300">${cat.name}</span>
                </label>
            `;
        }).join('');

        updateBadge();
    };

    // Update selected count badge
    const updateBadge = () => {
        const selected = Array.from(document.querySelectorAll('input[name="additional-category"]:checked'));
        if (selected.length > 0) {
            badge.textContent = `${selected.length} additional ${selected.length === 1 ? 'category' : 'categories'} selected`;
            badge.classList.remove('text-gray-500');
            badge.classList.add('text-[#FFD700]');
        } else {
            badge.textContent = 'No additional categories selected';
            badge.classList.remove('text-[#FFD700]');
            badge.classList.add('text-gray-500');
        }
    };

    // Event listeners
    searchBox.addEventListener('input', (e) => {
        renderCategories(e.target.value);
    });

    // Listen for checkbox changes
    listContainer.addEventListener('change', updateBadge);

    // Initial render
    renderCategories();

    return container;
}

export function getSelectedAdditionalCategories() {
    return Array.from(document.querySelectorAll('input[name="additional-category"]:checked'))
        .map(cb => cb.value);
}

export function updateAdditionalCategoriesForPrimaryChange(categories, newPrimaryCategory) {
    const container = document.getElementById('additional-categories-container');
    if (!container) return;

    // Get currently selected additional categories
    const currentlySelected = getSelectedAdditionalCategories();
    
    // Remove the new primary category from additional if it was selected
    const updatedSelection = currentlySelected.filter(cat => cat !== newPrimaryCategory);
    
    // Re-render the UI
    const newUI = createAdditionalCategoriesUI(categories, newPrimaryCategory, updatedSelection);
    container.replaceWith(newUI);
}
