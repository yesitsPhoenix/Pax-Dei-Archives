// trader.js
import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings, populateMarketStallDropdown, setupMarketStallTabs, clearMarketStallsCache } from './modules/init.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadTransactionHistory } from './modules/sales.js';
import { renderDashboard, renderMarketPulse } from './modules/dashboard.js';
import { renderPVEChart, renderSalesChart } from './modules/salesChart.js';
import { createAddListingIntelligenceController } from './modules/addListingIntelligence.js';
import { setupLockedItemSelect } from './modules/lockedItemSelect.js';
import { initializeTraderModals } from './modules/traderModals.js';
import { createTraderSessionController } from './modules/traderSession.js';
import { createTraderPageController } from './modules/traderPage.js';
import {
    loadZoneDataForCharacter,
    clearZoneData,
    getMarketDataForSlug,
    getMarketDataByItemName,
    getMarketDataForSlugByQuality,
    getMarketDataByItemNameAndQuality,
    getItemNameForSlug,
    getOwnListingCountForSlug,
    getItemIdByName,
    findOwnListings,
    summarizeOwnListings,
    getSavedAvatarHash,
    saveAvatarHash,
    clearAvatarHash,
    hashAvatarId
} from './services/gamingToolsService.js';

import {
    modalMarketStallLocationSelect,
    getActiveStallId
} from './modules/dom.js';

let allCharacterActivityData = [];
let allItems = [];
let traderSession = null;
let traderPage = null;


