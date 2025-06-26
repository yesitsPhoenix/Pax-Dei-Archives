import { supabase } from './supabaseClient.js';

const highestSalesList = document.getElementById('highest-sales-list');
const mostSoldQuantityList = document.getElementById('most-sold-quantity-list');
const topProfitableItemsList = document.getElementById('top-profitable-items-list');
const salesVolumeByCategoryList = document.getElementById('sales-volume-by-category-list');

let dailySalesChartInstance = null;
let dailyAvgPriceChartInstance = null;

const formatCurrency = (amount) => (amount !== null && amount !== undefined) ? amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A';
const formatDecimal = (amount, decimals = 2) => (amount !== null && amount !== undefined) ? parseFloat(amount).toFixed(decimals).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : 'N/A';

function renderChart(chartId, labels, data, label, borderColor, backgroundColor, type = 'line') {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return null;

    const cleanLabels = labels.filter((_, i) => data[i] != null);
    const cleanData = data.filter(v => v != null);

    const chartConfig = {
        type: type,
        data: {
            labels: cleanLabels,
            datasets: [{
                label: label,
                data: cleanData,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                tension: 0.3,
                fill: type === 'line'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: chartId.includes('daily-sales') || chartId.includes('daily-avg-price') ? 'time' : 'category',
                    time: chartId.includes('daily-sales') || chartId.includes('daily-avg-price') ? {
                        unit: 'day',
                        tooltipFormat: 'MMM d',
                        displayFormats: { day: 'MMM d' }
                    } : undefined,
                    ticks: { color: '#B0B0B0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    title: {
                        display: chartId.includes('daily-sales') || chartId.includes('daily-avg-price') ? true : false,
                        text: 'Date',
                        color: '#FFFFFF'
                    }
                },
                y: {
                    ticks: { color: '#B0B0B0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    title: { display: true, text: label, color: '#FFFFFF' }
                }
            },
            plugins: {
                legend: { labels: { color: '#FFFFFF' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.parsed.y;
                            if (chartId.includes('avg')) {
                                return `${context.dataset.label}: ${formatDecimal(value)} Gold`;
                            }
                            return `${context.dataset.label}: ${formatCurrency(value)} Gold`;
                        }
                    }
                }
            }
        }
    };

    if (chartId === 'daily-avg-price-chart') {
        chartConfig.options.scales.y.ticks.callback = function(value) {
            return formatDecimal(value);
        };
    } else if (chartId.includes('sales')) {
        chartConfig.options.scales.y.ticks.callback = function(value) {
            return formatCurrency(value);
        };
    }

    return new Chart(ctx, chartConfig);
}

async function loadHighestIndividualSales() {
    if (!highestSalesList) {
        return;
    }

    highestSalesList.innerHTML = '<p class="text-white">Loading highest sales...</p>';

    try {
        const { data, error } = await supabase.rpc('get_highest_individual_sale', { top_n_sales: 5 });

        if (error) {
            highestSalesList.innerHTML = '<p class="text-red-400">Error loading highest sales data.</p>';
            return;
        }

        if (data && data.length > 0) {
            highestSalesList.innerHTML = '';
            data.forEach((sale, index) => {
                const saleDiv = document.createElement('div');
                saleDiv.classList.add('p-2', 'bg-gray-700', 'rounded-sm', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'justify-between', 'items-center', 'gap-1');
                saleDiv.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <div>
                            <p class="text-white text-sm font-semibold">${sale.item_name}</p>
                            <p class="text-gray-400 text-xs">Category: ${sale.category_name}</p>
                        </div>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Total Sale: <span class="font-bold">${formatCurrency(sale.total_sale_price)} <i class="fas fa-coins"></i></span></p>
                        <p class="text-gray-400">Qty Sold: ${sale.quantity_sold || 'N/A'} | Price/Unit: ${formatDecimal(sale.sale_price_per_unit)}</p>
                        <p class="text-gray-400">Stack Qty: ${sale.listed_quantity || 'N/A'} | Stack Price: ${formatCurrency(sale.listed_total_price)}</p>
                    </div>
                `;
                highestSalesList.appendChild(saleDiv);
            });
        } else {
            highestSalesList.innerHTML = '<p class="text-white">No highest sales data found yet.</p>';
        }
    } catch (err) {
        highestSalesList.innerHTML = '<p class="text-red-400">An unexpected error occurred.</p>';
    }
}

async function loadMostSoldItemsByQuantity() {
    if (!mostSoldQuantityList) {
        return;
    }

    mostSoldQuantityList.innerHTML = '<p class="text-white">Loading most sold items...</p>';

    try {
        const { data, error } = await supabase.rpc('get_most_items_sold_by_quantity', { top_n_items: 10 });

        if (error) {
            mostSoldQuantityList.innerHTML = '<p class="text-red-400">Error loading most sold items data.</p>';
            return;
        }

        if (data && data.length > 0) {
            mostSoldQuantityList.innerHTML = '';
            data.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('p-2', 'bg-gray-700', 'rounded-sm', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'justify-between', 'items-center', 'gap-1');
                itemDiv.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <div>
                            <p class="text-white text-sm font-semibold">${item.item_name}</p>
                            <p class="text-gray-400 text-xs">Category: ${item.category_name}</p>
                        </div>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Sold: <span class="font-bold">${item.total_quantity_sold || 'N/A'}</span></p>
                        <p class="text-gray-400">Avg. Price/Unit: ${formatDecimal(item.average_price_per_unit)}</p>
                        <p class="text-gray-400">Avg. Stack Qty: ${item.avg_stack_quantity !== null && item.avg_stack_quantity !== undefined ? formatDecimal(item.avg_stack_quantity, 0) : 'N/A'} | Avg. Stack Price: ${item.avg_stack_price !== null && item.avg_stack_price !== undefined ? formatCurrency(item.avg_stack_price) : 'N/A'}</p>
                    </div>
                `;
                mostSoldQuantityList.appendChild(itemDiv);
            });
        } else {
            mostSoldQuantityList.innerHTML = '<p class="text-white">No items sold yet.</p>';
        }
    } catch (err) {
        mostSoldQuantityList.innerHTML = '<p class="text-red-400">An unexpected error occurred.</p>';
    }
}

