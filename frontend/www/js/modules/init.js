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
    // New imports for market stall management
    showManageMarketStallsModalBtn, // Updated import
    manageMarketStallsModal, // Updated import
    createMarketStallForm,
    closeManageMarketStallsModalBtn // Updated import
} from './dom.js';
import {
    handleAddListing,
    handleMarkAsSold,
    handleCancelListing,
    showEditListingModal,
    handleEditListingSave,
    updateEditFeeInfo,
    handleAddMarketStall,
    showManageMarketStallsModal, // Updated import
    handleDeleteMarketStall // New import
} from './actions.js';
import {
    handleRecordPurchase
} from './purchase.js';
import {
    handleFilterChange,
    fetchAndPopulateCategories
} from './filter.js';
import {
    setupAutocomplete
} from './autocomplete.js';


export const initializeListings = (userId) => {
    setCurrentUserId(userId);
    addListingsEventListeners();
    fetchAndPopulateCategories();
    populateMarketStallDropdown();
    setupMarketStallTabs();
    if (sortBySelect) {
        sortBySelect.value = currentSort.column;
    }
    if (sortDirectionSelect) {
        sortDirectionSelect.value = currentSort.direction;
    }
};

const addListingsEventListeners = () => {
    addListingForm.addEventListener('submit', handleAddListing);
    addPurchaseForm.addEventListener('submit', handleRecordPurchase);

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

    // Event listeners for Market Stall management functionality
    if (showManageMarketStallsModalBtn) {
        showManageMarketStallsModalBtn.addEventListener('click', showManageMarketStallsModal); // Updated function call
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
    // Event delegation for dynamically added delete buttons
    if (manageMarketStallsModal) {
        manageMarketStallsModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-stall-btn')) {
                handleDeleteMarketStall(e.target.dataset.stallId);
            }
        });
    }
};

export const loadActiveListings = async (marketStallId = null) => {
    if (!currentCharacterId) {
        loader.style.display = 'none';
        listingsTable.style.display = 'table';
        listingsBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Please select a character or create one to view listings.</td></tr>';
        return;
    }

    loader.style.display = 'block';
    listingsTable.style.display = 'none';

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
            p_market_stall_id: marketStallId // Pass the market stall ID
        });

        if (error) throw error;

        const listings = data || [];
        const totalCount = listings.length > 0 ? listings[0].total_count : 0;

        renderListingsTable(listings);
        renderListingsPagination(totalCount);

    } catch (err) {
        console.error('Error loading listings:', err.message);
        await showCustomModal('Error', 'Failed to load listings. ' + err.message, [{
            text: 'OK',
            value: true
        }]);
    } finally {
        loader.style.display = 'none';
        listingsTable.style.display = 'table';
    }
};


export async function populateMarketStallDropdown() {
    if (!marketStallDropdown) {
        console.warn('Market stall dropdown not found. Skipping dropdown population.');
        return;
    }

    if (!currentCharacterId) {
        marketStallDropdown.innerHTML = '<option value="">Please select a character</option>';
        marketStallDropdown.disabled = true;
        return;
    }

    const marketStalls = await getUserMarketStallLocations(currentCharacterId);

    marketStallDropdown.innerHTML = '<option value="">Select a Stall</option>';
    if (marketStalls.length === 0) {
        marketStallDropdown.innerHTML += '<option value="" disabled>No stalls found</option>';
        marketStallDropdown.disabled = true;
    } else {
        marketStalls.forEach(stall => {
            const option = document.createElement('option');
            option.value = stall.id;
            option.textContent = stall.stall_name;
            marketStallDropdown.appendChild(option);
        });
        marketStallDropdown.disabled = false;
    }
}

export async function getUserMarketStallLocations(characterId) {

    if (!characterId) {
        return [];
    }
    const {
        data,
        error
    } = await supabase
        .from('market_stalls')
        .select('id, stall_name, region')
        .eq('character_id', characterId)
        .order('stall_name', {
            ascending: true
        });

    if (error) {
        console.error('Error fetching market stalls:', error.message);
        return [];
    }
    return data;
}

export async function setupMarketStallTabs() {
    if (!marketStallTabsContainer || !tabContentContainer) {
        console.warn('Market stall tab containers not found. Skipping tab setup.');
        return;
    }

    if (!currentCharacterId) {
        marketStallTabsContainer.innerHTML = '<p class="text-gray-600">Select a character to view market stalls.</p>';
        tabContentContainer.innerHTML = '';
        return;
    }

    const marketStalls = await getUserMarketStallLocations(currentCharacterId);

    marketStallTabsContainer.innerHTML = '';
    tabContentContainer.innerHTML = '';

    if (marketStalls.length === 0) {
        marketStallTabsContainer.innerHTML = '<p class="text-gray-600">No market stalls found for this character. Create one using "Manage Market Stalls" button.</p>';
        return;
    }

    let firstStallId = null;

    marketStalls.forEach((stall, index) => {
        const tabButton = document.createElement('button');
        tabButton.textContent = stall.stall_name;
        tabButton.dataset.stallId = stall.id;
        // Default Tailwind classes for inactive state
        tabButton.classList.add('tab-button', 'px-4', 'py-2', 'rounded-t-lg', 'font-semibold', 'bg-gray-200', 'text-gray-700', 'hover:bg-gray-300', 'transition-colors', 'duration-200');


        const tabContent = document.createElement('div');
        tabContent.id = `listings-for-${stall.id}`;
        // Default Tailwind classes for hidden content
        tabContent.classList.add('tab-content', 'p-4', 'border', 'border-t-0', 'border-gray-300', 'rounded-b-lg', 'hidden');

        tabContent.innerHTML = `<h3 class="text-xl font-bold mb-4">${stall.stall_name} Listings</h3><p class="text-gray-600">Loading listings...</p>`;

        marketStallTabsContainer.appendChild(tabButton);
        tabContentContainer.appendChild(tabContent);

        if (index === 0) {
            firstStallId = stall.id;
        }

        tabButton.addEventListener('click', () => {
            // Deactivate all tab buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => {
                // Remove active Tailwind classes, add inactive ones
                btn.classList.remove('bg-blue-500', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });

            // Activate the clicked tab button
            tabButton.classList.remove('bg-gray-200', 'text-gray-700'); // Remove inactive
            tabButton.classList.add('bg-blue-500', 'text-white'); // Add active

            // Show the corresponding tab content
            tabContent.classList.remove('hidden');

            loadActiveListings(stall.id);
        });
    });

    if (firstStallId) {
        const initialTabButton = marketStallTabsContainer.querySelector(`[data-stall-id="${firstStallId}"]`);
        if (initialTabButton) {
            initialTabButton.click(); // Simulate click to activate first tab
        }
    }
}