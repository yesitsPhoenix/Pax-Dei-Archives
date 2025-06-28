import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadTransactionHistory, handleDownloadCsv } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderSalesChart, setupSalesChartListeners } from './modules/salesChart.js';

let currentUser = null;
let allCharacterActivityData = [];


let customModalContainer = null;
let customModalContentWrapper = null;
let customModalResolvePromise = null;

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        customModalResolvePromise = resolve;

        if (!customModalContainer) {
            const modalHtml = `
                <div id="customModalContainer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center hidden" style="z-index: 10000;">
                    <div id="customModalContentWrapper" class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            customModalContainer = document.getElementById('customModalContainer');
            customModalContentWrapper = document.getElementById('customModalContentWrapper');

            customModalContainer.addEventListener('click', (event) => {
                if (event.target === customModalContainer) {
                    customModalContainer.classList.add('hidden');
                    if (customModalResolvePromise) {
                        customModalResolvePromise(false);
                        customModalResolvePromise = null;
                    }
                }
            });
        }

        customModalContentWrapper.innerHTML = '';

        const modalTitle = document.createElement('h3');
        modalTitle.classList.add('text-xl', 'font-bold', 'mb-4', 'text-gray-800');
        modalTitle.textContent = title;
        customModalContentWrapper.appendChild(modalTitle);

        const modalMessage = document.createElement('p');
        modalMessage.classList.add('mb-6', 'text-gray-700');
        modalMessage.innerHTML = message;
        customModalContentWrapper.appendChild(modalMessage);

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('flex', 'justify-end', 'gap-3');
        customModalContentWrapper.appendChild(buttonContainer);

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.classList.add('px-4', 'py-2', 'rounded-full', 'font-bold');

            if (btn.type === 'confirm') {
                button.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white');
            } else if (btn.type === 'cancel') {
                button.classList.add('bg-gray-500', 'hover:bg-gray-700', 'text-white');
            } else {
                button.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            }

            button.addEventListener('click', () => {
                customModalContainer.classList.add('hidden');
                if (customModalResolvePromise) {
                    customModalResolvePromise(btn.value);
                    customModalResolvePromise = null;
                }
            });
            buttonContainer.appendChild(button);
        });

        customModalContainer.classList.remove('hidden');
    });
};

const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');

async function fetchAllCharacterActivity(characterId) {
    if (!characterId) return [];

    const [
        { data: salesData, error: salesError },
        { data: purchasesData, error: purchasesError },
        { data: cancelledListingsData, error: cancelledError },
        { data: activeListingsData, error: activeListingsError },
        { data: pveTransactionsData, error: pveError }
    ] = await Promise.all([
        supabase.from('sales').select(`
            sale_id,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            sale_date,
            market_listings!sales_listing_id_fkey!inner(
                listing_id,
                character_id,
                market_fee,
                items(item_name, item_categories(category_name)),
                market_stalls(stall_name)
            )
        `).eq('market_listings.character_id', characterId),
        
        supabase.from('purchases').select(`purchase_id, quantity_purchased, purchase_price_per_unit, total_purchase_price, purchase_date, items(item_name, item_categories(category_name))`).eq('character_id', characterId),
        
        supabase.from('market_listings').select(`
            listing_id,
            listing_date,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee,
            items(item_name, item_categories(category_name)),
            market_stalls(stall_name)
        `).eq('character_id', characterId).eq('is_cancelled', true),
        
        supabase.from('market_listings').select(`
            listing_id,
            listing_date,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee,
            items(item_name, item_categories(category_name)),
            market_stalls(stall_name)
        `).eq('character_id', characterId).eq('is_fully_sold', false).eq('is_cancelled', false),
        
        supabase.from('pve_transactions').select(`transaction_id, transaction_date, gold_amount, description`).eq('character_id', characterId)
    ]);

    if (salesError || purchasesError || cancelledError || activeListingsError || pveError) {
        console.error("Error fetching character activity:", salesError || purchasesError || cancelledError || activeListingsError || pveError);
        return [];
    }

    const allTransactions = [];

    salesData.forEach(sale => {
        allTransactions.push({ 
            type: 'Sale', 
            date: sale.sale_date, 
            item_name: sale.market_listings?.items?.item_name, 
            category_name: sale.market_listings?.items?.item_categories?.category_name, 
            market_stall_name: sale.market_listings?.market_stalls?.stall_name,
            quantity: Math.round(sale.quantity_sold || 0), 
            price_per_unit: (sale.sale_price_per_unit || 0), 
            total_amount: Math.round(sale.total_sale_price || 0), 
            fee: 0 
        });
    });
    purchasesData.forEach(purchase => {
        allTransactions.push({ 
            type: 'Purchase', 
            date: purchase.purchase_date, 
            item_name: purchase.items?.item_name, 
            category_name: purchase.items?.item_categories?.category_name, 
            market_stall_name: 'N/A', 
            quantity: Math.round(purchase.quantity_purchased || 0), 
            price_per_unit: (purchase.purchase_price_per_unit || 0), 
            total_amount: Math.round(purchase.total_purchase_price || 0), 
            fee: 0 
        });
    });
    cancelledListingsData.forEach(listing => {
        allTransactions.push({ 
            type: 'Cancellation', 
            date: listing.listing_date, 
            item_name: listing.items?.item_name, 
            category_name: listing.items?.item_categories?.category_name, 
            market_stall_name: listing.market_stalls?.stall_name,
            quantity: Math.round(listing.quantity_listed || 0), 
            price_per_unit: (listing.listed_price_per_unit || 0), 
            total_amount: 0, 
            fee: 0 
        });
    });
    activeListingsData.forEach(listing => {
        if (listing.market_fee && listing.market_fee > 0) {
            allTransactions.push({ 
                type: 'Listing Fee', 
                date: listing.listing_date, 
                item_name: listing.items?.item_name, 
                category_name: listing.items?.item_categories?.category_name, 
                market_stall_name: listing.market_stalls?.stall_name,
                quantity: Math.round(listing.quantity_listed || 0), 
                price_per_unit: (listing.listed_price_per_unit || 0), 
                total_amount: 0, 
                fee: Math.round(listing.market_fee || 0) 
            });
        }
    });
    pveTransactionsData.forEach(pve => {
        allTransactions.push({ 
            type: 'PVE Gold', 
            date: pve.transaction_date, 
            item_name: pve.description || 'N/A', 
            category_name: 'PVE', 
            market_stall_name: 'N/A', 
            quantity: 1, 
            price_per_unit: (pve.gold_amount || 0), 
            total_amount: Math.round(pve.gold_amount || 0), 
            fee: 0 
        });
    });

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allTransactions;
}

const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const traderLoginContainer = document.getElementById('traderLoginContainer');
    const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
    if (user) {
        currentUser = user;
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

        const [
            { data: dashboardStats, error: dashboardError },
            currentCharacterData,
            allActivityData
        ] = await Promise.all([
            supabase.rpc('get_character_dashboard_stats', { p_character_id: currentCharacterId }),
            getCurrentCharacter(),
            fetchAllCharacterActivity(currentCharacterId)
        ]);

        if (dashboardError) {
            throw dashboardError;
        }
        
        allCharacterActivityData = allActivityData;

        renderDashboard(dashboardStats ? dashboardStats[0] : {}, currentCharacterData);
        await loadActiveListings();
        loadTransactionHistory(allCharacterActivityData);
        renderSalesChart(allCharacterActivityData, 'daily');
        
    } catch (error) {
        console.error('Error loading trader page data:', error.message);
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
            let currentPath = window.location.pathname;

            if (!currentPath.includes('/Pax-Dei-Archives')) {
                if (currentPath === '/') {
                    currentPath = '/Pax-Dei-Archives/';
                } else {
                    currentPath = '/Pax-Dei-Archives' + currentPath;
                }
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + currentPath
                }
            });
            if (error) {
                console.error('Error logging in with Discord:', error.message);
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
    try {
        const { data, error } = await supabase.rpc('get_all_items_for_dropdown');

        if (error) {
            console.error('Error fetching items for dropdowns:', error);
            console.error('Supabase RPC error details:', error.message, error.details, error.hint);
            return;
        }

        const allItems = data;

        initializeAutocomplete(allItems);

    } catch (err) {
        console.error('An unexpected error occurred while fetching item data:', err);
    }
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
            return nameA.localeCompare(nameB);
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

    const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
    const filterListingItemNameSuggestions = document.getElementById('filter-listing-item-name-suggestions');

    if (filterListingItemNameInput && filterListingItemNameSuggestions) {
        setupCustomAutocomplete(filterListingItemNameInput, filterListingItemNameSuggestions, allItems, (selectedItem) => {
            filterListingItemNameInput.value = selectedItem.item_name;
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    addPageEventListeners();
    await checkUser();
    await populateItemData();
});