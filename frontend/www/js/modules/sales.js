import { supabase } from '../supabaseClient.js';
import { showCustomModal } from '../trader.js';
import { currentCharacterId } from './characters.js';

const salesLoader = document.getElementById('sales-loader');
const salesBody = document.getElementById('sales-body');
const salesTable = document.getElementById('sales-table');
const salesPaginationContainer = document.getElementById('sales-pagination');
const downloadSalesCsvButton = document.getElementById('download-sales-csv');

const TRANSACTIONS_PER_PAGE = 10;
let currentTransactionsPage = 1;

export const initializeSales = () => {
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.addEventListener('click', handleDownloadCsv);
    }
};

export const loadTransactionHistory = async () => {
    if (!currentCharacterId) {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'none';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Please select a character or create one to view transaction history.</td></tr>';
        return;
    }

    if (salesLoader) salesLoader.style.display = 'block';
    if (salesTable) salesTable.style.display = 'none';

    try {
        const offset = (currentTransactionsPage - 1) * TRANSACTIONS_PER_PAGE;

        const { data: salesData, error: salesError, count: salesCount } = await supabase
            .from('sales')
            .select(`
                sale_id, quantity_sold, sale_price_per_unit, total_sale_price, sale_date,
                market_listings!sales_listing_id_fkey!inner ( listing_id, character_id, market_fee, items(item_name, item_categories(category_name)) )
            `, { count: 'exact' })
            .eq('market_listings.character_id', currentCharacterId);

        if (salesError) throw salesError;

        const { data: purchasesData, error: purchasesError, count: purchasesCount } = await supabase
            .from('purchases')
            .select(`
                purchase_id, quantity_purchased, purchase_price_per_unit, total_purchase_price, purchase_date,
                items(item_name, item_categories(category_name))
            `, { count: 'exact' })
            .eq('character_id', currentCharacterId);

        if (purchasesError) throw purchasesError;

        const { data: cancelledListingsData, error: cancelledError, count: cancelledCount } = await supabase
            .from('market_listings')
            .select(`
                listing_id, listing_date, quantity_listed, listed_price_per_unit, total_listed_price, market_fee,
                items(item_name, item_categories(category_name))
            `, { count: 'exact' })
            .eq('character_id', currentCharacterId)
            .eq('is_cancelled', true);

        if (cancelledError) throw cancelledError;

        const { data: pveTransactionsData, error: pveError, count: pveCount } = await supabase
            .from('pve_transactions')
            .select(`
                transaction_id, transaction_date, gold_amount, description
            `, { count: 'exact' })
            .eq('character_id', currentCharacterId);

        if (pveError) throw pveError;

        const allTransactions = [];

        salesData.forEach(sale => {
            allTransactions.push({
                type: 'Sale',
                date: sale.sale_date,
                item_name: sale.market_listings?.items?.item_name,
                category_name: sale.market_listings?.items?.item_categories?.category_name,
                quantity: Math.round(sale.quantity_sold || 0),
                price_per_unit: Math.round(sale.sale_price_per_unit || 0),
                total_amount: Math.round(sale.total_sale_price || 0),
                fee: Math.round(sale.market_listings?.market_fee || 0)
            });
        });

        purchasesData.forEach(purchase => {
            allTransactions.push({
                type: 'Purchase',
                date: purchase.purchase_date,
                item_name: purchase.items?.item_name,
                category_name: purchase.items?.item_categories?.category_name,
                quantity: Math.round(purchase.quantity_purchased || 0),
                price_per_unit: Math.round(purchase.purchase_price_per_unit || 0),
                total_amount: Math.round(purchase.total_purchase_price || 0),
                fee: 0
            });
        });

        cancelledListingsData.forEach(listing => {
            allTransactions.push({
                type: 'Cancellation',
                date: listing.listing_date,
                item_name: listing.items?.item_name,
                category_name: listing.items?.item_categories?.category_name,
                quantity: Math.round(listing.quantity_listed || 0),
                price_per_unit: Math.round(listing.listed_price_per_unit || 0),
                total_amount: 0,
                fee: Math.round(listing.market_fee || 0)
            });
        });

        pveTransactionsData.forEach(pve => {
            allTransactions.push({
                type: 'PVE Gold',
                date: pve.transaction_date,
                item_name: pve.description || 'N/A',
                category_name: 'PVE',
                quantity: 1, // PVE is typically a single transaction for a gold amount
                price_per_unit: Math.round(pve.gold_amount || 0), // Use gold_amount as price per unit for PVE
                total_amount: Math.round(pve.gold_amount || 0),
                fee: 0
            });
        });

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalCount = salesCount + purchasesCount + cancelledCount + pveCount;
        
        const paginatedTransactions = allTransactions.slice(offset, offset + TRANSACTIONS_PER_PAGE);

        renderTransactionTable(paginatedTransactions);
        renderTransactionPagination(totalCount);

    } catch (error) {
        console.error('Error fetching transaction history:', error.message);
        await showCustomModal('Error', 'Could not fetch transaction history.', [{ text: 'OK', value: true }]);
    } finally {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'table';
    }
};

