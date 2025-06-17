import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings } from './modules/listings.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadTransactionHistory } from './modules/sales.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderSalesChart, setupSalesChartListeners } from './modules/salesChart.js';

let currentUser = null;
const dashboardListingsFilter = {
    itemName: null,
    categoryId: null,
    status: 'all'
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
const characterSelectEl = document.getElementById('character-select');
const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
const traderLoginContainer = document.getElementById('traderLoginContainer');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');
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

        await loadTraderPageData();
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

    if (!currentUser || !currentUser.id) {
        renderDashboard([]);
        await loadActiveListings();
        await loadTransactionHistory();
        renderSalesChart(null, 'monthly');
        return;
    }

    try {
        const { data: allListings, error: allListingsError } = await supabase.rpc('search_trader_listings', {
            p_character_id: currentCharacterId,
            p_item_name: dashboardListingsFilter.itemName,
            p_category_id: dashboardListingsFilter.categoryId,
            p_status: dashboardListingsFilter.status,
            p_limit: 999999,
            p_offset: 0
        });
        if (allListingsError) {
            throw allListingsError;
        }
        const currentCharacterData = await getCurrentCharacter();

        renderDashboard(allListings || [], currentCharacterData);
        await loadActiveListings();
        await loadTransactionHistory();
        await renderSalesChart('daily');
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
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + '/trader.html'
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
    setupSalesChartListeners();
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
            if (nameA.startsWith(lowerCaseInput) && !nameB.startsWith(lowerCaseInput)) return -1;
            if (!nameA.startsWith(lowerCaseInput) && nameB.startsWith(lowerCaseInput)) return 1;
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
            purchaseItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
            purchaseItemNameInput.dataset.selectedItemCategory = selectedItem.category_id;
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    addPageEventListeners();
    await checkUser();
    await populateItemData();
});