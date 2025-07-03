// filter.js
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

export const handleFilterChange = (key, value) => {
    setListingsFilter(key, value);
    setCurrentListingsPage(1);
    loadActiveListings();
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

        console.log("Supabase fetched categories data:", data); // LOG 1: What Supabase returned

        itemCategorySelect.innerHTML = '<option value="">Select a category</option>';
        data.forEach(category => {
            console.log(`Processing category: ID=${category.category_id} (Type: ${typeof category.category_id}), Name=${category.category_name}`); // LOG 2: Type and value of category_id before assignment
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            itemCategorySelect.appendChild(option);
            console.log(`Assigned to itemCategorySelect: Option value=${option.value}, text=${option.textContent}`); // LOG 3: What was assigned
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