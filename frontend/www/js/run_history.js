import { supabase } from './supabaseClient.js';
import { FARMING_CATEGORIES, GATHERING_TOOLS } from './gatheringConstants.js';

const formatTime = (totalMilliseconds) => {
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const formatRatePerHour = (amount, totalMilliseconds) => {
    const totalSeconds = totalMilliseconds / 1000;
    if (totalSeconds <= 0) {
        return 'N/A';
    }
    const totalHours = totalSeconds / 3600;
    const rate = amount / totalHours;

    return Math.round(rate).toLocaleString();
};

const filterItemName = document.getElementById('filterItemName');
const filterCategory = document.getElementById('filterCategory');
const filterToolName = document.getElementById('filterToolName');
const filterMiracleStatus = document.getElementById('filterMiracleStatus');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const runResultsBody = document.getElementById('runResultsBody');

const categorySearchResults = document.getElementById('categorySearchResults');
const itemSearchResults = document.getElementById('itemSearchResults');
const toolSearchResults = document.getElementById('toolSearchResults');
const customItemModal = document.getElementById('customItemModal');
const customItemInput = document.getElementById('customItemInput');
const customItemSaveBtn = document.getElementById('customItemSaveBtn');
const customItemCancelBtn = document.getElementById('customItemCancelBtn');


function openCustomItemModal() {
    if (customItemInput) customItemInput.value = '';
    if (customItemModal) customItemModal.classList.remove('hidden');
    if (customItemInput) customItemInput.focus();
}

function closeCustomItemModal() {
    if (customItemModal) customItemModal.classList.add('hidden');
}


function filterCategoryResults(event) {
    if (!categorySearchResults) return;

    const isTyping = event && event.type === 'input';
    const query = isTyping ? filterCategory.value.toLowerCase() : '';

    categorySearchResults.innerHTML = '';

    const categories = Object.keys(FARMING_CATEGORIES);
    const results = query
        ? categories.filter(category => category.toLowerCase().includes(query))
        : categories;

    if (results.length > 0) {
        results.forEach(category => {
            const resultItem = document.createElement('div');
            resultItem.textContent = category;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                filterCategory.value = category;
                categorySearchResults.classList.add('hidden');
                
                filterItemName.value = '';
                filterToolName.value = '';

                filterItemSearchResults();
                filterToolSearchResults();
            });
            categorySearchResults.appendChild(resultItem);
        });
        categorySearchResults.classList.remove('hidden');
    } else {
        categorySearchResults.classList.add('hidden');
    }
}


function filterItemSearchResults() {
    if (!itemSearchResults) return;
    
    const category = filterCategory.value.trim();
    const query = filterItemName.value.toLowerCase();
    itemSearchResults.innerHTML = '';

    if (!category || !FARMING_CATEGORIES[category]) {
        itemSearchResults.classList.add('hidden');
        return;
    }
    
    const items = FARMING_CATEGORIES[category];
    const results = query
        ? items.filter(item => item.toLowerCase().includes(query))
        : items; 

    if (results.length > 0) {
        results.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.textContent = item;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                if (item === 'Other') {
                    if (customItemModal) openCustomItemModal();
                } else {
                    filterItemName.value = item;
                }
                itemSearchResults.classList.add('hidden');
            });
            itemSearchResults.appendChild(resultItem);
        });
        itemSearchResults.classList.remove('hidden');
    } else {
        itemSearchResults.classList.add('hidden');
    }
}

function filterToolSearchResults() {
    if (!toolSearchResults) return;

    const category = filterCategory.value.trim();
    const query = filterToolName.value.toLowerCase();
    toolSearchResults.innerHTML = '';

    if (!category || !GATHERING_TOOLS[category]) {
        toolSearchResults.classList.add('hidden');
        return;
    }
    
    const tools = GATHERING_TOOLS[category];
    const results = query
        ? tools.filter(tool => tool.toLowerCase().includes(query))
        : tools; 

    if (results.length > 0) {
        results.forEach(tool => {
            const resultItem = document.createElement('div');
            resultItem.textContent = tool;
            resultItem.className = 'p-2 cursor-pointer hover:bg-gray-600 text-white';
            resultItem.addEventListener('click', () => {
                filterToolName.value = tool;
                toolSearchResults.classList.add('hidden');
            });
            toolSearchResults.appendChild(resultItem);
        });
        toolSearchResults.classList.remove('hidden');
    } else {
        toolSearchResults.classList.add('hidden');
    }
}

