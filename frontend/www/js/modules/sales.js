import { supabase } from '../supabaseClient.js';
import { showCustomModal } from '../trader.js';
import { currentCharacterId } from './characters.js';
import { updateUtcClock } from '../main.js';

const salesLoader = document.getElementById('sales-loader');
const salesBody = document.getElementById('sales-body');
const salesTable = document.getElementById('sales-table');
const salesPaginationContainer = document.getElementById('sales-pagination');
const downloadSalesCsvButton = document.getElementById('download-sales-csv');
const utcClockDisplay = document.getElementById('utc-clock-display');

const transactionSearchInput = document.getElementById('transaction-search-input');
const transactionCategoryFilter = document.getElementById('transaction-category-filter');
const transactionTypeFilter = document.getElementById('transaction-type-filter');
const transactionSortBy = document.getElementById('transaction-sort-by');
const transactionSortDirection = document.getElementById('transaction-sort-direction');

const TRANSACTIONS_PER_PAGE = 15;
let currentTransactionsPage = 1;
let fullTransactionHistory = [];
let availableCategories = new Set();
let availableTransactionTypes = new Set();

export const initializeSales = () => {
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.addEventListener('click', handleDownloadCsv);
    }
    if (utcClockDisplay) {
        updateUtcClock(utcClockDisplay);
        setInterval(() => updateUtcClock(utcClockDisplay), 1000);
    }

    if (transactionSearchInput) {
        transactionSearchInput.addEventListener('input', applyTransactionFilters);
    }
    if (transactionCategoryFilter) {
        transactionCategoryFilter.addEventListener('change', applyTransactionFilters);
    }
    if (transactionTypeFilter) { 
        transactionTypeFilter.addEventListener('change', applyTransactionFilters);
    }
    if (transactionSortBy) {
        transactionSortBy.addEventListener('change', applyTransactionFilters);
    }
    if (transactionSortDirection) {
        transactionSortDirection.addEventListener('change', applyTransactionFilters);
    }
};

export const loadTransactionHistory = (transactions) => {
    fullTransactionHistory = transactions || [];
    availableCategories.clear();
    availableTransactionTypes.clear(); 
    fullTransactionHistory.forEach(transaction => {
        if (transaction.category_name) {
            availableCategories.add(transaction.category_name);
        }
        if (transaction.type) { 
            availableTransactionTypes.add(transaction.type);
        }
    });
    populateCategoryFilter();
    populateTypeFilter(); 

    if (!currentCharacterId) {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'table';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Please select a character or create one to view transaction history.</td></tr>'; // Updated colspan
        return;
    }
    if (salesLoader) salesLoader.style.display = 'block';
    if (salesTable) salesTable.style.display = 'none';
    
    currentTransactionsPage = 1; 
    applyTransactionFilters();
};

const populateCategoryFilter = () => {
    if (!transactionCategoryFilter) return;
    transactionCategoryFilter.innerHTML = '<option value="">All Categories</option>';
    Array.from(availableCategories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        transactionCategoryFilter.appendChild(option);
    });
};

const populateTypeFilter = () => {
    if (!transactionTypeFilter) return;
    transactionTypeFilter.innerHTML = '<option value="">All Types</option>';
    Array.from(availableTransactionTypes).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        transactionTypeFilter.appendChild(option);
    });
};


