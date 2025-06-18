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
let fullTransactionHistory = [];

export const initializeSales = () => {
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.addEventListener('click', handleDownloadCsv);
    }
};

export const loadTransactionHistory = (transactions) => {
    fullTransactionHistory = transactions || [];

    if (!currentCharacterId) {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'table';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Please select a character or create one to view transaction history.</td></tr>';
        return;
    }

    if (salesLoader) salesLoader.style.display = 'block';
    if (salesTable) salesTable.style.display = 'none';

    try {
        const offset = (currentTransactionsPage - 1) * TRANSACTIONS_PER_PAGE;
        const paginatedTransactions = fullTransactionHistory.slice(offset, offset + TRANSACTIONS_PER_PAGE);
        
        renderTransactionTable(paginatedTransactions);
        renderTransactionPagination(fullTransactionHistory.length);

    } catch (error) {
        console.error('Error rendering transaction history:', error.message);
        showCustomModal('Error', 'Could not render transaction history.', [{ text: 'OK', value: true }]);
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
            loadTransactionHistory(fullTransactionHistory);
        });
        return button;
    };

    salesPaginationContainer.appendChild(createButton('Previous', currentTransactionsPage - 1, currentTransactionsPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        salesPaginationContainer.appendChild(createButton(i, i, false, i === currentTransactionsPage));
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
        const headers = ['Type', 'Date', 'Item Name', 'Category', 'Quantity', 'Price Per Unit', 'Total Amount', 'Fee'];
        const csvRows = [headers.join(',')];

        fullTransactionHistory.forEach(transaction => {
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