const renderTransactionTable = (transactions) => {
    if (!salesBody) return;
    salesBody.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No transactions recorded yet.</td></tr>';
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-100';

        // Adjust display for PVE transactions
        const itemNameDisplay = transaction.type === 'PVE Gold' ? transaction.item_name : (transaction.item_name || 'N/A');
        const quantityDisplay = transaction.type === 'PVE Gold' ? 'N/A' : (transaction.quantity?.toLocaleString() || 'N/A');
        const pricePerUnitDisplay = transaction.type === 'PVE Gold' ? transaction.total_amount?.toLocaleString() : (transaction.price_per_unit?.toLocaleString() || 'N/A');
        const totalAmountDisplay = transaction.type === 'PVE Gold' ? transaction.total_amount?.toLocaleString() : (transaction.total_amount?.toLocaleString() || 'N/A');


        row.innerHTML = `
            <td class="py-3 px-6 text-left whitespace-nowrap">${transaction.type}</td>
            <td class="py-3 px-6 text-left">${transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}</td>
            <td class="py-3 px-6 text-left whitespace-nowrap">${itemNameDisplay}</td>
            <td class="py-3 px-6 text-left">${transaction.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${quantityDisplay}</td>
            <td class="py-3 px-6 text-left">${pricePerUnitDisplay}</td>
            <td class="py-3 px-6 text-left">${totalAmountDisplay}</td>
            <td class="py-3 px-6 text-left">${transaction.fee?.toLocaleString() || 'N/A'}</td>
        `;
        salesBody.appendChild(row);
    });
};

const renderTransactionPagination = (totalCount) => {
    if (!salesPaginationContainer) return;
    const totalPages = Math.ceil(totalCount / TRANSACTIONS_PER_PAGE);
    salesPaginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (text, page, disabled = false, isCurrent = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        let classes = 'px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ';
        if (disabled) {
            classes += 'bg-gray-700 text-gray-500 cursor-not-allowed';
        } else if (isCurrent) {
            classes += 'bg-yellow-500 text-gray-900';
        } else {
            classes += 'bg-blue-500 hover:bg-blue-700 text-white';
        }
        button.className = classes;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            currentTransactionsPage = page;
            loadTransactionHistory();
        });
        return button;
    };

    salesPaginationContainer.appendChild(createButton('Previous', currentTransactionsPage - 1, currentTransactionsPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        salesPaginationContainer.appendChild(createButton(i, i, false, i === currentTransactionsPage));
    }

    salesPaginationContainer.appendChild(createButton('Next', currentTransactionsPage + 1, currentTransactionsPage === totalPages));
};

