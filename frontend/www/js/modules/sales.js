import { supabase } from '../supabaseClient.js';
import { showCustomModal } from '../trader.js';
import { currentCharacterId } from './characters.js';

const salesLoader = document.getElementById('sales-loader');
const salesBody = document.getElementById('sales-body');
const salesTable = document.getElementById('sales-table');
const salesPaginationContainer = document.getElementById('sales-pagination');
const downloadSalesCsvButton = document.getElementById('download-sales-csv');

const SALES_PER_PAGE = 10;
let currentSalesPage = 1;

export const initializeSales = () => {
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.addEventListener('click', handleDownloadCsv);
    }
};

export const loadSalesHistory = async () => {
    if (!currentCharacterId) {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'none';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Please select a character or create one to view sales history.</td></tr>';
        return;
    }

    if (salesLoader) salesLoader.style.display = 'block';
    if (salesTable) salesTable.style.display = 'none';

    try {
        const offset = (currentSalesPage - 1) * SALES_PER_PAGE;
        const { data: sales, error, count } = await supabase
            .from('sales')
            .select(`
                sale_id, quantity_sold, sale_price_per_unit, total_sale_price, sale_date,
                market_listings!inner ( listing_id, character_id, items(item_name, item_categories(category_name)) )
            `, { count: 'exact' })
            .eq('market_listings.character_id', currentCharacterId)
            .order('sale_date', { ascending: false })
            .range(offset, offset + SALES_PER_PAGE - 1);

        if (error) throw error;

        renderSalesTable(sales);
        renderSalesPagination(count);

    } catch (error) {
        console.error('Error fetching sales:', error.message);
        await showCustomModal('Error', 'Could not fetch sales history.', [{ text: 'OK', value: true }]);
    } finally {
        if (salesLoader) salesLoader.style.display = 'none';
        if (salesTable) salesTable.style.display = 'table';
    }
};

const renderSalesTable = (sales) => {
    if (!salesBody) return;
    salesBody.innerHTML = '';
    if (!sales || sales.length === 0) {
        salesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No sales recorded yet.</td></tr>';
        return;
    }

    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-100';
        row.innerHTML = `
            <td class="py-3 px-6 text-left whitespace-nowrap">${sale.market_listings?.items?.item_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.market_listings?.items?.item_categories?.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.quantity_sold?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.sale_price_per_unit?.toFixed(2) || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.total_sale_price?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A'}</td>
        `;
        salesBody.appendChild(row);
    });
};

const renderSalesPagination = (totalCount) => {
    if (!salesPaginationContainer) return;
    const totalPages = Math.ceil(totalCount / SALES_PER_PAGE);
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
            currentSalesPage = page;
            loadSalesHistory();
        });
        return button;
    };

    salesPaginationContainer.appendChild(createButton('Previous', currentSalesPage - 1, currentSalesPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        salesPaginationContainer.appendChild(createButton(i, i, false, i === currentSalesPage));
    }

    salesPaginationContainer.appendChild(createButton('Next', currentSalesPage + 1, currentSalesPage === totalPages));
};

const handleDownloadCsv = async () => {
    if (!currentCharacterId) return;
    if (downloadSalesCsvButton) {
        downloadSalesCsvButton.disabled = true;
        downloadSalesCsvButton.textContent = 'Preparing...';
    }

    try {
        const { data: sales, error } = await supabase
            .from('sales')
            .select(`
                sale_date,
                quantity_sold,
                total_sale_price,
                market_listings!inner ( listing_id, character_id, items(item_name, item_categories(category_name)) )
            `)
            .eq('market_listings.character_id', currentCharacterId)
            .order('sale_date', { ascending: false });

        if (error) throw error;

        const headers = ['Date', 'Item Name', 'Category', 'Quantity Sold', 'Total Sale Price'];
        const csvRows = [headers.join(',')];

        sales.forEach(sale => {
            const date = new Date(sale.sale_date).toLocaleDateString();
            const itemName = `"${sale.market_listings?.items?.item_name || 'N/A'}"`;
            const category = `"${sale.market_listings?.items?.item_categories?.category_name || 'N/A'}"`;
            const quantity = sale.quantity_sold;
            const price = sale.total_sale_price;
            csvRows.push([date, itemName, category, quantity, price].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sales-history.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error('Error generating CSV:', err.message);
        await showCustomModal('Error', 'Failed to generate CSV file.', [{ text: 'OK', value: true }]);
    } finally {
        if (downloadSalesCsvButton) {
            downloadSalesCsvButton.disabled = false;
            downloadSalesCsvButton.textContent = 'Download Sales CSV';
        }
    }
};
