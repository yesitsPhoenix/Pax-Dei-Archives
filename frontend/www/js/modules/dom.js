import { currentCharacterId } from './characters.js';

export const addListingForm = document.getElementById('add-listing-form');
export const listingsBody = document.getElementById('listings-body');
export const listingsTable = document.getElementById('listings-table');
export const loader = document.getElementById('loader');
export const itemCategorySelect = document.getElementById('item-category');
export const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
export const filterListingItemNameSuggestions = document.getElementById('filter-listing-item-name-suggestions');
export const filterListingCategorySelect = document.getElementById('filter-listing-category');
export const filterListingStatusSelect = document.getElementById('filter-listing-status');
export const listingsPaginationContainer = document.getElementById('listings-pagination');
export const sortBySelect = document.getElementById('sort-by');
export const sortDirectionSelect = document.getElementById('sort-direction');

export const addPurchaseForm = document.getElementById('recordPurchaseFormModal');
export const purchaseItemNameInput = document.getElementById('purchase-item-name');
export const purchaseItemCategorySelect = document.getElementById('purchase-item-category');
export const purchaseItemStacksInput = document.getElementById('purchase-item-stacks');
export const purchaseItemCountPerStackInput = document.getElementById('purchase-item-count-per-stack');
export const purchaseItemPricePerStackInput = document.getElementById('purchase-item-price-per-stack');

export const marketStallTabsContainer = document.querySelector('.market-stall-tabs');
export const tabContentContainer = document.querySelector('.tab-content-container');

export const showManageMarketStallsModalBtn = document.getElementById('showManageMarketStallsModalBtn');
export const manageMarketStallsModal = document.getElementById('manageMarketStallsModal');
export const createMarketStallForm = document.getElementById('create-market-stall-form');
export const newMarketStallNameInput = document.getElementById('new-market-stall-name');
export const addMarketStallBtn = document.getElementById('addMarketStallBtn');
export const closeManageMarketStallsModalBtn = document.getElementById('closeManageMarketStallsModalBtn');
export const createStallError = document.getElementById('createStallError');
export const marketStallsList = document.getElementById('marketStallsList');
export const deleteStallError = document.getElementById('deleteStallError');

export const addListingModal = document.getElementById('addListingModal');
export const closeAddListingModalBtn = document.getElementById('closeAddListingModalBtn');
export const addListingFormModal = document.getElementById('add-listing-form-modal');
export const modalItemNameInput = document.getElementById('modal-item-name');
export const modalItemCategorySelect = document.getElementById('modal-item-category');
export const modalItemStacksInput = document.getElementById('modal-item-stacks');
export const modalItemCountPerStackInput = document.getElementById('modal-item-count-per-stack');
export const modalItemPricePerStackInput = document.getElementById('modal-item-price-per-stack');
export const modalMarketStallLocationSelect = document.getElementById('modal-market-stall-location');
export const modalItemNameSuggestions = document.getElementById('modal-item-name-suggestions');
export const showAddListingModalBtn = document.getElementById('showAddListingModalBtn');

export const recordPurchaseModal = document.getElementById('recordPurchaseModal');
export const showRecordPurchaseModalBtn = document.getElementById('showRecordPurchaseModalBtn');
export const closeRecordPurchaseModalBtn = document.getElementById('closeRecordPurchaseModalBtn');
export const addPurchaseFormModal = document.getElementById('add-purchase-form-modal');
export const modalPurchaseItemNameInput = document.getElementById('modal-purchase-item-name');
export const modalPurchaseItemNameSuggestions = document.getElementById('modal-purchase-item-name-suggestions');
export const modalPurchaseItemCategorySelect = document.getElementById('modal-purchase-item-category');
export const modalPurchaseItemStacksInput = document.getElementById('modal-purchase-item-stacks');
export const modalPurchaseItemCountPerStackInput = document.getElementById('modal-purchase-item-count-per-stack');
export const modalPurchaseItemPricePerStackInput = document.getElementById('modal-purchase-item-price-per-stack');

export const newMarketStallProvinceSelect = document.getElementById('newMarketStallProvinceSelect');
export const newMarketStallHomeValleySelect = document.getElementById('newMarketStallHomeValleySelect');

