import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const addListingForm = document.getElementById('add-listing-form');
    const listingsBody = document.getElementById('listings-body');
    const listingsTable = document.getElementById('listings-table');
    const loader = document.getElementById('loader');

    const grossSalesEl = document.getElementById('dashboard-gross-sales');
    const feesPaidEl = document.getElementById('dashboard-fees-paid');
    const netProfitEl = document.getElementById('dashboard-net-profit');
    const activeListingsEl = document.getElementById('dashboard-active-listings');

    const loadPageData = async () => {
        showLoader(true);

        const { data: listings, error: listingsError } = await supabase
            .from('market_listings')
            .select(`
                listing_id,
                quantity_listed,
                listed_price_per_unit,
                total_listed_price,
                market_fee,
                listing_date,
                is_fully_sold,
                items (item_name)
            `)
            .order('listing_date', { ascending: false });

        if (listingsError) {
            console.error('Error fetching listings:', listingsError.message);
            alert('Could not fetch market data.');
            showLoader(false);
            return;
        }

        renderDashboard(listings);
        renderListingsTable(listings.filter(l => !l.is_fully_sold));
        showLoader(false);
    };

    const getOrCreateItemId = async (itemName) => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('User not authenticated or error fetching user:', userError?.message);
            alert('You must be logged in to add items.');
            return null;
        }
        const userId = user.id;

        let { data: item, error: selectError } = await supabase
            .from('items')
            .select('item_id')
            .eq('item_name', itemName)
            .single();

        if (item) return item.item_id;

        if (selectError && selectError.code === 'PGRST116') {
            const { data: newItem, error: insertError } = await supabase
                .from('items')
                .insert({
                    item_name: itemName,
                    owner_id: userId
                })
                .select('item_id')
                .single();

            if (insertError) {
                console.error('Error creating item:', insertError.message);
                return null;
            }
            return newItem.item_id;
        }

        if (selectError) {
            console.error('Error selecting item:', selectError.message);
            return null;
        }
    };

    const renderDashboard = (listings) => {
        const soldListings = listings.filter(l => l.is_fully_sold);
        const allListings = listings;
        const activeListings = listings.filter(l => !l.is_fully_sold);

        const grossSales = soldListings.reduce((sum, l) => sum + l.total_listed_price, 0);
        const feesPaid = allListings.reduce((sum, l) => sum + l.market_fee, 0);
        const netProfit = grossSales - feesPaid;
        
        grossSalesEl.innerHTML = `${grossSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        feesPaidEl.innerHTML = `${feesPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        netProfitEl.innerHTML = `${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        activeListingsEl.textContent = activeListings.length;
    };

    const renderListingsTable = (activeListings) => {
        listingsBody.innerHTML = '';
        if (activeListings.length === 0) {
            listingsBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No active listings.</td></tr>';
            return;
        }

        activeListings.forEach(listing => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${listing.items.item_name}</td>
                <td>${listing.quantity_listed.toLocaleString()}</td>
                <td>${listing.listed_price_per_unit.toFixed(2)}</td>
                <td>${listing.total_listed_price.toLocaleString()}</td>
                <td>${listing.market_fee.toLocaleString()}</td>
                <td>${new Date(listing.listing_date).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="sold-btn" data-id="${listing.listing_id}" title="Mark as Sold">Sold</button>
                </td>
            `;
            listingsBody.appendChild(row);
        });
    };

    const showLoader = (isLoading) => {
        loader.style.display = isLoading ? 'block' : 'none';
        listingsTable.style.display = isLoading ? 'none' : 'table';
    };

    const handleAddListing = async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Adding...';

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('User not authenticated:', userError?.message);
            alert('You must be logged in to add a listing.');
            button.disabled = false;
            button.textContent = 'Add Listing';
            return;
        }
        const currentUserId = user.id;

        const itemName = document.getElementById('item-name').value;
        const stacks = parseInt(document.getElementById('item-stacks').value, 10);
        const countPerStack = parseInt(document.getElementById('item-count-per-stack').value, 10);
        const pricePerStack = parseFloat(document.getElementById('item-price-per-stack').value);
        const fee = parseFloat(document.getElementById('item-fee').value);

        const quantity_listed = stacks * countPerStack;
        const total_listed_price = stacks * pricePerStack;
        const listed_price_per_unit = total_listed_price / quantity_listed;

        const itemId = await getOrCreateItemId(itemName);
        if (!itemId) {
            alert('Error processing item name. Check console for details.');
            button.disabled = false;
            button.textContent = 'Add Listing';
            return;
        }

        const { error } = await supabase.from('market_listings').insert({
            item_id: itemId,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee: fee,
            listing_date: new Date().toISOString(),
            is_fully_sold: false,
            user_id: currentUserId
        });

        if (error) {
            console.error('Error adding listing:', error.message);
            alert('Failed to add the new listing.');
        } else {
            addListingForm.reset();
            await loadPageData();
        }

        button.disabled = false;
        button.textContent = 'Add Listing';
    };
    
    const handleTableClick = async (e) => {
        if (!e.target.classList.contains('sold-btn')) return;

        const button = e.target;
        const listingId = button.dataset.id;
        if (!listingId) return;

        if (confirm('Are you sure you want to mark this item as sold?')) {
            button.disabled = true;
            
            const { data: listing, error: fetchError } = await supabase
                .from('market_listings')
                .select('*')
                .eq('listing_id', listingId)
                .single();
            
            if (fetchError) {
                console.error('Error fetching listing to sell:', fetchError.message);
                alert('Could not find listing details to complete sale.');
                button.disabled = false;
                return;
            }

            const { error: saleError } = await supabase.from('sales').insert({
                listing_id: listing.listing_id,
                quantity_sold: listing.quantity_listed,
                sale_price_per_unit: listing.listed_price_per_unit,
                total_sale_price: listing.total_listed_price,
                sale_date: new Date().toISOString()
            });

            if (saleError) {
                console.error('Error creating sale record:', saleError.message);
                alert('Failed to create the sale record.');
                button.disabled = false;
                return;
            }

            const { error: updateError } = await supabase
                .from('market_listings')
                .update({ is_fully_sold: true })
                .eq('listing_id', listingId);

            if (updateError) {
                console.error('Error updating listing status:', updateError.message);
                alert('Sale was recorded, but the listing status could not be updated.');
            }

            await loadPageData();
        }
    };

    addListingForm.addEventListener('submit', handleAddListing);
    listingsBody.addEventListener('click', handleTableClick);
    loadPageData();
});
