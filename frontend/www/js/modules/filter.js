import {
    supabase
} from '../supabaseClient.js';
import {
    showCustomModal
} from '../trader.js';
import {
    listingsFilter,
    setListingsFilter,
    setCurrentListingsPage,
    itemCategorySelect,
    filterListingCategorySelect,
    purchaseItemCategorySelect,
    modalItemCategorySelect
} from './dom.js';
import {
    loadActiveListings
} from './init.js';

export const handleFilterChange = (key, value, marketStallId = null) => {
    setListingsFilter(key, value);
    setCurrentListingsPage(1, marketStallId);
    loadActiveListings(marketStallId);
};

export const fetchAndPopulateCategories = async () => {
    if (!itemCategorySelect || !filterListingCategorySelect || !purchaseItemCategorySelect || !modalItemCategorySelect) return;

    try {
        const {
            data,
            error
        } = await supabase
            .from('item_categories')
            .select('category_id, category_name')
            .order('category_name', {
                ascending: true
            });

        if (error) throw error;

        itemCategorySelect.innerHTML = '<option value="">Select a category</option>';
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            itemCategorySelect.appendChild(option);
        });

        filterListingCategorySelect.innerHTML = '<option value="">All Categories</option>';
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            filterListingCategorySelect.appendChild(option);
        });
        filterListingCategorySelect.value = listingsFilter.categoryId;

        purchaseItemCategorySelect.innerHTML = '<option value="">Select a category</option>';
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            purchaseItemCategorySelect.appendChild(option);
        });

        modalItemCategorySelect.innerHTML = '<option value="">Select a category</option>';
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            modalItemCategorySelect.appendChild(option);
        });

    } catch (e) {
        console.error("Error fetching categories:", e);
        await showCustomModal('Error', 'An unexpected error occurred while loading categories.', [{
            text: 'OK',
            value: true
        }]);
    }
};