if (customItemSaveBtn && customItemInput) {
    customItemSaveBtn.addEventListener('click', () => {
        const val = customItemInput.value.trim();
        if (val) {
            filterItemName.value = val;
            closeCustomItemModal();
        }
    });
}

if (customItemCancelBtn) {
    customItemCancelBtn.addEventListener('click', closeCustomItemModal);
}


const fetchDataAndRender = async () => {
    let query = supabase
        .from('farming_runs') 
        .select('*')
        .order('created_at', { ascending: false }); 

    const itemName = filterItemName.value.trim();
    const category = filterCategory.value.trim();
    const toolName = filterToolName.value.trim();
    const miracleStatus = filterMiracleStatus.value;

    if (category) {
        query = query.ilike('category', `%${category}%`);
    }
    if (itemName) {
        query = query.ilike('item', `%${itemName}%`); 
    }
    if (toolName) {
        query = query.ilike('tool_used', `%${toolName}%`);
    }
    if (miracleStatus) {
        const isActive = miracleStatus === 'active';
        query = query.eq('miracle_active', isActive);
    }

    runResultsBody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 whitespace-nowrap text-sm text-yellow-400 text-center">Fetching runs...</td></tr>';

    const { data: runs, error } = await query;

    if (error) {
        console.error('Error fetching runs:', error.message);
        runResultsBody.innerHTML = `<tr><td colspan="9" class="px-3 py-4 whitespace-nowrap text-sm text-red-400 text-center">Error loading runs: ${error.message}. (Check Supabase RLS/Auth)</td></tr>`;
        return;
    }

    renderRunTable(runs);
};

const renderRunTable = (runs) => {
    if (runs.length === 0) {
        runResultsBody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 whitespace-nowrap text-sm text-gray-400 text-center">No runs found matching your criteria.</td></tr>';
        return;
    }

    runResultsBody.innerHTML = '';

    runs.forEach(run => {
        const date = new Date(run.created_at).toLocaleDateString(); 
        const timeFormatted = formatTime(run.time_ms); 
        const ratePerHour = formatRatePerHour(run.amount, run.time_ms); 
        const miracleDisplay = run.miracle_active ? '<span class="text-green-400">Yes</span>' : 'No';

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-700 transition duration-150 ease-in-out';
        row.innerHTML = `
            <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-white">${run.run_name || 'N/A'}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-white">${run.item}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-white">${run.category}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-white">${run.tool_used}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-yellow-400 font-mono">${timeFormatted}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-green-400 font-bold">${run.amount.toLocaleString()}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-blue-400 font-bold">${ratePerHour}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-400">${date}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-center">${miracleDisplay}</td>
        `;
        runResultsBody.appendChild(row);
    });
};

const handleApplyFilters = () => {
    fetchDataAndRender();
};

const handleClearFilters = () => {
    filterItemName.value = '';
    filterCategory.value = '';
    filterToolName.value = '';
    filterMiracleStatus.value = '';
    fetchDataAndRender();
};

filterCategory.addEventListener('input', filterCategoryResults);
filterCategory.addEventListener('focus', filterCategoryResults);
filterItemName.addEventListener('input', filterItemSearchResults);
filterItemName.addEventListener('focus', filterItemSearchResults);
filterToolName.addEventListener('input', filterToolSearchResults);
filterToolName.addEventListener('focus', filterToolSearchResults);


document.addEventListener('click', (e) => {
    if (filterCategory && !filterCategory.contains(e.target) && categorySearchResults && !categorySearchResults.contains(e.target)) {
        categorySearchResults.classList.add('hidden');
    }
    if (filterItemName && !filterItemName.contains(e.target) && itemSearchResults && !itemSearchResults.contains(e.target)) {
        itemSearchResults.classList.add('hidden');
    }
    if (filterToolName && !filterToolName.contains(e.target) && toolSearchResults && !toolSearchResults.contains(e.target)) {
        toolSearchResults.classList.add('hidden');
    }
});


applyFiltersBtn.addEventListener('click', handleApplyFilters);
clearFiltersBtn.addEventListener('click', handleClearFilters);

filterItemName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleApplyFilters();
    }
});
filterCategory.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleApplyFilters();
    }
});
filterToolName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleApplyFilters();
    }
});

document.addEventListener('DOMContentLoaded', fetchDataAndRender);