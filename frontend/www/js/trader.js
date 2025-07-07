// trader.js
import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings, populateMarketStallDropdown, setupMarketStallTabs } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadTransactionHistory, handleDownloadCsv } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderPVEChart, renderSalesChart } from './modules/salesChart.js';

import {
    showAddListingModalBtn,
    addListingModal,
    closeAddListingModalBtn,
    addListingFormModal,
    modalItemNameInput,
    modalItemCategorySelect,
    modalItemNameSuggestions,
    modalMarketStallLocationSelect
} from './modules/dom.js';

let currentUser = null;
let allCharacterActivityData = [];
let allItems = [];

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

    const { data, error } = await supabase.rpc('get_all_character_activity_json', {
        p_character_id: characterId
    });

    if (error) {
        console.error("Error fetching character activity using RPC:", error);
        return [];
    }

    const { sales, purchases, cancellations, listing_fees, pve_transactions } = data;

    const allTransactions = [
        ...(sales || []),
        ...(purchases || []),
        ...(cancellations || []),
        ...(listing_fees || []),
        ...(pve_transactions || [])
    ];

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

async function populateItemData() {
    try {
        const { data, error } = await supabase.rpc('get_all_items_for_dropdown');

        if (error) {
            console.error('Error fetching items for dropdowns:', error);
            console.error('Supabase RPC error details:', error.message, error.details, error.hint);
            return;
        }

        allItems = data;

        initializeAutocomplete(allItems);

    } catch (err) {
        console.error('An unexpected error occurred while fetching item data:', err);
    }
}

const updateAllCharts = (timeframe) => {
    if (allCharacterActivityData) {
        renderSalesChart(allCharacterActivityData, timeframe);
        renderPVEChart(allCharacterActivityData, timeframe);
    } else {
        renderSalesChart([], timeframe);
        renderPVEChart([], timeframe);
    }
};

export const loadTraderPageData = async () => {
    if (!currentUser || !currentUser.id || !currentCharacterId) {
        renderDashboard({}, null);
        await loadActiveListings();
        loadTransactionHistory([]);
        updateAllCharts('daily');
        if (document.querySelector('.market-stall-tabs')) {
            document.querySelector('.market-stall-tabs').innerHTML = '<p class="text-gray-600 text-center py-4">Select a character to manage market stalls.</p>';
        }
        if (document.querySelector('.tab-content-container')) {
            document.querySelector('.tab-content-container').innerHTML = '';
        }
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
        updateAllCharts('daily');
        if (modalMarketStallLocationSelect) {
            await populateMarketStallDropdown(modalMarketStallLocationSelect);
        }
        await setupMarketStallTabs();

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
    document.getElementById('viewDaily')?.addEventListener('click', () => updateAllCharts('daily'));
    document.getElementById('viewWeekly')?.addEventListener('click', () => updateAllCharts('weekly'));
    document.getElementById('viewMonthly')?.addEventListener('click', () => updateAllCharts('monthly'));


    if (showAddListingModalBtn) {
        showAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.remove('hidden');
            }
            if (addListingFormModal) {
                addListingFormModal.reset();
            }
        });
    }

    if (closeAddListingModalBtn) {
        closeAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.add('hidden');
            }
        });
    }

    if (addListingModal) {
        addListingModal.addEventListener('click', (event) => {
            if (event.target === addListingModal) {
                addListingModal.classList.add('hidden');
            }
        });
    }


    if (modalItemNameInput && modalItemNameSuggestions && allItems) {
        setupCustomAutocomplete(modalItemNameInput, modalItemNameSuggestions, allItems, (selectedItem) => {
            modalItemNameInput.value = selectedItem.item_name;
            const categorySelect = modalItemCategorySelect;
            if (categorySelect) {
                categorySelect.value = String(selectedItem.category_id);
            }
            modalItemNameInput.dataset.selectedItemId = selectedItem.item_id;
            modalItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.p_slug;
            modalItemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
        });
    }

};



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
    const modalItemNameInput = document.getElementById('modal-item-name');
    const modalItemNameSuggestions = document.getElementById('modal-item-name-suggestions');

    if (modalItemNameInput && modalItemNameSuggestions) {
        setupCustomAutocomplete(modalItemNameInput, modalItemNameSuggestions, allItems, (selectedItem) => {
            modalItemNameInput.value = selectedItem.item_name;
            const modalItemCategorySelect = document.getElementById('modal-item-category');
            if (modalItemCategorySelect) {
                modalItemCategorySelect.value = String(selectedItem.category_id);
            }
            modalItemNameInput.dataset.selectedItemId = selectedItem.item_id;
            modalItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
            modalItemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
        });
    }

    const modalPurchaseItemNameInput = document.getElementById('modal-purchase-item-name');
    const modalPurchaseItemNameSuggestions = document.getElementById('modal-purchase-item-name-suggestions');

    if (modalPurchaseItemNameInput && modalPurchaseItemNameSuggestions) {
        setupCustomAutocomplete(modalPurchaseItemNameInput, modalPurchaseItemNameSuggestions, allItems, (selectedItem) => {
            modalPurchaseItemNameInput.value = selectedItem.item_name;
            const modalPurchaseItemCategorySelect = document.getElementById('modal-purchase-item-category');
            if (modalPurchaseItemCategorySelect) {
                modalPurchaseItemCategorySelect.value = String(selectedItem.category_id);
            }
            modalPurchaseItemNameInput.dataset.selectedItemId = selectedItem.item_id;
            modalPurchaseItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
            modalPurchaseItemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
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
    await checkUser();
    await populateItemData();
    addPageEventListeners();
});