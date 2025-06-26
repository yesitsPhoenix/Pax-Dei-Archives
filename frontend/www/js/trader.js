import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter, setCurrentCharacterContext } from './modules/characters.js';
import { initializeSales, loadTransactionHistory, handleDownloadCsv } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderSalesChart, setupSalesChartListeners } from './modules/salesChart.js';

let currentUser = null;
let allCharacterActivityData = [];

const CACHE_BASE_URL = 'https://homecraftlodge.serveminecraft.net/cache'; 

export const get_from_quart_cache = async (key) => {
    try {
        const response = await fetch(`${CACHE_BASE_URL}/get/${key}`);

        if (response.status === 503) {
            console.error(`🚨 Cache service (GET) unavailable: ${response.status} - ${await response.text()}`);
            return null;
        }

        if (response.status === 404) {
            return null; 
        }

        const data = await response.json();

        if (response.ok) {
            if (data.status === "success") {
                try {
                    return JSON.parse(data.value);
                } catch (e) {
                    return data.value;
                }
            } else if (data.status === "cache_miss") {
                return null;
            } else if (data.status === "error") {
                console.error(`🚨 Cache service (GET) error for key '${key}': ${data.message || 'Unknown error from Quart app'}`);
                return null;
            } else {
                console.error(`🚨 Unexpected response status from cache service for GET '${key}':`, data);
                return null;
            }
        } else {
            console.warn(`⚠️ Unexpected HTTP status for '${key}': ${response.status} - ${data.message || await response.text()}`);
            return null;
        }
    } catch (e) {
        console.error(`🚨 Could not connect to cache service (GET): ${e}.`);
        return null; 
    }
};

export const set_in_quart_cache = async (key, value, ttl = 300) => { 
    try {
        const response = await fetch(`${CACHE_BASE_URL}/set`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, value: JSON.stringify(value), ttl }) 
        });

        const data = await response.json();

        if (response.status === 503) {
            console.error(`🚨 Cache service (SET) unavailable: ${data.message || 'Service Unavailable'}.`);
            return false;
        }

        if (response.ok && data.status === "success") {
            return true;
        } else {
            console.warn(`⚠️ Failed to set cache for key '${key}': ${data.message || response.status + ' - ' + await response.text()}`);
            return false;
        }
    } catch (e) {
        console.error(`🚨 Could not connect to cache service (SET): ${e}.`);
        return false;
    }
};

