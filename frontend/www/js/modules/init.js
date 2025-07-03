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
    renderListingsPagination
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
    marketStallDropdown,
    marketStallTabsContainer,
    tabContentContainer,
    listingsFilter,
    LISTINGS_PER_PAGE,
    currentListingsPage,
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
    modalPurchaseItemCategorySelect
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
    handleFilterChange
} from './filter.js';
import {
    setupAutocomplete
} from './autocomplete.js';


const initializeAddListingModalContent = async () => {

    if (modalMarketStallLocationSelect) {
        await populateMarketStallDropdown(modalMarketStallLocationSelect);
    } else {
        console.error("Error: modalMarketStallLocationSelect element not found in DOM.");
    }

    if (addListingFormModal) {
        addListingFormModal.addEventListener('submit', handleAddListing);
    }
};

export const fetchAndPopulateCategories = async (selectElement) => {
    if (!selectElement) {
        console.warn("fetchAndPopulateCategories: selectElement is null or undefined.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('item_categories')
            .select('category_id, category_name')
            .order('category_name');

        if (error) throw error;

        selectElement.innerHTML = '<option value="">All Categories</option>';

        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            selectElement.appendChild(option);
        });
    } catch (e) {
        console.error("Error fetching or populating categories:", e.message);
    }
};


export const initializeListings = async (userId) => {
    setCurrentUserId(userId);
    addListingsEventListeners();
    if (itemCategorySelect) {
        await fetchAndPopulateCategories(itemCategorySelect);
    }
    if (filterListingCategorySelect) {
        await fetchAndPopulateCategories(filterListingCategorySelect);
    }
    if (purchaseItemCategorySelect) {
        await fetchAndPopulateCategories(purchaseItemCategorySelect);
    }
    if (modalItemCategorySelect) {
        await fetchAndPopulateCategories(modalItemCategorySelect);
    }
    if (modalPurchaseItemCategorySelect) {
        await fetchAndPopulateCategories(modalPurchaseItemCategorySelect);
    }
    if (marketStallDropdown) {
        populateMarketStallDropdown(marketStallDropdown);
    }
    initializeAddListingModalContent();
    setupMarketStallTabs();
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
    if (addPurchaseForm) {
        addPurchaseForm.addEventListener('submit', handleRecordPurchase);
    }

    filterListingItemNameInput.addEventListener('input', (e) => handleFilterChange('itemName', e.target.value));
    filterListingCategorySelect.addEventListener('change', (e) => handleFilterChange('categoryId', e.target.value));
    filterListingStatusSelect.addEventListener('change', (e) => handleFilterChange('status', e.target.value));

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
        editTotalPriceInput
    } = getEditListingModalElements();
    if (editListingForm) {
        editListingForm.addEventListener('submit', handleEditListingSave);
    }
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener('click', () => {
            getEditListingModalElements().editModal.classList.add('hidden');
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
    let targetContainer = listingsBody.parentElement;
    let targetTable = listingsTable;
    let targetLoader = loader;

    if (marketStallId) {
        const stallTabContent = document.getElementById(`listings-for-${marketStallId}`);
        if (stallTabContent) {
            targetContainer = stallTabContent;
            const existingTable = stallTabContent.querySelector('table');
            if (existingTable) {
                targetTable = existingTable;
            } else {
                targetTable = document.createElement('table');
                targetTable.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
                targetTable.innerHTML = `
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listed By</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="relative px-6 py-3"><span class="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                    </tbody>
                `;
                targetContainer.innerHTML = '';
                targetContainer.appendChild(targetTable);
            }
            const existingLoader = stallTabContent.querySelector('.loader');
            if (existingLoader) {
                targetLoader = existingLoader;
            } else {
                targetLoader = document.createElement('div');
                targetLoader.classList.add('loader', 'text-center', 'py-4', 'hidden');
                targetLoader.innerHTML = '<div class="spinner"></div>Loading...';
                targetContainer.prepend(targetLoader);
            }
            stallTabContent.querySelector('p')?.remove();
        }
    }
    if (!currentCharacterId) {
        targetLoader.style.display = 'none';
        targetTable.style.display = 'table';
        if (targetTable.querySelector('tbody')) {
            targetTable.querySelector('tbody').innerHTML = '<tr><td colspan="7" class="text-center py-4">Please select a character or create one to view listings.</td></tr>';
        }
        return;
    }
    targetLoader.style.display = 'block';
    targetTable.style.display = 'none';
    try {
        const {
            data,
            error
        } = await supabase.rpc('search_trader_listings', {
            p_character_id: currentCharacterId,
            p_item_name: listingsFilter.itemName || null,
            p_category_id: listingsFilter.categoryId ? parseInt(listingsFilter.categoryId) : null,
            p_status: listingsFilter.status,
            p_limit: LISTINGS_PER_PAGE,
            p_offset: (currentListingsPage - 1) * LISTINGS_PER_PAGE,
            p_sort_by: currentSort.column,
            p_sort_direction: currentSort.direction,
            p_market_stall_id: marketStallId
        });
        if (error) {
            throw error;
        }
        renderListingsTable(data);
        const {
            count: totalListings,
            error: countError
        } = await supabase
            .from('market_listings')
            .select('*', {
                count: 'exact',
                head: true
            })
            .eq('character_id', currentCharacterId)
            .eq('is_fully_sold', false)
            .eq('is_cancelled', false);

        if (countError) {
            throw countError;
        }
        renderListingsPagination(totalListings);
    } catch (e) {
        console.error("Error loading active listings:", e.message);
        if (targetTable.querySelector('tbody')) {
            targetTable.querySelector('tbody').innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading listings: ${e.message}</td></tr>`;
        }
    } finally {
        targetLoader.style.display = 'none';
        targetTable.style.display = 'table';
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
        const {
            data: marketStalls,
            error
        } = await supabase
            .from('market_stalls')
            .select('id, stall_name')
            .eq('character_id', currentCharacterId)
            .order('stall_name');

        if (error) {
            throw error;
        }

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
        const {
            data: marketStalls,
            error
        } = await supabase
            .from('market_stalls')
            .select('id, stall_name')
            .eq('character_id', currentCharacterId)
            .order('stall_name');

        if (error) {
            throw error;
        }

        if (marketStalls.length === 0) {
            marketStallTabsContainer.innerHTML = '<p class="text-gray-600 text-center py-4 col-span-full">No market stalls found. Create one above!</p>';
            return;
        }

        let firstStallId = null;

        marketStalls.forEach((stall, index) => {
            const tabButton = document.createElement('button');
            tabButton.type = 'button';
            tabButton.dataset.stallId = stall.id;
            tabButton.classList.add('tab-button', 'px-4', 'py-2', 'font-medium', 'text-sm', 'rounded-t-lg', 'focus:outline-none', 'transition-colors', 'duration-200');
            tabButton.textContent = stall.stall_name;

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
            loadActiveListings(firstStallId);
        }
    } catch (e) {
        console.error("Error setting up market stall tabs:", e.message);
        marketStallTabsContainer.innerHTML = `<p class="text-red-500 text-center py-4">Error loading market stalls: ${e.message}</p>`;
    }
};

export const getUserMarketStallLocations = async (characterId) => {
    if (!characterId) {
        console.warn("getUserMarketStallLocations: No character ID provided.");
        return [];
    }
    try {
        const {
            data,
            error
        } = await supabase
            .from('market_stalls')
            .select('id, stall_name')
            .eq('character_id', currentCharacterId)
            .order('stall_name');

        if (error) {
            throw error;
        }
        return data;
    } catch (e) {
        console.error("Error fetching user market stall locations:", e.message);
        return [];
    }
};