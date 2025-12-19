import { supabase } from './supabaseClient.js';
const STATIC_DATA_URL = 'backend/data/json/StaticDataBundle.json';
const LOCALIZATION_URL = 'backend/data/json/localisation_en.json';
let allItemData = [];
let allCategories = new Set();

window.copyRow = function(name, jsonKey, stackSize, btn) {
    const textToCopy = `${name}\t${stackSize}\t\t${jsonKey}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = '#4b5563';
        }, 1500);
    });
};

const showAccessDeniedModal = () => {
    const modal = document.getElementById('accessDeniedModal');
    const countdownElement = document.getElementById('redirectCountdown');
    let countdown = 5;

    modal.classList.remove('hidden');

    countdownElement.textContent = `Redirecting to Market Trends in ${countdown} seconds...`;

    const interval = setInterval(() => {
        countdown -= 1;
        countdownElement.textContent = `Redirecting to Market Trends in ${countdown} seconds...`;
        if (countdown <= 0) {
            clearInterval(interval);
            window.location.href = 'trends.html';
        }
    }, 1000);
};

const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        showAccessDeniedModal();
        return false;
    }

    const userId = session.user.id;
    
    const { data: permissions, error } = await supabase
        .from('listings_permissions')
        .select('permitted')
        .eq('user_id', userId)
        .eq('permitted', true) 
        .single();

    if (error && error.code !== 'PGRST116') {
        showAccessDeniedModal();
        return false;
    }

    if (!permissions) {
        showAccessDeniedModal();
        return false;
    }
    
    return true;
};

function processStaticData(staticData, localizationMap) {
    const processedItems = [];

    if (!staticData || !staticData.static_data) {
        return processedItems;
    }

    for (const dataTypeKey in staticData.static_data) {
        const items = staticData.static_data[dataTypeKey];

        for (const itemKey in items) {
            const item = items[itemKey];

            if (item.IsDev === true) {
                continue;
            }

            const isExcludedCategory = item.Categories && item.Categories.some(cat => 
                cat.includes('Slot') ||
                cat.startsWith('Category.Weapons') ||
                cat.startsWith('Category.Tools') ||
                cat.startsWith('Category.Shields')
            );
            
            if (isExcludedCategory) {
                continue;
            }

            if (item.Categories && item.Categories.length > 0 && item.LocalizationNameKey && typeof item.MaxStackSize === 'number') {
                const rawCategory = item.Categories[0].split('.');
                const category = rawCategory.length > 2 ? rawCategory[2] : rawCategory[rawCategory.length - 1];
                
                const localizationKey = item.LocalizationNameKey;
                const itemName = localizationMap[localizationKey] || localizationKey;
                const maxStackSize = item.MaxStackSize;

                allCategories.add(category.toUpperCase());

                processedItems.push({
                    category: category.toUpperCase(),
                    name: itemName,
                    jsonKey: localizationKey,
                    stackSize: maxStackSize
                });
            }
        }
    }
    return processedItems;
}

function groupItems(items) {
    return items.reduce((acc, item) => {
        const category = item.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});
}

function renderFilterOptions() {
    const filterSelect = document.getElementById('category-filter');
    filterSelect.innerHTML = '<option value="all">Filter by Category (All)</option>';

    const sortedCategories = Array.from(allCategories).sort();

    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterSelect.appendChild(option);
    });
}

window.applyFiltersAndRender = function() {
    const selectedCategory = document.getElementById('category-filter').value;
    const searchTerm = document.getElementById('item-search').value.toLowerCase();
    
    let filteredItems = allItemData;

    if (selectedCategory !== 'all') {
        filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    }
    
    if (searchTerm.length >= 3) {
        filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(searchTerm));
    }

    const grouped = groupItems(filteredItems);
    renderArchives(grouped);
}

function renderArchives(groupedItems) {
    const container = document.getElementById('archives-container');
    container.innerHTML = '';

    if (Object.keys(groupedItems).length === 0) {
        container.innerHTML = '<p class="text-gray-300 text-center">No stackable items found for this filter.</p>';
        return;
    }

    const sortedCategories = Object.keys(groupedItems).sort();

    sortedCategories.forEach(category => {
        const section = document.createElement('div');
        section.className = 'category-section mb-6 p-4 bg-gray-800 rounded-lg shadow-xl';
        section.innerHTML = `<h2>${category}</h2>`;

        const list = document.createElement('div');
        list.className = 'item-list';

        const headerRow = document.createElement('div');
        headerRow.className = 'item-row item-header';
        headerRow.innerHTML = `
            <span>Item Name</span>
            <span>JSON Value</span>
            <span class="text-center">Max Stack Size</span>
            <span class="text-right">Copy</span>
        `;
        list.appendChild(headerRow);

        groupedItems[category].sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'item-row';
            
            itemRow.innerHTML = `
                <strong class="text-gray-200">${item.name}</strong>
                <code class="text-gray-400 break-all">${item.jsonKey}</code>
                <span class="stack-size">${item.stackSize}</span>
                <div class="text-right">
                    <button class="copy-btn" onclick="copyRow('${item.name.replace(/'/g, "\\'")}', '${item.jsonKey}', '${item.stackSize}', this)">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
            list.appendChild(itemRow);
        });

        section.appendChild(list);
        container.appendChild(section);
    });
}

async function loadDataAndRender() {
    const container = document.getElementById('archives-container');
    
    const isAuthenticated = await checkAdminAuth();
    if (!isAuthenticated) {
        container.innerHTML = '<p class=\"text-red-400 text-center\">Authentication failed. Access denied.</p>';
        return;
    }

    try {
        const [staticResponse, localizationResponse] = await Promise.all([
            fetch(STATIC_DATA_URL),
            fetch(LOCALIZATION_URL)
        ]);

        if (!staticResponse.ok) {
            container.innerHTML = `<p class="text-red-400 text-center">Error loading static data: ${staticResponse.status} ${staticResponse.statusText}.</p>`;
            return;
        }
        if (!localizationResponse.ok) {
            container.innerHTML = `<p class="text-red-400 text-center">Error loading localization data: ${localizationResponse.status} ${localizationResponse.statusText}.</p>`;
            return;
        }

        const staticData = await staticResponse.json();
        const localizationData = await localizationResponse.json();

        allItemData = processStaticData(staticData, localizationData);
        
        renderFilterOptions();
        applyFiltersAndRender();

    } catch (error) {
        container.innerHTML = `<p class="text-red-400 text-center">Failed to fetch data from the backend. Check console for details. Ensure files are at <code class="bg-gray-800 p-1 rounded">backend/data/json/</code>.</p>`;
        console.error('Fetch error:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadDataAndRender);