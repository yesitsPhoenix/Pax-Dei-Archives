import {
    supabase
} from '../supabaseClient.js';
import {
    showCustomModal
} from '../trader.js';
import {
    currentCharacterId
} from './characters.js';
import {
    renderListingsTable,
    renderListingsPagination,
} from './render.js';
import {
    addListingForm,
    addPurchaseForm,
    listingsBody,
    listingsTable,
    loader,
    filterListingItemNameInput,
    filterListingCategorySelect,
    filterListingStatusSelect,
    sortBySelect,
    sortDirectionSelect,
    currentSort,
    setCurrentUserId,
    setCurrentListingsPage,
    marketStallTabsContainer,
    tabContentContainer,
    listingsFilter,
    LISTINGS_PER_PAGE,
    getCurrentListingsPage,
    getEditListingModalElements,
    itemCategorySelect,
    purchaseItemCategorySelect,
    showManageMarketStallsModalBtn,
    manageMarketStallsModal,
    createMarketStallForm,
    closeManageMarketStallsModalBtn,
    addListingFormModal,
    modalItemCategorySelect,
    modalMarketStallLocationSelect,
    modalPurchaseItemCategorySelect,
    stallPageMap,
    getActiveStallId,
    getMarketStallDomElements,
    newMarketStallProvinceSelect,
    newMarketStallHomeValleySelect
} from './dom.js';
import {
    handleAddListing,
    handleMarkAsSold,
    handleCancelListing,
    showEditListingModal,
    handleEditListingSave,
    updateEditFeeInfo,
    handleAddMarketStall,
    showManageMarketStallsModal,
    handleDeleteMarketStall
} from './actions.js';
import {
    handleRecordPurchase
} from './purchase.js';
import {
    handleFilterChange,
} from './filter.js';

import { cachedRegions } from './characters.js';

let cachedCategories = null;
let cachedMarketStalls = null;

const initializeAddListingModalContent = async () => {
    if (modalMarketStallLocationSelect) {
        await populateMarketStallDropdown(modalMarketStallLocationSelect);
    } else {
        console.error("Error: modalMarketStallLocationSelect element not found in DOM.");
    }
};

export const fetchAndPopulateCategories = async (selectElement) => {
    if (!selectElement) {
        console.warn("fetchAndPopulateCategories: selectElement is null or undefined.");
        return;
    }

    if (cachedCategories === null) {
        try {
            const {
                data,
                error
            } = await supabase
                .from('item_categories')
                .select('category_id, category_name')
                .order('category_name');

            if (error) throw error;
            cachedCategories = data;
        } catch (e) {
            console.error("Error fetching categories:", e.message);
            return;
        }
    }

    selectElement.innerHTML = '<option value="">All Categories</option>';
    cachedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        selectElement.appendChild(option);
    });
};


export const initializeListings = async (userId) => {
    setCurrentUserId(userId);
    addListingsEventListeners();
    await Promise.all([
        itemCategorySelect && fetchAndPopulateCategories(itemCategorySelect),
        filterListingCategorySelect && fetchAndPopulateCategories(filterListingCategorySelect),
        purchaseItemCategorySelect && fetchAndPopulateCategories(purchaseItemCategorySelect),
        modalItemCategorySelect && fetchAndPopulateCategories(modalItemCategorySelect),
        modalPurchaseItemCategorySelect && fetchAndPopulateCategories(modalPurchaseItemCategorySelect)
    ].filter(Boolean));

    await initializeAddListingModalContent();
    await setupMarketStallTabs();

    if (sortBySelect) {
        sortBySelect.value = currentSort.column;
    }
    if (sortDirectionSelect) {
        sortDirectionSelect.value = currentSort.direction;
    }
};