export const invalidate_quart_cache = async (key) => {
    try {
        const response = await fetch(`${CACHE_BASE_URL}/delete/${key}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.status === 503) {
            console.error(`🚨 Cache service (DELETE) unavailable: ${data.message || 'Service Unavailable'}.`);
            return false;
        }

        if (response.ok) {
            return true;
        } else {
            console.warn(`⚠️ Failed to invalidate cache for key '${key}': ${data.message || response.status + ' - ' + await response.text()}`);
            return false;
        }
    } catch (e) {
        console.error(`🚨 Could not connect to cache service (INVALIDATE): ${e}.`);
        return false;
    }
};

export const invalidateDashboardStatsCache = async (characterId) => {
    if (characterId) {
        const cacheKey = `pax_dashboard_stats:${characterId}`;
        await invalidate_quart_cache(cacheKey);
    }
};

export const invalidateTransactionHistoryCache = async (characterId) => {
    if (characterId) {
        const cacheKey = `pax_transactions:${characterId}`;
        await invalidate_quart_cache(cacheKey);
        await invalidate_quart_cache(`pax_daily_avg_sale_price:${characterId}`);
        await invalidate_quart_cache(`pax_daily_total_sales:${characterId}`);
        await invalidate_quart_cache(`pax_highest_sale:${characterId}`);
        await invalidate_quart_cache(`pax_most_sold_qty:${characterId}`);
        await invalidate_quart_cache(`pax_sales_vol_cat:${characterId}`);
        await invalidate_quart_cache(`pax_top_profit:${characterId}`);
    }
};

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        const modalId = `customModal-${Date.now()}`;
        const modalHtml = `
                <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                        <h3 class="text-xl font-bold mb-4 text-gray-800">${title}</h3>
                        <p class="mb-6 text-gray-700">${message}</p>
                        <div class="flex justify-end gap-3">
                            ${buttons.map(btn => `
                                <button class="px-4 py-2 rounded-full font-bold
                                    ${btn.type === 'confirm' ? 'bg-blue-500 hover:bg-blue-700 text-white' : ''}
                                    ${btn.type === 'cancel' ? 'bg-gray-500 hover:bg-gray-700 text-white' : ''}
                                    ${!btn.type ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' : ''}"
                                    data-value="${btn.value}">${btn.text}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        modalElement.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                const value = button.dataset.value === 'true' ? true : (button.dataset.value === 'false' ? false : button.dataset.value);
                modalElement.remove();
                resolve(value);
            });
        });
    });
};

const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');

async function fetchAllCharacterActivity(characterId) {
    if (!characterId) return [];

    const cacheKey = `pax_transactions:${characterId}`;
    
    const cachedData = await get_from_quart_cache(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    const { data: combinedActivity, error: combinedError } = await supabase.rpc('get_all_character_activity_json', { p_character_id: characterId });

    if (combinedError) {
        console.error('Error fetching combined character activity:', combinedError);
        return [];
    }

    const allTransactions = [];

    if (combinedActivity) {
        const { sales, purchases, cancellations, listing_fees, pve_transactions } = combinedActivity;

        if (sales) {
            sales.forEach(sale => allTransactions.push(sale));
        }
        if (purchases) {
            purchases.forEach(purchase => allTransactions.push(purchase));
        }
        if (cancellations) {
            cancellations.forEach(listing => allTransactions.push(listing));
        }
        if (listing_fees) {
            listing_fees.forEach(listing => allTransactions.push(listing));
        }
        if (pve_transactions) {
            pve_transactions.forEach(pve => allTransactions.push(pve));
        }
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    await set_in_quart_cache(cacheKey, allTransactions, 180); 
    
    return allTransactions;
}

const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const traderLoginContainer = document.getElementById('traderLoginContainer');
    const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
    if (user) {
        currentUser = user;
        setCurrentCharacterContext(currentUser.id, null);
        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'none';
        }
        insertCharacterModalHtml();
        await initializeCharacters(currentUser.id, async () => {
            await loadTraderPageData();
        });
        initializeListings(currentUser.id);
        initializeSales();
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'block';
        }

    } else {
        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'block';
        }
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'none';
        }
    }
};

export const loadTraderPageData = async () => {
    if (!currentUser || !currentUser.id || !currentCharacterId) {
        renderDashboard({}, null);
        await loadActiveListings();
        loadTransactionHistory([]);
        renderSalesChart([], 'daily');
        return;
    }

    try {
        const currentCharacterData = await getCurrentCharacter(true); 
        allCharacterActivityData = await fetchAllCharacterActivity(currentCharacterId);

        const dashboardStatsCacheKey = `pax_dashboard_stats:${currentCharacterId}`;
        let dashboardStats = await get_from_quart_cache(dashboardStatsCacheKey);

        if (!dashboardStats) {
            const { data, error } = await supabase.rpc('get_character_dashboard_stats', { p_character_id: currentCharacterId });

            if (error) {
                throw error;
            }
            dashboardStats = data ? data[0] : {};
            await set_in_quart_cache(dashboardStatsCacheKey, dashboardStats, 300); 
        }
        
        renderDashboard(dashboardStats, currentCharacterData);
        await loadActiveListings();
        loadTransactionHistory(allCharacterActivityData);
        renderSalesChart(allCharacterActivityData, 'daily');

        await loadDailyAverageSalePrice(currentCharacterId);
        await loadDailyTotalSales(currentCharacterId);
        await loadHighestIndividualSale(currentCharacterId);
        await loadMostItemsSoldByQuantity(currentCharacterId);
        await loadSalesVolumeByCategory(currentCharacterId);
        await loadTopProfitableItems(currentCharacterId);
        
    } catch (error) {
        await showCustomModal('Error', 'Failed to load trader data: ' + error.message, [{ text: 'OK', value: true }]);
    }
};

const addPageEventListeners = () => {
    if (showCreateCharacterModalBtn) {
        showCreateCharacterModalBtn.addEventListener('click', () => {
            const createCharacterModal = document.getElementById('createCharacterModal');
            if (createCharacterModal) {
                createCharacterModal.classList.remove('hidden');
            }
        });
    }
    if (traderDiscordLoginButton) {
        traderDiscordLoginButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + '/Pax-Dei-Archives/ledger.html'
                }
            });
            if (error) {
                if (traderLoginError) {
                    traderLoginError.textContent = 'Login failed: ' + error.message;
                    traderLoginError.style.display = 'block';
                }
            }
        });
    }
    setupSalesChartListeners(() => allCharacterActivityData);
};

async function populateItemData() {
    const cacheKey = 'pax_all_items_dropdown';
    let allItems = await get_from_quart_cache(cacheKey);

    if (!allItems) {
        try {
            const { data, error } = await supabase.rpc('get_all_items_for_dropdown');

            if (error) {
                console.error('Error fetching all items for dropdown:', error.message);
                return;
            }

            allItems = data || [];
            await set_in_quart_cache(cacheKey, allItems, 3600 * 24); 
        } catch (err) {
            console.error('Error during populateItemData:', err);
            return;
        }
    }
    initializeAutocomplete(allItems);
}


export async function loadDailyAverageSalePrice(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_daily_avg_sale_price:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_daily_average_sale_price');
    if (error) { console.error('Error fetching daily average sale price:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}

export async function loadDailyTotalSales(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_daily_total_sales:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_daily_total_sales');
    if (error) { console.error('Error fetching daily total sales:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}

export async function loadHighestIndividualSale(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_highest_sale:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_highest_individual_sale', { top_n_sales: 5 }); 
    if (error) { console.error('Error fetching highest individual sale:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}

export async function loadMostItemsSoldByQuantity(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_most_sold_qty:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_most_items_sold_by_quantity', { top_n_items: 10 }); 
    if (error) { console.error('Error fetching most items sold by quantity:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}

export async function loadSalesVolumeByCategory(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_sales_vol_cat:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_sales_volume_by_category', { top_n_categories: 5 }); 
    if (error) { console.error('Error fetching sales volume by category:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}

export async function loadTopProfitableItems(characterId) {
    if (!characterId) return [];
    const cacheKey = `pax_top_profit:${characterId}`;
    let data = await get_from_quart_cache(cacheKey);
    if (data) return data;

    const { data: supabaseData, error } = await supabase.rpc('get_top_profitable_items', { top_n_items: 5 }); 
    if (error) { console.error('Error fetching top profitable items:', error.message); return []; }
    data = supabaseData || [];
    await set_in_quart_cache(cacheKey, data, 600); 
    return data;
}


function setupCustomAutocomplete(inputElement, suggestionsContainerElement, dataArray, selectionCallback) {
    let currentFocus = -1;
    let filteredData = [];

    function showSuggestions() {
        if (suggestionsContainerElement.children.length > 0) {
            suggestionsContainerElement.style.display = 'block';
        } else {
            suggestionsContainerElement.style.display = 'none';
        }
    }

    function hideSuggestions() {
        suggestionsContainerElement.style.display = 'none';
        currentFocus = -1;
    }

    function renderSuggestions(items) {
        suggestionsContainerElement.innerHTML = '';
        filteredData = items;

        if (items.length === 0 && inputElement.value.length > 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.classList.add('autocomplete-no-results');
            noResultsDiv.innerHTML = `No results found for "<strong>${inputElement.value}</strong>"`;
            suggestionsContainerElement.appendChild(noResultsDiv);
        } else {
            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('autocomplete-suggestion-item');
                const match = new RegExp(inputElement.value, 'gi');
                itemDiv.innerHTML = item.item_name.replace(match, '<strong>$&</strong>');

                itemDiv.dataset.itemId = item.item_id;
                itemDiv.dataset.itemCategory = item.category_id;
                itemDiv.dataset.paxDeiSlug = item.pax_dei_slug;
                itemDiv.dataset.itemName = item.item_name;

                itemDiv.addEventListener('click', function() {
                    selectionCallback(item);
                    hideSuggestions();
                });
                suggestionsContainerElement.appendChild(itemDiv);
            });
        }
        showSuggestions();
    }

    function filterItems(inputValue) {
        const lowerCaseInput = inputValue.toLowerCase();
        return dataArray.filter(item =>
            item.item_name.toLowerCase().includes(lowerCaseInput)
        ).sort((a, b) => {
            const nameA = a.item_name.toLowerCase();
            const nameB = b.item_name.toLowerCase();
            if (nameA === lowerCaseInput) return -1;
            if (nameB === lowerCaseInput) return 1;
            if (nameA.startsWith(lowerCaseInput) && !nameB.startsWith(lowerCaseInput)) return 1;
            if (!nameA.startsWith(lowerCaseInput) && nameB.startsWith(lowerCaseInput)) return -1;
            return nameA.localeCompare(b.item_name.toLowerCase());
        });
    }

    inputElement.addEventListener('input', function() {
        const val = this.value;
        if (val.length === 0) {
            hideSuggestions();
            delete this.dataset.selectedItemId;
            delete this.dataset.selectedPaxDeiSlug;
            delete this.dataset.selectedItemCategory;
            return;
        }

        const filtered = filterItems(val);
        renderSuggestions(filtered);
    });

    inputElement.addEventListener('keydown', function(e) {
        let x = suggestionsContainerElement.getElementsByClassName('autocomplete-suggestion-item');
        if (e.keyCode == 40) {
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) {
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) {
            e.preventDefault();
            if (currentFocus > -1 && x[currentFocus]) {
                x[currentFocus].click();
            } else if (filteredData.length === 1 && inputElement.value.toLowerCase() === filteredData[0].item_name.toLowerCase()) {
                selectionCallback(filteredData[0]);
                hideSuggestions();
            }
        } else if (e.keyCode == 27) {
            hideSuggestions();
        }
    });

    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add('highlighted');
        x[currentFocus].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove('highlighted');
        }
    }

    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !suggestionsContainerElement.contains(e.target)) {
            hideSuggestions();
        }
    });

    inputElement.addEventListener('blur', function() {
        const exactMatch = dataArray.find(item => item.item_name.toLowerCase() === this.value.toLowerCase());
        if (exactMatch) {
            selectionCallback(exactMatch);
        } else {
            delete this.dataset.selectedItemId;
            delete this.dataset.selectedPaxDeiSlug;
            delete this.dataset.selectedItemCategory;
        }
        setTimeout(() => hideSuggestions(), 150);
    });
}

function initializeAutocomplete(allItems) {
    const itemNameInput = document.getElementById('item-name');
    const itemNameSuggestions = document.getElementById('item-name-suggestions');

    if (itemNameInput && itemNameSuggestions) {
        setupCustomAutocomplete(itemNameInput, itemNameSuggestions, allItems, (selectedItem) => {
            itemNameInput.value = selectedItem.item_name;
            const categorySelect = document.getElementById('item-category');
            if (categorySelect) {
                categorySelect.value = selectedItem.category_id;
            }
            itemNameInput.dataset.selectedItemId = selectedItem.item_id;
            itemNameInput.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
            itemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
        });
    }

    const purchaseItemNameInput = document.getElementById('purchase-item-name');
    const purchaseItemNameSuggestions = document.getElementById('purchase-item-name-suggestions');

    if (purchaseItemNameInput && purchaseItemNameSuggestions) {
        setupCustomAutocomplete(purchaseItemNameInput, purchaseItemNameSuggestions, allItems, (selectedItem) => {
            purchaseItemNameInput.value = selectedItem.item_name;
            const categorySelect = document.getElementById('purchase-item-category');
            if (categorySelect) {
                categorySelect.value = selectedItem.category_id;
            }
            purchaseItemNameInput.dataset.selectedItemId = selectedItem.item_id;
            purchaseItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.p_slug;
            purchaseItemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    addPageEventListeners();
    await checkUser();
    await populateItemData();
});