const applyTransactionFilters = () => {
    let filteredTransactions = [...fullTransactionHistory];

    const searchTerm = transactionSearchInput ? transactionSearchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filteredTransactions = filteredTransactions.filter(transaction =>
            (transaction.item_name && transaction.item_name.toLowerCase().includes(searchTerm)) ||
            (transaction.type && transaction.type.toLowerCase().includes(searchTerm)) ||
            (transaction.description && transaction.description.toLowerCase().includes(searchTerm)) ||
            (transaction.market_stall_name && transaction.market_stall_name.toLowerCase().includes(searchTerm))
        );
    }

    const categoryFilter = transactionCategoryFilter ? transactionCategoryFilter.value : '';
    if (categoryFilter) {
        filteredTransactions = filteredTransactions.filter(transaction =>
            transaction.category_name === categoryFilter
        );
    }

    const typeFilter = transactionTypeFilter ? transactionTypeFilter.value : '';
    if (typeFilter) {
        filteredTransactions = filteredTransactions.filter(transaction =>
            transaction.type === typeFilter
        );
    }

    const sortBy = transactionSortBy ? transactionSortBy.value : 'date';
    const sortDirection = transactionSortDirection ? transactionSortDirection.value : 'desc';

    filteredTransactions.sort((a, b) => {
        let valA, valB;

        if (sortBy === 'date') {
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
        } else if (sortBy === 'type') {
            valA = a.type.toLowerCase();
            valB = b.type.toLowerCase();
        } else if (sortBy === 'item_name') {
            valA = (a.item_name || '').toLowerCase();
            valB = (b.item_name || '').toLowerCase();
        } else if (sortBy === 'category') {
            valA = (a.category_name || '').toLowerCase();
            valB = (b.category_name || '').toLowerCase();
        } else if (sortBy === 'market_stall') {
            valA = (a.market_stall_name || '').toLowerCase();
            valB = (b.market_stall_name || '').toLowerCase();
        } else if (sortBy === 'total_amount') {
            valA = a.total_amount || 0;
            valB = b.total_amount || 0;
        } else if (sortBy === 'fee') {
            valA = a.fee || 0;
            valB = b.fee || 0;
        } else {
            return 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    const offset = (currentTransactionsPage - 1) * TRANSACTIONS_PER_PAGE;
    const paginatedTransactions = filteredTransactions.slice(offset, offset + TRANSACTIONS_PER_PAGE);

    renderTransactionTable(paginatedTransactions);
    renderTransactionPagination(filteredTransactions.length);

    if (salesLoader) salesLoader.style.display = 'none';
    if (salesTable) salesTable.style.display = 'table';
};

const renderTransactionTable = (transactions) => {
    if (!salesBody) return;
    salesBody.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No transactions recorded yet.</td></tr>';
        return;
    }
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-100';
        const itemNameDisplay = transaction.type === 'PVE Gold' ? transaction.item_name : (transaction.item_name || 'N/A');
        const quantityDisplay = transaction.type === 'PVE Gold' ? 'N/A' : (transaction.quantity?.toLocaleString() || 'N/A');
        const pricePerUnitDisplay = (parseFloat(transaction.price_per_unit || transaction.total_amount) || 0).toFixed(2);
        const totalAmountDisplay = (parseFloat(transaction.total_amount) || 0).toFixed(2);
        const utcDateOnlyDisplay = transaction.date ? new Date(transaction.date).toISOString().substring(0, 10) : 'N/A';
        row.innerHTML = `
            <td class="py-3 px-6 text-left whitespace-nowrap">${transaction.type}</td>
            <td class="py-3 px-6 text-left">${utcDateOnlyDisplay}</td>
            <td class="py-3 px-6 text-left whitespace-nowrap">${itemNameDisplay}</td>
            <td class="py-3 px-6 text-left">${transaction.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left whitespace-nowrap">${transaction.market_stall_name || 'N/A'}</td> <td class="py-3 px-6 text-right">${quantityDisplay}</td>
            <td class="py-3 px-6 text-right">${pricePerUnitDisplay}</td>
            <td class="py-3 px-6 text-right">${totalAmountDisplay}</td>
            <td class="py-3 px-6 text-right">${(parseFloat(transaction.fee) || 0).toFixed(2)}</td>
        `;
        salesBody.appendChild(row);
    });
};

const renderTransactionPagination = (totalCount) => {
    if (!salesPaginationContainer) return;
    const totalPages = Math.ceil(totalCount / TRANSACTIONS_PER_PAGE);
    salesPaginationContainer.innerHTML = '';
    if (totalPages <= 1) return;
    
    const MAX_VISIBLE_PAGES = 7; 
    const halfVisiblePages = Math.floor(MAX_VISIBLE_PAGES / 2);

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
        if (!disabled) {
            button.addEventListener('click', () => {
                currentTransactionsPage = page;
                applyTransactionFilters();
            });
        }
        return button;
    };
    
    salesPaginationContainer.appendChild(createButton('Previous', currentTransactionsPage - 1, currentTransactionsPage === 1));

    let startPage = Math.max(1, currentTransactionsPage - halfVisiblePages);
    let endPage = Math.min(totalPages, currentTransactionsPage + halfVisiblePages);

    if (endPage - startPage + 1 < MAX_VISIBLE_PAGES) {
        if (currentTransactionsPage <= halfVisiblePages) {
            endPage = Math.min(totalPages, MAX_VISIBLE_PAGES);
            startPage = 1;
        } else if (currentTransactionsPage > totalPages - halfVisiblePages) {
            startPage = Math.max(1, totalPages - MAX_VISIBLE_PAGES + 1);
            endPage = totalPages;
        }
    }

    if (startPage > 1) {
        salesPaginationContainer.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            salesPaginationContainer.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        salesPaginationContainer.appendChild(createButton(i, i, false, i === currentTransactionsPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            salesPaginationContainer.appendChild(ellipsis);
        }
        salesPaginationContainer.appendChild(createButton(totalPages, totalPages));
    }
    
    salesPaginationContainer.appendChild(createButton('Next', currentTransactionsPage + 1, currentTransactionsPage === totalPages));
};

export const handleDownloadCsv = async () => {
    if (!currentCharacterId) return;
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.disabled = true;
        downloadSalesCsvButton.textContent = 'Preparing Market History CSV...';
    }
    try {
        const headers = ['Type', 'Date (UTC)', 'Item Name', 'Category', 'Market Stall', 'Quantity', 'Price Per Unit', 'Total Amount', 'Fee']; 
        const csvRows = [headers.join(',')];
        fullTransactionHistory.forEach(transaction => {
            const date = transaction.date ? new Date(transaction.date).toISOString() : 'N/A';
            const itemName = `"${transaction.type === 'PVE Gold' ? transaction.item_name : (transaction.item_name || 'N/A').replace(/"/g, '""')}"`;
            const category = `"${transaction.category_name || 'N/A'}"`;
            const marketStall = `"${(transaction.market_stall_name || '').replace(/"/g, '""')}"`;
            const quantity = transaction.type === 'PVE Gold' ? '' : (transaction.quantity?.toLocaleString() || '');
            const pricePerUnit = (parseFloat(transaction.price_per_unit || transaction.total_amount) || 0).toFixed(2);
            const totalAmount = (parseFloat(transaction.total_amount) || 0).toFixed(2);
            const fee = (parseFloat(transaction.fee) || 0).toFixed(2);
            csvRows.push([transaction.type, date, itemName, category, marketStall, quantity, pricePerUnit, totalAmount, fee].join(','));
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