const addListingsEventListeners = () => {
    if (addListingForm) {
        addListingForm.addEventListener('submit', handleAddListing);
    }
    if (addListingFormModal) {
        addListingFormModal.addEventListener('submit', handleAddListing);
    }
    if (addPurchaseForm) {
        addPurchaseForm.addEventListener('submit', handleRecordPurchase);
    }

    if (filterListingItemNameInput) {
        filterListingItemNameInput.addEventListener('input', (e) => {
            const activeStallId = getActiveStallId();
            handleFilterChange('itemName', e.target.value, activeStallId);
        });
    }

    if (filterListingCategorySelect) {
        filterListingCategorySelect.addEventListener('change', (e) => {
            const activeStallId = getActiveStallId();
            handleFilterChange('categoryId', e.target.value, activeStallId);
        });
    }

    if (filterListingStatusSelect) {
        filterListingStatusSelect.addEventListener('change', (e) => {
            const activeStallId = getActiveStallId();
            handleFilterChange('status', e.target.value, activeStallId);
        });
    }

    if (listingsBody) {
        listingsBody.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('edit-btn')) {
                showEditListingModal(target.dataset.id);
            } else if (target.classList.contains('cancel-btn')) {
                handleCancelListing(target.dataset.id);
            } else if (target.classList.contains('sold-btn')) {
                handleMarkAsSold(target.dataset.id);
            }
        });
    }

    if (sortBySelect) {
        sortBySelect.addEventListener('change', (e) => {
            currentSort.column = e.target.value;
            setCurrentListingsPage(1);
            loadActiveListings();
        });
    }

    if (sortDirectionSelect) {
        sortDirectionSelect.addEventListener('change', (e) => {
            currentSort.direction = e.target.value;
            setCurrentListingsPage(1);
            loadActiveListings();
        });
    }

    const {
        editListingForm,
        closeEditModalButton,
        editTotalPriceInput,
        editModal
    } = getEditListingModalElements();
    if (editListingForm) {
        editListingForm.addEventListener('submit', handleEditListingSave);
    }
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener('click', () => {
            if (editModal) {
                editModal.classList.add('hidden');
            }
        });
    }

    if (editTotalPriceInput) {
        editTotalPriceInput.addEventListener('input', updateEditFeeInfo);
    }

    if (showManageMarketStallsModalBtn) {
        showManageMarketStallsModalBtn.addEventListener('click', showManageMarketStallsModal);
    }
    if (createMarketStallForm) {
        createMarketStallForm.addEventListener('submit', handleAddMarketStall);
    }
    if (closeManageMarketStallsModalBtn) {
        closeManageMarketStallsModalBtn.addEventListener('click', () => {
            if (manageMarketStallsModal) {
                manageMarketStallsModal.classList.add('hidden');
            }
        });
    }
    if (manageMarketStallsModal) {
        manageMarketStallsModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-stall-btn')) {
                handleDeleteMarketStall(e.target.dataset.stallId);
            }
        });
    }
};