async function loadTopProfitableItems() {
    if (!topProfitableItemsList) {
        return;
    }

    topProfitableItemsList.innerHTML = '<p class="text-white">Loading profitable items...</p>';

    try {
        const { data, error } = await supabase.rpc('get_top_profitable_items', { top_n_items: 5 });

        if (error) {
            topProfitableItemsList.innerHTML = '<p class="text-red-400">Error loading profitable items data.</p>';
            return;
        }

        if (data && data.length > 0) {
            topProfitableItemsList.innerHTML = '';
            data.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('p-2', 'bg-gray-700', 'rounded-sm', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'justify-between', 'items-center', 'gap-1');
                itemDiv.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <div>
                            <p class="text-white text-sm font-semibold">${item.item_name}</p>
                            <p class="text-gray-400 text-xs">Category: ${item.category_name}</p>
                        </div>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Net Profit: <span class="font-bold">${formatCurrency(item.total_net_profit)} <i class="fas fa-coins"></i></span></p>
                    </div>
                `;
                topProfitableItemsList.appendChild(itemDiv);
            });
        } else {
            topProfitableItemsList.innerHTML = '<p class="text-white">No profitable items data found yet.</p>';
        }
    } catch (err) {
        topProfitableItemsList.innerHTML = '<p class="text-red-400">An unexpected error occurred.</p>';
    }
}

async function loadSalesVolumeByCategory() {
    if (!salesVolumeByCategoryList) {
        return;
    }

    salesVolumeByCategoryList.innerHTML = '<p class="text-white">Loading sales volume...</p>';

    try {
        const { data, error } = await supabase.rpc('get_sales_volume_by_category', { top_n_categories: 5 });

        if (error) {
            salesVolumeByCategoryList.innerHTML = '<p class="text-red-400">Error loading sales volume data.</p>';
            return;
        }

        if (data && data.length > 0) {
            salesVolumeByCategoryList.innerHTML = '';
            data.forEach((category, index) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('p-2', 'bg-gray-700', 'rounded-sm', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'justify-between', 'items-center', 'gap-1');
                categoryDiv.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <p class="text-white text-sm font-semibold">${category.category_name}</p>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Total Quantity Sold: <span class="font-bold">${category.total_quantity_sold || 'N/A'}</span></p>
                    </div>
                `;
                salesVolumeByCategoryList.appendChild(categoryDiv);
            });
        } else {
            salesVolumeByCategoryList.innerHTML = '<p class="text-white">No sales volume data found yet.</p>';
        }
    } catch (err) {
        salesVolumeByCategoryList.innerHTML = '<p class="text-red-400">An unexpected error occurred.</p>';
    }
}

async function loadDailyTotalSalesChart() {
    try {
        const { data, error } = await supabase.rpc('get_daily_total_sales');

        if (error) {
            return;
        }

        const labels = data.map(row => row.sale_date);
        const totalSales = data.map(row => row.total_gold_sold);

        if (dailySalesChartInstance) {
            dailySalesChartInstance.destroy();
        }
        dailySalesChartInstance = renderChart(
            'daily-sales-chart',
            labels,
            totalSales,
            'Daily Sales Revenue',
            'rgb(75, 192, 192)',
            'rgba(75, 192, 192, 0.2)'
        );

    } catch (err) {
    }
}

async function loadDailyAveragePriceChart() {
    try {
        const { data, error } = await supabase.rpc('get_daily_average_sale_price');

        if (error) {
            return;
        }

        const labels = data.map(row => row.sale_date);
        const avgPrices = data.map(row => row.average_price);

        if (dailyAvgPriceChartInstance) {
            dailyAvgPriceChartInstance.destroy();
        }
        dailyAvgPriceChartInstance = renderChart(
            'daily-avg-price-chart',
            labels,
            avgPrices,
            'Average Item Price',
            'rgb(255, 99, 132)',
            'rgba(255, 99, 132, 0.2)'
        );

    } catch (err) {
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadHighestIndividualSales();
    await loadMostSoldItemsByQuantity();
    await loadTopProfitableItems();
    await loadSalesVolumeByCategory();
    await loadDailyTotalSalesChart();
    await loadDailyAveragePriceChart();
});