export const LISTINGS_PER_PAGE = 15;
export let currentListingsPage = 1;
export let currentUserId = null;
export let currentEditingListingId = null;
export let listingsFilter = {
    itemName: '',
    categoryId: '',
    status: 'active'
};
export let currentSort = { column: 'item_name', direction: 'asc' };

export const stallPageMap = {};

export function getCurrentListingsPage(marketStallId = null) {
    return stallPageMap[marketStallId || 'global'] || 1;
}

export function setCurrentListingsPage(page, marketStallId = null) {
    stallPageMap[marketStallId || 'global'] = page;
}

export const getActiveStallId = () => {
    const activeTabButton = document.querySelector('.tab-button.bg-blue-500');
    if (activeTabButton) {
        return activeTabButton.dataset.stallId;
    }
    return null;
};


const editListingModalHtml = `
    <div id="editListingModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto font-inter">
            <h3 class="text-2xl font-bold mb-6 text-gray-800">Edit Listing</h3>
            <form id="editListingForm">
                <div class="mb-4">
                    <label for="edit-item-name" class="block text-gray-700 text-sm font-bold mb-2">Item Name:</label>
                    <input type="text" id="edit-item-name" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100" readonly>
                </div>
                <div class="mb-4">
                    <label for="edit-quantity-listed" class="block text-gray-700 text-sm font-bold mb-2">Quantity Listed:</label>
                    <input type="number" id="edit-quantity-listed" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="mb-4">
                    <label for="edit-total-price" class="block text-gray-700 text-sm font-bold mb-2">Total Price of Stack:</label>
                    <input type="number" step="0.01" id="edit-total-price" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                    <p id="edit-fee-info" class="text-xs text-gray-600 mt-1"></p>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Save Changes</button>
                    <button type="button" id="closeEditModal" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', editListingModalHtml);

export const getEditListingModalElements = () => {
    const editModal = document.getElementById('editListingModal');
    const editItemNameInput = document.getElementById('edit-item-name');
    const editQuantityListedInput = document.getElementById('edit-quantity-listed');
    const editTotalPriceInput = document.getElementById('edit-total-price');
    const editFeeInfo = document.getElementById('edit-fee-info');
    const editListingForm = document.getElementById('editListingForm');
    const closeEditModalButton = document.getElementById('closeEditModal');
    return { editModal, editItemNameInput, editQuantityListedInput, editTotalPriceInput, editFeeInfo, editListingForm, closeEditModalButton };
};

export let originalListingPrice = 0;
export let originalListingFee = 0;



export const setCurrentUserId = (id) => {
    currentUserId = id;
};

export const setCurrentEditingListingId = (id) => {
    currentEditingListingId = id;
};

export const setListingsFilter = (key, value) => {
    listingsFilter[key] = value;
};

export const setCurrentSort = (column, direction) => {
    currentSort.column = column;
    currentSort.direction = direction;
};

export const setOriginalListingPrice = (price) => {
    originalListingPrice = price;
};

export const setOriginalListingFee = (fee) => {
    originalListingFee = fee;
};

export const getMarketStallDomElements = (marketStallId) => {
    let targetContainer = document.getElementById('listings-body').parentElement;
    let targetTable = document.getElementById('listings-table');
    let actualListingsBody = document.getElementById('listings-body');
    let targetLoader = document.getElementById('loader');

    if (marketStallId) {
        const stallTabContent = document.getElementById(`listings-for-${marketStallId}`);
        if (stallTabContent) {
            targetContainer = stallTabContent;
            let existingTable = stallTabContent.querySelector('table');
            if (!existingTable) {
                existingTable = document.createElement('table');
                existingTable.classList.add('min-w-full', 'divide-y', 'divide-gray-200');
                existingTable.innerHTML = `
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
                targetContainer.appendChild(existingTable);
            }
            targetTable = existingTable;
            actualListingsBody = targetTable.querySelector('tbody');

            let existingLoader = stallTabContent.querySelector('.loader');
            if (!existingLoader) {
                existingLoader = document.createElement('div');
                existingLoader.classList.add('loader', 'text-center', 'py-4', 'hidden');
                existingLoader.innerHTML = '<div class="spinner"></div>Loading...';
                targetContainer.prepend(existingLoader);
            }
            targetLoader = existingLoader;
            stallTabContent.querySelector('p')?.remove();
        }
    }
    return { targetContainer, targetTable, actualListingsBody, targetLoader };
};