export const loadActiveListings = async (marketStallId = null) => {
    const { targetTable, actualListingsBody, targetLoader } = getMarketStallDomElements(marketStallId);

    if (!currentCharacterId) {
        targetLoader.style.display = 'none';
        targetTable.style.display = 'table';
        if (actualListingsBody) {
            actualListingsBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Please select a character or create one to view listings.</td></tr>';
        }
        return;
    }
    targetLoader.style.display = 'block';
    targetTable.style.display = 'none';

    const currentPage = getCurrentListingsPage(marketStallId);

    try {
        const response = await supabase.rpc('search_trader_listings', {
            p_character_id: currentCharacterId,
            p_item_name: listingsFilter.itemName || null,
            p_category_id: listingsFilter.categoryId ? parseInt(listingsFilter.categoryId) : null,
            p_status: listingsFilter.status,
            p_limit: LISTINGS_PER_PAGE,
            p_offset: (currentPage - 1) * LISTINGS_PER_PAGE,
            p_sort_by: currentSort.column,
            p_sort_direction: currentSort.direction,
            p_market_stall_id: marketStallId
        });

        const { data, error } = response;

        if (error) {
            throw error;
        }

        if (!Array.isArray(data)) {
            throw new Error("Unexpected data format from search_trader_listings RPC. Expected an array.");
        }

        const listings = data;
        const total_count = listings.length > 0 ? listings[0].total_count : 0;

        renderListingsTable(listings, actualListingsBody);
        renderListingsPagination(total_count, marketStallId);
    } catch (e) {
        console.error("Error loading active listings:", e.message);
        if (actualListingsBody) {
            actualListingsBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading listings: ${e.message}</td></tr>`;
        }
    } finally {
        targetLoader.style.display = 'none';
        targetTable.style.display = 'table';
    }
};

export const fetchAndCacheMarketStalls = async (characterId) => {
    if (!characterId) {
        console.warn("fetchAndCacheMarketStalls: No character ID provided.");
        cachedMarketStalls = [];
        return [];
    }
    if (cachedMarketStalls !== null) {
        return cachedMarketStalls;
    }
    try {
        const {
            data,
            error
        } = await supabase
            .from('market_stalls')
            .select('id, stall_name')
            .eq('character_id', characterId)
            .order('stall_name');
        if (error) throw error;
        cachedMarketStalls = data;
        return data;
    } catch (e) {
        console.error("Error fetching market stall locations:", e.message);
        cachedMarketStalls = [];
        return [];
    }
};

export const populateMarketStallDropdown = async (selectElement) => {
    if (!selectElement) {
        console.error("populateMarketStallDropdown: selectElement is null or undefined.");
        return;
    }

    if (!currentCharacterId) {
        selectElement.innerHTML = '<option value="">No character selected</option>';
        selectElement.disabled = true;
        return;
    }

    try {
        const marketStalls = await fetchAndCacheMarketStalls(currentCharacterId);

        selectElement.innerHTML = '<option value="">All Market Stalls</option>';
        marketStalls.forEach(stall => {
            const option = document.createElement('option');
            option.value = stall.id;
            option.textContent = stall.stall_name;
            selectElement.appendChild(option);
        });
        selectElement.disabled = false;
    } catch (e) {
        console.error("Error populating market stall dropdown:", e.message);
        selectElement.innerHTML = '<option value="">Error loading stalls</option>';
        selectElement.disabled = true;
    }
};

export const setupMarketStallTabs = async () => {
    if (!marketStallTabsContainer || !tabContentContainer) {
        console.warn("Market stall tab containers not found.");
        return;
    }

    marketStallTabsContainer.innerHTML = '';
    tabContentContainer.innerHTML = '';

    if (!currentCharacterId) {
        marketStallTabsContainer.innerHTML = '<p class="text-gray-600 text-center py-4">Select a character to manage market stalls.</p>';
        return;
    }

    try {
        const marketStalls = await fetchAndCacheMarketStalls(currentCharacterId);

        if (marketStalls.length === 0) {
            marketStallTabsContainer.innerHTML = '<p class="text-gray-600 text-center py-4 col-span-full">No market stalls found. Create one above!</p>';
            return;
        }

        let firstStallId = null;

        const {
            data: stallCountsData,
            error: countsError
        } = await supabase.rpc('get_market_stall_listing_counts_for_character', {
            p_character_id: currentCharacterId
        });

        if (countsError) {
            console.error("Error fetching market stall listing counts:", countsError);
            throw countsError;
        }

        const listingCountsMap = new Map();
        stallCountsData.forEach(item => listingCountsMap.set(item.market_stall_id, item.count));


        marketStalls.forEach((stall, index) => {
            const listingCount = listingCountsMap.get(stall.id) || 0;
            const tabButton = document.createElement('button');
            tabButton.type = 'button';
            tabButton.dataset.stallId = stall.id;
            tabButton.classList.add('tab-button', 'px-4', 'py-2', 'font-medium', 'text-sm', 'rounded-t-lg', 'focus:outline-none', 'transition-colors', 'duration-200');
            tabButton.textContent = `${stall.stall_name} - ${listingCount}`;

            const tabContent = document.createElement('div');
            tabContent.id = `listings-for-${stall.id}`;
            tabContent.classList.add('tab-content', 'p-4', 'border', 'border-t-0', 'border-gray-300', 'rounded-b-lg', 'hidden');

            tabContent.innerHTML = `<h3 class="text-xl font-bold mb-4">${stall.stall_name} Listings</h3><p class="text-gray-600">Loading listings...</p>`;

            marketStallTabsContainer.appendChild(tabButton);
            tabContentContainer.appendChild(tabContent);

            if (index === 0) {
                firstStallId = stall.id;
            }

            tabButton.addEventListener('click', () => {
                document.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('bg-blue-500', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-700');
                });
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.add('hidden');
                });

                tabButton.classList.remove('bg-gray-200', 'text-gray-700');
                tabButton.classList.add('bg-blue-500', 'text-white');

                tabContent.classList.remove('hidden');

                const lastPage = stallPageMap[stall.id] || 1;
                setCurrentListingsPage(lastPage, stall.id);
                loadActiveListings(stall.id);
            });
        });

        if (firstStallId) {
                    const firstTabButton = marketStallTabsContainer.querySelector(`[data-stall-id="${firstStallId}"]`);
                    if (firstTabButton) {
                        firstTabButton.classList.remove('bg-gray-200', 'text-gray-700');
                        firstTabButton.classList.add('bg-blue-500', 'text-white');
                    }
                    const firstTabContent = document.getElementById(`listings-for-${firstStallId}`);
                    if (firstTabContent) {
                        firstTabContent.classList.remove('hidden');
                    }
                    const lastPage = stallPageMap[firstStallId] || 1;
                    setCurrentListingsPage(lastPage, firstStallId);
                    loadActiveListings(firstStallId);
                }
    } catch (e) {
        console.error("Error setting up market stall tabs:", e.message);
        marketStallTabsContainer.innerHTML = `<p class="text-red-500 text-center py-4">Error loading market stalls: ${e.message}</p>`;
    }
};

export const getUserMarketStallLocations = async (characterId) => {
    return await fetchAndCacheMarketStalls(characterId);
};

export const clearMarketStallsCache = () => {
    cachedMarketStalls = null;
};



export const populateStallRegions = async () => {
    if (cachedRegions === null) {
        return; 
    }
    
    newMarketStallHomeValleySelect.innerHTML = '<option value="" disabled selected>Select a Home Valley</option>';
    newMarketStallHomeValleySelect.disabled = true;
    
    const distinctProvinces = [...new Set(cachedRegions
        .filter(item => item.province)
        .map(item => item.province)
    )];

    newMarketStallProvinceSelect.innerHTML = '<option value="" disabled selected>Select a Province</option>';
    distinctProvinces.forEach(provinceName => {
        const option = document.createElement('option');
        option.value = provinceName;
        option.textContent = provinceName;
        newMarketStallProvinceSelect.appendChild(option);
    });
    newMarketStallProvinceSelect.disabled = false;

    newMarketStallProvinceSelect.onchange = () => {
        const selectedProvince = newMarketStallProvinceSelect.value;
        const distinctHomeValleys = [...new Set(cachedRegions
            .filter(item => item.province === selectedProvince && item.home_valley)
            .map(item => item.home_valley)
        )];

        newMarketStallHomeValleySelect.innerHTML = '<option value="" disabled selected>Select a Home Valley</option>';

        if (distinctHomeValleys.length > 0) {
            distinctHomeValleys.forEach(valleyName => {
                const option = document.createElement('option');
                option.value = valleyName;
                option.textContent = valleyName;
                newMarketStallHomeValleySelect.appendChild(option);
            });
            newMarketStallHomeValleySelect.disabled = false;
        } else {
            newMarketStallHomeValleySelect.disabled = true;
        }
    };
};