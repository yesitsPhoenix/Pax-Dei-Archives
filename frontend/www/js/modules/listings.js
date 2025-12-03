import {
    initializeListings,
    loadActiveListings,
    populateMarketStallDropdown,
    setupMarketStallTabs
} from './init.js';
import {
    addListingForm,
    addPurchaseForm,
    listingsBody,
    filterListingItemNameInput,
    filterListingCategorySelect,
    filterListingStatusSelect,
    sortBySelect,
    sortDirectionSelect,
    getEditListingModalElements,
    itemCategorySelect,
    purchaseItemNameInput,
    purchaseItemCategorySelect,
    getCurrentListingsPage,
    openModal,
    closeModal,
    closeAddListingModalBtn
} from './dom.js';
import {
    handleAddListing,
    handleCancelListing,
    handleMarkAsSold,
    showEditListingModal,
    handleEditListingSave,
    updateEditFeeInfo,
    updateListingStatus
} from './actions.js';
import {
    handleRecordPurchase
} from './purchase.js';
import {
    handleFilterChange,
    fetchAndPopulateCategories
} from './filter.js';
import {
    currentCharacterId
} from './characters.js';
import {
    showCustomModal,

} from '../trader.js';
import {
    loadTransactionHistory
} from './sales.js';
export {
    initializeListings,
    loadActiveListings,
    populateMarketStallDropdown,
    setupMarketStallTabs
};

let selectedListingIdsState = new Set(); 

const bulkEditBtn = document.getElementById('bulkEditListingsBtn');
const selectAllCheckbox = document.getElementById('selectAllListingsCheckbox');
const selectedCountSpan = document.getElementById('selectedListingCount');

export const getSelectedListingIds = () => {
    return Array.from(selectedListingIdsState);
};

export const restoreListingSelection = () => {
    document.querySelectorAll('.listing-select-checkbox').forEach(cb => {
        const listingId = cb.dataset.listingId;
        cb.checked = selectedListingIdsState.has(listingId);
    });
    updateBulkEditButton();
};

function updateBulkEditButton() {
    const count = selectedListingIdsState.size;

    selectedCountSpan.textContent = count;

    if (bulkEditBtn) {
        bulkEditBtn.style.display = 'inline-flex'; 

        if (count > 0) {
            bulkEditBtn.disabled = false;
            bulkEditBtn.classList.remove('bg-gray-500', 'cursor-not-allowed');
            bulkEditBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');

            bulkEditBtn.onclick = () => {
                openBulkEditModal(Array.from(selectedListingIdsState));
            };

        } else {
            bulkEditBtn.disabled = true;
            bulkEditBtn.classList.add('bg-gray-500', 'cursor-not-allowed');
            bulkEditBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');

            bulkEditBtn.onclick = null;
        }

        bulkEditBtn.textContent = count > 0 ?
            `Bulk Edit (${count})` :
            'Bulk Edit';
    }
    
    const allCheckboxes = document.querySelectorAll('.listing-select-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.listing-select-checkbox:checked');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = (allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length);
        selectAllCheckbox.indeterminate = (checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length);
    }
}

function openBulkEditModal(listingIds) {
    const modalContent = `
        <h3 class="text-2xl font-bold text-white mb-6 text-center">Bulk Edit Listings</h3>
        <p class="text-gray-300 mb-4">You are editing <strong>${listingIds.length}</strong> active listings.</p>
        <form id="bulk-edit-form" class="space-y-4">
            <div class="form-group">
                <label for="bulk-status-select" class="block text-sm font-medium text-gray-300">New Status</label>
                <select id="bulk-status-select" name="new-status" required
                    class="w-full p-2 border rounded-lg bg-gray-700 text-white">
                    <option value="">Select Action</option>
                    <option value="sold">Mark as Sold (Successful Sale)</option>
                    <option value="cancelled">Mark as Cancelled (Removed Listing)</option>
                </select>
            </div>

            </div>

            <div class="flex justify-end gap-4 mt-6">
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md">
                    Apply Bulk Edit
                </button>
                <button type="button" id="cancelBulkEditBtn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md">
                    Cancel
                </button>

            </div>
            <p id="bulk-edit-error" class="text-red-500 text-sm mt-2 hidden"></p>
        </form>
    `;

    openModal(modalContent);

    const form = document.getElementById('bulk-edit-form');
    const statusSelect = document.getElementById('bulk-status-select');
    const errorMsg = document.getElementById('bulk-edit-error');
    
    const cancelBtn = document.getElementById('cancelBulkEditBtn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.classList.add('hidden');

        const newStatus = statusSelect.value;

        if (!newStatus) {
            errorMsg.textContent = 'Please select a new status.';
            errorMsg.classList.remove('hidden');
            return;
        }

        const updates = listingIds.map(id => ({
            id: id,
            new_status: newStatus
        }));

        try {
            const {
                success,
                error
            } = await updateListingStatus(updates);

            if (success) {
                closeModal();

                showCustomModal(
                    'Success!',
                    `Successfully updated <strong>${listingIds.length}</strong> listing(s).`,
                    [{
                        text: 'OK',
                        value: 'ok'
                    }]
                );

                selectedListingIdsState.clear();

                await loadActiveListings();

                document.body.dispatchEvent(new CustomEvent('statsNeedRefresh'));

                document.body.dispatchEvent(new CustomEvent('transactionHistoryNeedReload'));

                selectAllCheckbox.checked = false;
                updateBulkEditButton();

            } else {
                closeModal();

                showCustomModal(
                    'Bulk Edit Failed',
                    `An error occurred while updating listings: <strong>${error || 'An unexpected error occurred.'}</strong>`,
                    [{
                        text: 'Close',
                        value: 'close',
                        type: 'cancel'
                    }]
                );
            }
        } catch (error) {
            console.error('Bulk Edit failed:', error);
            closeModal();

            showCustomModal(
                'System Error',
                'An unexpected network or system error occurred during bulk edit.',
                [{
                    text: 'Close',
                    value: 'close',
                    type: 'cancel'
                }]
            );
        }
    });


    if (closeAddListingModalBtn) {
        closeAddListingModalBtn.addEventListener('click', () => {
            closeModal();
        }, {
            once: true
        });
    }
}

function handleCheckboxChange(event) {
    const checkbox = event.target;
    const listingId = checkbox.dataset.listingId;
    
    if (checkbox.checked) {
        selectedListingIdsState.add(listingId);
    } else {
        selectedListingIdsState.delete(listingId);
    }
    updateBulkEditButton();
}

function handleSelectAllChange() {
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = document.querySelectorAll('.listing-select-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const listingId = cb.dataset.listingId;
        if (isChecked) {
            selectedListingIdsState.add(listingId);
        } else {
            selectedListingIdsState.delete(listingId);
        }
    });
    updateBulkEditButton();
}


document.addEventListener('DOMContentLoaded', () => {
    if (listingsBody) {
        listingsBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('listing-select-checkbox')) {
                handleCheckboxChange(e);
            }
        });
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    }

    updateBulkEditButton();
});