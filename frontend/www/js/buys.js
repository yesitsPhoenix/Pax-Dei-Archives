import { supabase } from './supabaseClient.js';

const ITEMS_PER_PAGE = 9;
let currentPage = 1;
let totalCount = 0;

const initCustomModal = () => {
    const modalHtml = `
        <div id="customModalContainer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center hidden" style="z-index: 10000;">
            <div id="customModalContentWrapper" class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter"></div>
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

const showCustomModal = (title, message, buttons) => {
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

const setupCustomAutocomplete = (inputElement, suggestionsElement, allItems, onSelectCallback) => {
    inputElement.parentNode.style.position = 'relative';
    suggestionsElement.className = 'absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto hidden';
    inputElement.parentNode.appendChild(suggestionsElement);
    const filterItems = (query) => {
        const lowerQuery = query.toLowerCase();
        return allItems.filter(item => item.item_name.toLowerCase().includes(lowerQuery));
    };
    const renderSuggestions = (filteredItems) => {
        suggestionsElement.innerHTML = '';
        if (filteredItems.length === 0) {
            suggestionsElement.classList.add('hidden');
            return;
        }
        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-2 hover:bg-gray-600 cursor-pointer text-white';
            div.textContent = item.item_name;
            div.addEventListener('click', () => {
                onSelectCallback(item);
                suggestionsElement.classList.add('hidden');
            });
            suggestionsElement.appendChild(div);
        });
        suggestionsElement.classList.remove('hidden');
    };
    inputElement.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.length > 2) {
            const filteredItems = filterItems(query);
            renderSuggestions(filteredItems);
        } else {
            suggestionsElement.classList.add('hidden');
        }
    });
    inputElement.addEventListener('focus', (e) => {
        const query = e.target.value;
        if (query.length > 2) {
            const filteredItems = filterItems(query);
            renderSuggestions(filteredItems);
        }
    });
    document.addEventListener('click', (e) => {
        if (!inputElement.contains(e.target) && !suggestionsElement.contains(e.target)) {
            suggestionsElement.classList.add('hidden');
        }
    });
};

let allItems = [];
let fetchTimeout = null;

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const notification = document.getElementById('reserved-notification');
    if (!sidebar || !notification) return;
    if (open) {
        sidebar.classList.remove('collapsed');
        notification.style.left = '18em';
        notification.style.top = '-4px';
    } else {
        sidebar.classList.add('collapsed');
        notification.style.left = '24px';
        notification.style.top = '-4px';
    }
}


async function getSessionUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}

async function fetchAllItemsForDropdown() {
    try {
        const { data: items, error } = await supabase
            .from('items')
            .select(`
                item_id,
                item_name,
                pax_dei_slug,
                item_categories(category_name)
            `)
            .order('item_name', { ascending: true });
        if (error) {
            return [];
        }
        return items.map(item => {
            const ic = item.item_categories;
            const category_name = ic ? (Array.isArray(ic) ? ic[0]?.category_name : ic.category_name) : '';
            return {
                item_id: item.item_id,
                item_name: item.item_name,
                category_name,
                pax_dei_slug: item.pax_dei_slug
            };
        });
    } catch (err) {
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await getSessionUser();
    handleUserInterface(user);
    if (user) {
        await populateItemData();
        setupEventListeners();
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
    }
});

function handleUserInterface(user) {
    const traderLoginContainer = document.getElementById('traderLoginContainer');
    const buyOrdersContent = document.getElementById('buyOrdersContent');
    if (user) {
        if (traderLoginContainer) traderLoginContainer.classList.add('hidden');
        if (buyOrdersContent) buyOrdersContent.classList.remove('hidden');
    } else {
        if (traderLoginContainer) traderLoginContainer.classList.remove('hidden');
        if (buyOrdersContent) buyOrdersContent.classList.add('hidden');
        const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
        if (traderDiscordLoginButton) {
            traderDiscordLoginButton.addEventListener('click', async () => {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: window.location.href,
                        scopes: 'identify'
                    }
                });
                if (error) {
                    console.error('Login failed:', error.message);
                }
            });
        }
    }
}

async function populateItemData() {
    try {
        allItems = await fetchAllItemsForDropdown();
        setupItemCategoryFilters(allItems);
        initializeAutocompletes();
    } catch (err) {
    }
}

function setupItemCategoryFilters(items) {
    const categories = [...new Set(items.map(item => item.category_name).filter(Boolean))];
    const categorySelect = document.getElementById('filter-buy-category');
    if (categorySelect) {
        categorySelect.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All Categories';
        categorySelect.appendChild(allOption);
        categories.sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }
    const modalCategorySelect = document.getElementById('modal-buy-item-category');
    if (modalCategorySelect) {
        modalCategorySelect.innerHTML = '';
        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = 'Select Category';
        modalCategorySelect.appendChild(blankOption);
        categories.sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            modalCategorySelect.appendChild(option);
        });
    }
}

function initializeAutocompletes() {
    const modalItemNameInput = document.getElementById('modal-buy-item-name');
    const modalItemCategorySelect = document.getElementById('modal-buy-item-category');
    const modalItemNameSuggestions = document.createElement('div');
    if (modalItemNameInput) {
        setupCustomAutocomplete(modalItemNameInput, modalItemNameSuggestions, allItems, (selectedItem) => {
            modalItemNameInput.value = selectedItem.item_name;
            if (modalItemCategorySelect) {
                modalItemCategorySelect.value = selectedItem.category_name || '';
            }
            modalItemNameInput.dataset.selectedItemId = selectedItem.item_id;
            modalItemNameInput.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
            modalItemNameInput.dataset.selectedItemCategory = selectedItem.category_name || '';
        });
    }
    const filterItemNameInput = document.getElementById('filter-buy-item-name');
    const filterItemNameSuggestions = document.createElement('div');
    if (filterItemNameInput) {
        setupCustomAutocomplete(filterItemNameInput, filterItemNameSuggestions, allItems, (selectedItem) => {
            filterItemNameInput.value = selectedItem.item_name;
            const ev = new Event('input', { bubbles: true });
            filterItemNameInput.dispatchEvent(ev);
        });
    }
}

function setupEventListeners() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => toggleSidebar(true));
        sidebar.addEventListener('mouseleave', () => toggleSidebar(false));
    }
    const addBuyOrderSidebarBtn = document.getElementById('addBuyOrderSidebarBtn');
    const addBuyOrderModal = document.getElementById('addBuyOrderModal');
    const closeAddBuyOrderModalBtn = document.getElementById('closeAddBuyOrderModalBtn');
    if (addBuyOrderSidebarBtn) {
        addBuyOrderSidebarBtn.addEventListener('click', () => {
            if (addBuyOrderModal) {
                addBuyOrderModal.classList.remove('hidden');
            }
        });
    }
    if (closeAddBuyOrderModalBtn) {
        closeAddBuyOrderModalBtn.addEventListener('click', () => {
            if (addBuyOrderModal) {
                addBuyOrderModal.classList.add('hidden');
            }
        });
    }
    if (addBuyOrderModal) {
        addBuyOrderModal.addEventListener('click', (e) => {
            if (e.target === addBuyOrderModal) {
                addBuyOrderModal.classList.add('hidden');
            }
        });
    }
    const addBuyOrderFormModal = document.getElementById('add-buy-order-form-modal');
    if (addBuyOrderFormModal) {
        addBuyOrderFormModal.addEventListener('submit', handleAddBuyOrder);
    }
    const filtersContainer = document.getElementById('filtersContainer') || document;
    const triggerFetch = () => {
        if (fetchTimeout) clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(async () => {
            const user = await getSessionUser();
            if (user) {
                await fetchAndDisplayAllOrders(user);
                await fetchReservedCount(user);
            }
        }, 150);
    };
    filtersContainer.addEventListener('input', (e) => {
        if (e.target && (e.target.matches('.filter-input') || e.target.matches('.sort-select') || e.target.id === 'filter-buy-status' || e.target.id === 'filter-buy-category' || e.target.id === 'filter-buy-item-name' || e.target.id === 'sort-by-buy' || e.target.id === 'sort-direction-buy')) {
            triggerFetch();
        }
    });
    filtersContainer.addEventListener('change', (e) => {
        if (e.target && (e.target.matches('.filter-input') || e.target.matches('.sort-select') || e.target.id === 'filter-buy-status' || e.target.id === 'filter-buy-category' || e.target.id === 'filter-buy-item-name' || e.target.id === 'sort-by-buy' || e.target.id === 'sort-direction-buy')) {
            triggerFetch();
        }
    });
    const listContainer = document.getElementById('buy-orders-list');
    if (listContainer) {
        listContainer.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            if (target.matches('.reserve-btn')) await handleReserveOrder({ target });
            if (target.matches('.fulfill-btn')) await handleFulfillOrder({ target });
            if (target.matches('.cancel-reservation-btn')) await handleCancelReservation({ target });
            if (target.matches('.cancel-listing-btn')) await handleCancelListing({ target });
        });
    }
    const reservedListingsBtn = document.getElementById('reserved-listings-btn');
    if (reservedListingsBtn) {
        reservedListingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const statusFilter = document.getElementById('filter-buy-status');
            if (statusFilter) {
                statusFilter.value = 'reserved';
                const ev = new Event('change', { bubbles: true });
                statusFilter.dispatchEvent(ev);
            }
        });
    }
    const activeListingsBtn = document.getElementById('active-listings-btn');
    if (activeListingsBtn) {
        activeListingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const statusFilter = document.getElementById('filter-buy-status');
            if (statusFilter) {
                statusFilter.value = 'active';
                const ev = new Event('change', { bubbles: true });
                statusFilter.dispatchEvent(ev);
            }
        });
    }
}

async function handleAddBuyOrder(e) {
    e.preventDefault();
    const form = e.target;
    const item_name = form['modal-buy-item-name'].value;
    const item_category = form['modal-buy-item-category'].value;
    const quantity_wanted = parseInt(form['modal-buy-quantity'].value);
    const price_per_unit = parseFloat(form['modal-buy-price-per-stack'].value);
    const location = form['modal-buy-location'] ? form['modal-buy-location'].value : 'Unknown';
    const user = await getSessionUser();
    if (!user) {
        showCustomModal('Login Required', 'Please log in to add a buy order.', [{ text: 'OK', value: true }]);
        return;
    }
    const { data, error } = await supabase
        .from('buy_orders')
        .insert([{ user_id: user.id, item_name, item_category, quantity_wanted, price_per_unit, location }])
        .select();
    if (error) {
        showCustomModal('Error', `Failed to add buy order: ${error.message}`, [{ text: 'OK', value: true }]);
    } else {
        const addBuyOrderModal = document.getElementById('addBuyOrderModal');
        if (addBuyOrderModal) addBuyOrderModal.classList.add('hidden');
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
    }
}

async function fetchAndDisplayAllOrders(user) {
    const loader = document.getElementById('loader');
    if (loader) loader.textContent = 'Loading buy orders...';

    const itemFilterInput = document.getElementById('filter-buy-item-name');
    const categoryFilterInput = document.getElementById('filter-buy-category');
    const statusFilterInput = document.getElementById('filter-buy-status');
    const sortByInput = document.getElementById('sort-by-buy');
    const sortDirectionInput = document.getElementById('sort-direction-buy');
    const paginationContainer = document.getElementById('pagination-container');

    const itemFilter = itemFilterInput?.value.trim().toLowerCase() || '';
    const categoryFilter = categoryFilterInput?.value.trim() || '';
    const statusFilter = statusFilterInput?.value.trim() || 'active';
    const sortBy = sortByInput?.value !== 'listing_date' ? sortByInput?.value : 'created_at';
    const sortDirection = sortDirectionInput?.value === 'desc' ? false : true;

    let activeQuery = supabase
        .from('buy_orders')
        .select('*, users: user_id (username), reserved_by_user: reserved_by_user_id (username)')
        .eq('status', 'active');

    if (categoryFilter) activeQuery = activeQuery.eq('item_category', categoryFilter);
    if (itemFilter) activeQuery = activeQuery.ilike('item_name', `%${itemFilter}%`);
    activeQuery = activeQuery.order(sortBy, { ascending: sortDirection });
    
    const { data: activeOrders, error: activeError } = await activeQuery;
    
    let myReservedQuery = supabase
        .from('buy_orders')
        .select('*, users: user_id (username), reserved_by_user: reserved_by_user_id (username)')
        .eq('status', 'reserved')
        .eq('reserved_by_user_id', user.id);

    const { data: myReservedOrders, error: myReservedError } = await myReservedQuery;
    
    let waitingForFulfillmentQuery = supabase
        .from('buy_orders')
        .select('*, users: user_id (username), reserved_by_user: reserved_by_user_id (username)')
        .eq('status', 'reserved')
        .eq('user_id', user.id);
        
    const { data: waitingOrders, error: waitingError } = await waitingForFulfillmentQuery;

    if (loader) loader.textContent = '';
    
    if (activeError || myReservedError || waitingError) {
        console.error('Error fetching orders:', activeError || myReservedError || waitingError);
        showCustomModal('Error', `Failed to fetch buy orders: ${activeError?.message || myReservedError?.message || waitingError?.message}`, [{ text: 'OK', value: true }]);
        return;
    }

    displayOrders(activeOrders, 'buy-orders-list', user);
    displayOrders(myReservedOrders, 'reserved-orders-list', user);
    displayOrders(waitingOrders, 'waiting-orders-list', user);


}

function displayOrders(orders, containerId, user) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    if (orders.length === 0) {
        let message = '';
        if (containerId === 'buy-orders-list') {
            message = 'No active buy orders found.';
        } else if (containerId === 'reserved-orders-list') {
            message = 'You have not reserved any listings yet.';
        } else if (containerId === 'waiting-orders-list') {
            message = 'No orders are waiting for fulfillment.';
        }
        container.innerHTML = `<p class="text-center col-span-full">${message}</p>`;
    } else {
        orders.forEach(order => container.appendChild(createOrderCard(order, user)));
    }
}

async function fetchReservedCount(user) {
    if (!user) return;
    const { count, error } = await supabase
        .from('buy_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'reserved')
        .eq('user_id', user.id);
    if (error) {
        console.error('Error fetching reserved count:', error);
        return;
    }
    updateReservedNotification(count);
}

async function updateReservedNotification(count) {
    const reservedNotification = document.getElementById('reserved-notification');
    if (!reservedNotification) return;
    
    reservedNotification.textContent = count > 0 ? count : '';
    
    reservedNotification.style.display = count > 0 ? 'flex' : 'none';
}


function createOrderCard(order, user) {
    const isOwner = user && order.user_id === user.id;
    const isReservedByMe = user && order.reserved_by_user_id === user.id;
    const isReserved = order.status === 'reserved';
    const totalPrice = order.total_price ?? (order.price_per_unit && order.quantity_wanted ? (order.price_per_unit * order.quantity_wanted) : 0);

    const card = document.createElement('div');
    card.className = `bg-gray-800 rounded-lg shadow-xl p-6 border transition-colors duration-200 ease-in-out ${isReserved ? 'border-gray-600 opacity-70' : 'border-gray-700 hover:border-emerald-400'}`;

    const listedByUsername = order.users?.username || 'Unknown';
    const reservedByUsername = order.reserved_by_user?.username || 'Unknown';
    const itemImageUrl = order.item_image_url || 'https://i.postimg.cc/PJ8LvJzc/question-mark.png';

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
                <img src="${itemImageUrl}" alt="${order.item_name}" class="w-12 h-12 rounded-full object-cover border border-gray-600">
                <h4 class="text-xl font-bold text-white">${order.item_name}</h4>
            </div>
            <span class="px-3 py-1 text-sm font-semibold rounded-full ${order.status === 'active' ? 'bg-green-600' : (order.status === 'reserved' ? 'bg-yellow-600' : 'bg-red-600')} text-white capitalize">${order.status}</span>
        </div>
        <div class="space-y-2 text-sm text-gray-400">
            <p><strong>Listed by:</strong> ${listedByUsername}</p>
            ${isReserved ? `<p><strong>Reserved by:</strong> ${reservedByUsername}</p>` : ''}
            <p><strong>Item Category:</strong> ${order.item_category}</p>
            <p><strong>Quantity (Stacks):</strong> ${order.quantity_wanted}</p>
            <p><strong>Price per Stack:</strong> ${order.price_per_unit} <i class="fas fa-coins text-yellow-500"></i></p>
            <p><strong>Total Value:</strong> ${totalPrice} <i class="fas fa-sack-dollar text-yellow-500"></i></p>
            <p><strong>Location:</strong> ${order.location || 'N/A'}</p>
        </div>
        <div class="mt-4 flex justify-end gap-2">
            ${isReservedByMe ? `<button class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out cancel-reservation-btn" data-id="${order.id}">Cancel Reservation</button>` : ''}
            ${isOwner && order.status !== 'fulfilled' ? `<button class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out fulfill-btn" data-id="${order.id}">Mark as Fulfilled</button>` : ''}
            ${isOwner && order.status !== 'cancelled' ? `<button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out cancel-listing-btn" data-id="${order.id}">Cancel Listing</button>` : ''}
            ${!isOwner && !isReservedByMe && order.status === 'active' ? `<button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out reserve-btn" data-id="${order.id}">Reserve for Fulfillment</button>` : ''}
        </div>
    `;
    return card;
}


async function handleReserveOrder(event) {
    const orderId = event.target.dataset.id;
    const user = await getSessionUser();
    if (!user) {
        showCustomModal('Login Required', 'Please log in to reserve this buy order.', [{ text: 'OK', value: true }]);
        return;
    }
    const { error } = await supabase
        .from('buy_orders')
        .update({ status: 'reserved', reserved_by_user_id: user.id })
        .eq('id', orderId)
        .eq('status', 'active');
    if (error) {
        showCustomModal('Error', `Failed to reserve order: ${error.message}`, [{ text: 'OK', value: true }]);
    } else {
        const user = await getSessionUser();
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
        showCustomModal('Success', 'Order reserved for fulfillment.', [{ text: 'OK', value: true }]);
    }
}

async function handleFulfillOrder(event) {
    const orderId = event.target.dataset.id;
    console.log('Attempting to fulfill order with ID:', orderId);
    
    const user = await getSessionUser();
    if (!user) {
        showCustomModal('Login Required', 'Please log in to fulfill this buy order.', [{ text: 'OK', value: true }]);
        return;
    }
    console.log('User ID from session:', user.id);
    
    const { data, error } = await supabase
        .from('buy_orders')
        .update({ status: 'fulfilled', reserved_by_user_id: null })
        .eq('id', orderId)
        .eq('user_id', user.id);
    
    if (error) {
        console.error('Supabase update failed:', error.message);
        showCustomModal('Error', `Failed to mark order as fulfilled: ${error.message}`, [{ text: 'OK', value: true }]);
    } else {
        console.log('Supabase update successful. Updated rows:', data);
        if (data && data.length === 0) {
            console.warn('No rows were updated. Check if the orderId and userId matched a record.');
        }
    
        const user = await getSessionUser();
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
        showCustomModal('Success', 'Order marked as fulfilled.', [{ text: 'OK', value: true }]);
    }
}

async function handleCancelReservation(event) {
    const clicked = event && event.target ? event.target : event;
    const button = clicked.closest ? clicked.closest('[data-id]') : clicked;
    const orderIdRaw = button?.dataset?.id;
    if (!orderIdRaw) {
        showCustomModal('Error', 'Could not determine order id.', [{ text: 'OK', value: true }]);
        return;
    }
    const orderId = isNaN(Number(orderIdRaw)) ? orderIdRaw : Number(orderIdRaw);
    const user = await getSessionUser();
    if (!user) {
        showCustomModal('Login Required', 'Please log in to cancel this reservation.', [{ text: 'OK', value: true }]);
        return;
    }
    console.log('Cancel reservation attempt', { orderId, userId: user.id });
    const originalDisabled = button.disabled;
    const originalText = button.textContent;
    try {
        button.disabled = true;
        button.textContent = 'Cancelling...';
        const { data, error } = await supabase
            .from('buy_orders')
            .update({ status: 'active', reserved_by_user_id: null })
            .eq('id', orderId)
            .eq('reserved_by_user_id', user.id)
            .select();
        if (error) throw error;
        if (!data || data.length === 0) {
            button.disabled = originalDisabled;
            button.textContent = originalText;
            showCustomModal('Notice', 'No matching reservation found for your account.', [{ text: 'OK', value: true }]);
            console.log('No rows updated', { data });
            return;
        }
        console.log('Cancel success', data);
        const user = await getSessionUser();
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
        showCustomModal('Success', 'Reservation canceled.', [{ text: 'OK', value: true }]);
    } catch (err) {
        button.disabled = originalDisabled;
        button.textContent = originalText;
        console.error('Error canceling reservation:', err);
        showCustomModal('Error', `Failed to cancel reservation: ${err.message || err}`, [{ text: 'OK', value: true }]);
    }
}


async function handleCancelListing(event) {
    const orderId = event.target.dataset.id;
    const user = await getSessionUser();
    if (!user) {
        showCustomModal('Login Required', 'Please log in to cancel this listing.', [{ text: 'OK', value: true }]);
        return;
    }
    const { error } = await supabase
        .from('buy_orders')
        .update({ status: 'cancelled', reserved_by_user_id: null })
        .eq('id', orderId)
        .eq('user_id', user.id);
    if (error) {
        showCustomModal('Error', `Failed to cancel listing: ${error.message}`, [{ text: 'OK', value: true }]);
    } else {
        const user = await getSessionUser();
        await fetchAndDisplayAllOrders(user);
        await fetchReservedCount(user);
        showCustomModal('Success', 'Listing canceled.', [{ text: 'OK', value: true }]);
    }
}