const handleDownloadCsv = async () => {
    if (!currentCharacterId) return;
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.disabled = true;
        downloadSalesCsvButton.textContent = 'Preparing Market History CSV...';
    }

    try {
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select(`
                sale_id, quantity_sold, sale_price_per_unit, total_sale_price, sale_date,
                market_listings!sales_listing_id_fkey!inner ( listing_id, character_id, market_fee, items(item_name, item_categories(category_name)) )
            `)
            .eq('market_listings.character_id', currentCharacterId);

        if (salesError) throw salesError;

        const { data: purchasesData, error: purchasesError } = await supabase
            .from('purchases')
            .select(`
                purchase_id, quantity_purchased, purchase_price_per_unit, total_purchase_price, purchase_date,
                items(item_name, item_categories(category_name))
            `)
            .eq('character_id', currentCharacterId);

        if (purchasesError) throw purchasesError;

        const { data: cancelledListingsData, error: cancelledError } = await supabase
            .from('market_listings')
            .select(`
                listing_id, listing_date, quantity_listed, listed_price_per_unit, total_listed_price, market_fee,
                items(item_name, item_categories(category_name))
            `)
            .eq('character_id', currentCharacterId)
            .eq('is_cancelled', true);

        if (cancelledError) throw cancelledError;

        const { data: pveTransactionsData, error: pveError } = await supabase
            .from('pve_transactions')
            .select(`
                transaction_id, transaction_date, gold_amount, description
            `)
            .eq('character_id', currentCharacterId);

        if (pveError) throw pveError;

        const allTransactions = [];

        salesData.forEach(sale => {
            allTransactions.push({
                type: 'Sale',
                date: sale.sale_date,
                item_name: sale.market_listings?.items?.item_name,
                category_name: sale.market_listings?.items?.item_categories?.category_name,
                quantity: Math.round(sale.quantity_sold || 0),
                price_per_unit: Math.round(sale.sale_price_per_unit || 0),
                total_amount: Math.round(sale.total_sale_price || 0),
                fee: Math.round(sale.market_listings?.market_fee || 0)
            });
        });

        purchasesData.forEach(purchase => {
            allTransactions.push({
                type: 'Purchase',
                date: purchase.purchase_date,
                item_name: purchase.items?.item_name,
                category_name: purchase.items?.item_categories?.category_name,
                quantity: Math.round(purchase.quantity_purchased || 0),
                price_per_unit: Math.round(purchase.purchase_price_per_unit || 0),
                total_amount: Math.round(purchase.total_purchase_price || 0),
                fee: 0
            });
        });

        cancelledListingsData.forEach(listing => {
            allTransactions.push({
                type: 'Cancellation',
                date: listing.listing_date,
                item_name: listing.items?.item_name,
                category_name: listing.items?.item_categories?.category_name,
                quantity: Math.round(listing.quantity_listed || 0),
                price_per_unit: Math.round(listing.listed_price_per_unit || 0),
                total_amount: 0,
                fee: Math.round(listing.market_fee || 0)
            });
        });

        pveTransactionsData.forEach(pve => {
            allTransactions.push({
                type: 'PVE Gold',
                date: pve.transaction_date,
                item_name: pve.description || 'N/A',
                category_name: 'PVE',
                quantity: 1,
                price_per_unit: Math.round(pve.gold_amount || 0),
                total_amount: Math.round(pve.gold_amount || 0),
                fee: 0
            });
        });

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const headers = ['Type', 'Date', 'Item Name', 'Category', 'Quantity', 'Price Per Unit', 'Total Amount', 'Fee'];
        const csvRows = [headers.join(',')];

        allTransactions.forEach(transaction => {
            const date = new Date(transaction.date).toLocaleDateString();
            const itemName = `"${transaction.type === 'PVE Gold' ? transaction.item_name : (transaction.item_name || 'N/A').replace(/"/g, '""')}"`;
            const category = `"${transaction.category_name || 'N/A'}"`;
            const quantity = transaction.type === 'PVE Gold' ? '' : (transaction.quantity?.toLocaleString() || '');
            const pricePerUnit = transaction.type === 'PVE Gold' ? transaction.total_amount?.toLocaleString() : (transaction.price_per_unit?.toLocaleString() || '');
            const totalAmount = transaction.total_amount?.toLocaleString() || '';
            const fee = transaction.fee?.toLocaleString() || '';

            csvRows.push([transaction.type, date, itemName, category, quantity, pricePerUnit, totalAmount, fee].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'market-activity-history.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        await showCustomModal('Success', 'Market activity history CSV generated successfully!', [{ text: 'OK', value: true }]);

    } catch (err) {
        console.error('Error generating CSV:', err.message);
        await showCustomModal('Error', 'Failed to generate market activity CSV file.', [{ text: 'OK', value: true }]);
    } finally {
        if (downloadSalesCsvButton) {
            downloadSalesCsvButton.disabled = false;
            downloadSalesCsvButton.textContent = 'Download Market History CSV';
        }
    }
};