const initCustomModal = () => {
    const modalHtml = `
        <div id="customModalContainer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center hidden" style="z-index: 10000;">
            <div id="customModalContentWrapper" class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const customModalContainer = document.getElementById('customModalContainer');
    const customModalContentWrapper = document.getElementById('customModalContentWrapper');

    customModalContainer.addEventListener('click', (event) => {
        if (event.target === customModalContainer) {
            customModalContainer.classList.add('hidden');
            if (window.customModalResolvePromise) {
                window.customModalResolvePromise(false);
                window.customModalResolvePromise = null;
            }
        }
    });

    return { customModalContainer, customModalContentWrapper };
};

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        window.customModalResolvePromise = resolve;

        if (!window.customModalElements) {
            window.customModalElements = initCustomModal();
        }

        const { customModalContainer, customModalContentWrapper } = window.customModalElements;

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
                if (window.customModalResolvePromise) {
                    window.customModalResolvePromise(btn.value);
                    window.customModalResolvePromise = null;
                }
            });
            buttonContainer.appendChild(button);
        });

        customModalContainer.classList.remove('hidden');
    });
};

export async function fetchAllItemsForDropdown() {
    // Supabase server-side Max Rows cap (default 1000) overrides any .limit() call.
    // Paginate in chunks of 1000 until we have everything.
    const PAGE_SIZE = 1000;
    let allItems = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('items')
            .select('item_id, item_name, category_id, pax_dei_slug')
            .order('item_name', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('[Items] fetchAllItemsForDropdown error:', error);
            throw error;
        }

        allItems = allItems.concat(data || []);

        if (!data || data.length < PAGE_SIZE) break; // last page
        from += PAGE_SIZE;
    }

    console.log(`[Items] Loaded ${allItems.length} items total`);
    return allItems;
}


export const loadTraderPageData = async (reloadActiveListings = true) => traderPage.loadTraderPageData(reloadActiveListings);


traderSession = createTraderSessionController({
    supabase,
    insertCharacterModalHtml,
    initializeCharacters,
    initializeListings,
    initializeSales,
    onLoadTraderPageData: () => loadTraderPageData()
});

traderPage = createTraderPageController({
    supabase,
    getCurrentCharacterId: () => currentCharacterId,
    getCurrentCharacter,
    fetchCharacterActivity: (characterId) => traderSession.fetchCharacterActivity(characterId),
    processCharacterActivityData: (rawData) => traderSession.processCharacterActivityData(rawData),
    renderDashboard,
    renderMarketPulse,
    renderSalesChart,
    renderPVEChart,
    loadTransactionHistory,
    loadActiveListings,
    populateMarketStallDropdown,
    setupMarketStallTabs,
    clearMarketStallsCache,
    modalMarketStallLocationSelect,
    getActiveStallId,
    clearZoneData,
    loadZoneDataForCharacter,
    getSavedAvatarHash,
    findOwnListings,
    summarizeOwnListings,
    showCustomModal,
    fetchAllItemsForDropdown,
    initializeAutocomplete: (items) => {
        allItems = items;
        initializeAutocomplete(items);
    },
    initializeCustomModal: initCustomModal,
    checkUser: () => traderSession.checkUser(),
    getAllCharacterActivityData: () => allCharacterActivityData,
    setAllCharacterActivityData: (value) => {
        allCharacterActivityData = value;
    },
    initializeTraderModals
});


function createAutocompleteHandlers(inputElement, suggestionsContainerElement, dataArray, selectionCallback) {
    let currentFocus = -1;
    let filteredData = [];

    const showSuggestions = () => {
        if (suggestionsContainerElement.children.length > 0) {
            suggestionsContainerElement.style.display = 'block';
        } else {
            suggestionsContainerElement.style.display = 'none';
        }
    };

    const hideSuggestions = () => {
        suggestionsContainerElement.style.display = 'none';
        currentFocus = -1;
    };

    const renderSuggestions = (items) => {
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
    };

    const filterItems = (inputValue) => {
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
    };

    const addActive = (x) => {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add('highlighted');
        x[currentFocus].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const removeActive = (x) => {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove('highlighted');
        }
    };

    return {
        handleInput: function() {
            const val = inputElement.value;
            if (val.length === 0) {
                hideSuggestions();
                delete inputElement.dataset.selectedItemId;
                delete inputElement.dataset.selectedPaxDeiSlug;
                delete inputElement.dataset.selectedItemCategory;
                return;
            }
            const filtered = filterItems(val);
            renderSuggestions(filtered);
        },
        handleKeydown: function(e) {
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
        },
        handleBlur: function() {
            const exactMatch = dataArray.find(item => item.item_name.toLowerCase() === inputElement.value.toLowerCase());
            if (exactMatch) {
                // Only re-invoke selectionCallback if this item isn't already selected;
                // otherwise every click on dead space re-triggers the sales history fetch and causes a flash.
                if (inputElement.dataset.selectedItemId !== String(exactMatch.item_id)) {
                    selectionCallback(exactMatch);
                }
            } else {
                delete inputElement.dataset.selectedItemId;
                delete inputElement.dataset.selectedPaxDeiSlug;
                delete inputElement.dataset.selectedItemCategory;
            }
            setTimeout(() => hideSuggestions(), 150);
        }
    };
}


export function setupCustomAutocomplete(inputElement, suggestionsContainerElement, dataArray, selectionCallback) {
    const handlers = createAutocompleteHandlers(inputElement, suggestionsContainerElement, dataArray, selectionCallback);

    inputElement.addEventListener('input', handlers.handleInput);
    inputElement.addEventListener('keydown', handlers.handleKeydown);
    inputElement.addEventListener('blur', handlers.handleBlur);

    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !suggestionsContainerElement.contains(e.target)) {
            handlers.handleBlur(); 
        }
    });
}

function initializeAutocomplete(allItems) {
    const addListingIntelligence = createAddListingIntelligenceController({
        supabase,
        getCurrentCharacterId: () => currentCharacterId,
        getSavedAvatarHash,
        getMarketDataForSlug,
        getMarketDataByItemName,
        getMarketDataForSlugByQuality,
        getMarketDataByItemNameAndQuality,
        getItemNameForSlug,
        getOwnListingCountForSlug,
        getItemIdByName
    });
    addListingIntelligence.attachInputListeners();

    setupLockedItemSelect({
        allItems,
        inputId: 'modal-item-name',
        suggestionsId: 'modal-item-name-suggestions',
        categorySelectId: 'modal-item-category',
        onSelect: (selectedItem) => {
            addListingIntelligence.handleItemSelected(selectedItem);
        }
    });

    setupLockedItemSelect({
        allItems,
        inputId: 'modal-purchase-item-name',
        suggestionsId: 'modal-purchase-item-name-suggestions',
        categorySelectId: 'modal-purchase-item-category'
    });

    const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
    const filterListingItemNameSuggestions = document.getElementById('filter-listing-item-name-suggestions');
    if (filterListingItemNameInput && filterListingItemNameSuggestions) {
        setupLockedItemSelect({
            allItems,
            inputId: 'filter-listing-item-name',
            suggestionsId: 'filter-listing-item-name-suggestions',
            onSelect: (selectedItem) => {
                filterListingItemNameInput.value = selectedItem.item_name;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await traderPage.initializePage();
});
