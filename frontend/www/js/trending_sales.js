import { supabase } from './supabaseClient.js';

const highestSalesList = document.getElementById('highest-sales-list');
const mostSoldQuantityList = document.getElementById('most-sold-quantity-list');
const topRevenueItemsList = document.getElementById('top-profitable-items-list');
const salesVolumeByCategoryList = document.getElementById('sales-volume-by-category-list');

let dailySalesChartInstance = null;
let dailyAvgPriceChartInstance = null;
let specificItemPriceChartInstance = null;

let currentSelectedRegion = null;
let currentSelectedItemId = null;

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
                    type: chartId.includes('daily') || chartId.includes('specific-item-price') ? 'time' : 'category',
                    time: chartId.includes('daily') || chartId.includes('specific-item-price') ? {
                        unit: 'day',
                        tooltipFormat: 'MMM d',
                        displayFormats: { day: 'MMM d' }
                    } : undefined,
                    ticks: { color: '#B0B0B0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    title: {
                        display: chartId.includes('daily') || chartId.includes('specific-item-price') ? true : false,
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
                            if (chartId.includes('avg') || chartId.includes('specific-item-price')) {
                                return `${context.dataset.label}: ${formatDecimal(value)} Gold`;
                            }
                            return `${context.dataset.label}: ${formatCurrency(value)} Gold`;
                        }
                    }
                }
            }
        }
    };

    if (chartId === 'daily-avg-price-chart' || chartId === 'specific-item-price-chart') {
        chartConfig.options.scales.y.ticks.callback = function(value) {
            return formatDecimal(value);
        };
    } else if (chartId.includes('sales')) {
        chartConfig.options.scales.y.ticks.callback = function(value) {
            return formatCurrency(value);
        };
    }

    const newChart = new Chart(ctx, chartConfig);

    if (chartId === 'daily-sales-chart' && dailySalesChartInstance) {
        dailySalesChartInstance.destroy();
        dailySalesChartInstance = null;
    } else if (chartId === 'daily-avg-price-chart' && dailyAvgPriceChartInstance) {
        dailyAvgPriceChartInstance.destroy();
        dailyAvgPriceChartInstance = null;
    } else if (chartId === 'specific-item-price-chart' && specificItemPriceChartInstance) {
        specificItemPriceChartInstance.destroy();
        specificItemPriceChartInstance = null;
    }

    return newChart;
}

async function loadListTrendsData(region = null) {
    if (!highestSalesList || !mostSoldQuantityList || !topRevenueItemsList || !salesVolumeByCategoryList) {
        return;
    }

    highestSalesList.innerHTML = '<p class="text-white">Loading highest sales...</p>';
    mostSoldQuantityList.innerHTML = '<p class="text-white">Loading most sold items...</p>';
    topRevenueItemsList.innerHTML = '<p class="text-white">Loading revenue items...</p>';
    salesVolumeByCategoryList.innerHTML = '<p class="text-white">Loading sales volume...</p>';

    try {
        const { data, error } = await supabase.rpc('get_all_list_trends_data_by_region', { region_filter: region });

        if (error) {
            console.error("Error loading all list trends data:", error);
            const errorMessage = `<p class="text-red-400">Error loading data: ${error.message}</p>`;
            highestSalesList.innerHTML = errorMessage;
            mostSoldQuantityList.innerHTML = errorMessage;
            topRevenueItemsList.innerHTML = errorMessage;
            salesVolumeByCategoryList.innerHTML = errorMessage;
            return;
        }

        const highestSales = data?.highest_individual_sales || [];
        if (highestSales.length > 0) {
            highestSalesList.innerHTML = highestSales.map((sale, index) => `
                <div class="p-2 bg-gray-700 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-center gap-1">
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
                </div>
            `).join('');
        } else {
            highestSalesList.innerHTML = '<p class="text-white">No highest sales data found yet.</p>';
        }

        const mostSoldItems = data?.most_sold_items_by_quantity || [];
        if (mostSoldItems.length > 0) {
            mostSoldQuantityList.innerHTML = mostSoldItems.map((item, index) => `
                <div class="p-2 bg-gray-700 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-center gap-1">
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
                </div>
            `).join('');
        } else {
            mostSoldQuantityList.innerHTML = '<p class="text-white">No items sold yet.</p>';
        }

        const topRevenueItems = data?.top_profitable_items || [];
        if (topRevenueItems.length > 0) {
            topRevenueItemsList.innerHTML = topRevenueItems.map((item, index) => `
                <div class="p-2 bg-gray-700 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-center gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <div>
                            <p class="text-white text-sm font-semibold">${item.item_name}</p>
                            <p class="text-gray-400 text-xs">Category: ${item.category_name}</p>
                        </div>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Total Revenue: <span class="font-bold">${formatCurrency(item.total_revenue)} <i class="fas fa-coins"></i></span></p>
                    </div>
                </div>
            `).join('');
        } else {
            topRevenueItemsList.innerHTML = '<p class="text-white">No revenue items data found yet.</p>';
        }

        const salesVolumeByCategory = data?.sales_volume_by_category || [];
        if (salesVolumeByCategory.length > 0) {
            salesVolumeByCategoryList.innerHTML = salesVolumeByCategory.map((category, index) => `
                <div class="p-2 bg-gray-700 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-center gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold text-gold-400">${index + 1}.</span>
                        <p class="text-white text-sm font-semibold">${category.category_name}</p>
                    </div>
                    <div class="text-right text-xs">
                        <p class="text-white text-sm">Total Quantity Sold: <span class="font-bold">${category.total_quantity_sold || 'N/A'}</span></p>
                    </div>
                </div>
            `).join('');
        } else {
            salesVolumeByCategoryList.innerHTML = '<p class="text-white">No sales volume data found yet.</p>';
        }

    } catch (err) {
        console.error("An unexpected error occurred loading list trends data:", err);
        const errorMessage = `<p class="text-red-400">An error occurred: ${err.message}</p>`;
        highestSalesList.innerHTML = errorMessage;
        mostSoldQuantityList.innerHTML = errorMessage;
        topRevenueItemsList.innerHTML = errorMessage;
        salesVolumeByCategoryList.innerHTML = errorMessage;
    }
}

async function loadDailyTotalSalesChart(region = null) {
    try {
        const { data, error } = await supabase.rpc('get_daily_total_sales', { region_filter: region });

        if (error) {
            console.error("Error loading daily total sales chart:", error);
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
            'Total Gold Sold',
            'rgb(75, 192, 192)',
            'rgba(75, 192, 192, 0.2)'
        );

    } catch (err) {
        console.error("An unexpected error occurred loading daily total sales chart:", err);
    }
}

async function loadDailyAveragePriceChart(region = null) {
    try {
        const { data, error } = await supabase.rpc('get_daily_average_sale_price', { region_filter: region });

        if (error) {
            console.error("Error loading daily average price chart:", error);
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
        console.error("An unexpected error occurred loading daily average price chart:", err);
    }
}

async function loadSpecificItemPriceChart(itemId = null, region = null, shard = null, province = null, homeValley = null) {
    if (!itemId || itemId === 'all') {
        if (specificItemPriceChartInstance) {
            specificItemPriceChartInstance.destroy();
            specificItemPriceChartInstance = null;
        }
        const ctx = document.getElementById('specific-item-price-chart')?.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            const text = 'Please select an item to view its price trend.';
            let fontSize = 16;
            const maxWidth = ctx.canvas.width - 20;

            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';

            do {
                ctx.font = `${fontSize}px Arial`;
                const textWidth = ctx.measureText(text).width;
                if (textWidth <= maxWidth || fontSize <= 10) {
                    break;
                }
                fontSize--;
            } while (true);
            
            ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
        return;
    }

    try {
        const { data, error } = await supabase.rpc('get_item_price_history', {
            p_item_id: itemId
        });

        if (error) {
            console.error(`Error loading price history for item ${itemId}:`, error);
            return;
        }

        const labels = data.map(row => row.sale_date);
        const prices = data.map(row => row.average_price);
        const itemName = data.length > 0 ? data[0].item_name : `Item ID: ${itemId}`;

        if (specificItemPriceChartInstance) {
            specificItemPriceChartInstance.destroy();
        }
        specificItemPriceChartInstance = renderChart(
            'specific-item-price-chart',
            labels,
            prices,
            `${itemName} Price`,
            'rgb(54, 162, 235)',
            'rgba(54, 162, 235, 0.2)'
        );

    } catch (err) {
        console.error("An unexpected error occurred loading specific item price chart:", err);
    }
}

async function populateDropdown(selectElementId, rpcFunctionName, valueColumn, textColumn, defaultOptionText) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;

    selectElement.innerHTML = `<option value="all">${defaultOptionText}</option>`;
    try {
        const { data, error } = await supabase.rpc(rpcFunctionName);
        if (error) {
            console.error(`Error fetching data for ${selectElementId}:`, error);
            return;
        }
        data.forEach(row => {
            const option = document.createElement('option');
            option.value = row[valueColumn];
            option.textContent = row[textColumn];
            selectElement.appendChild(option);
        });
    } catch (err) {
        console.error(`An unexpected error occurred populating ${selectElementId}:`, err);
    }
}

async function loadAllTrendsData() {
    await loadListTrendsData(currentSelectedRegion);
    await loadDailyTotalSalesChart(currentSelectedRegion);
    await loadDailyAveragePriceChart(currentSelectedRegion);
    await loadSpecificItemPriceChart(currentSelectedItemId, currentSelectedRegion, null, null, null);
}

document.addEventListener('DOMContentLoaded', async () => {
    const regionFilterSelect = document.getElementById('region-filter-select');
    const itemFilterSelect = document.getElementById('item-filter-select');

    await populateDropdown('item-filter-select', 'get_all_items_for_dropdown', 'item_id', 'item_name', 'All Items');

    currentSelectedItemId = itemFilterSelect ? parseInt(itemFilterSelect.value, 10) || null : null;


    await loadAllTrendsData();

    if (regionFilterSelect) {
        regionFilterSelect.addEventListener('change', (event) => {
            currentSelectedRegion = event.target.value === 'all' || event.target.value === '' ? null : event.target.value;
            loadAllTrendsData();
        });
    }

    if (itemFilterSelect) {
        itemFilterSelect.addEventListener('change', (event) => {
            currentSelectedItemId = event.target.value === 'all' || event.target.value === '' ? null : parseInt(event.target.value, 10);
            loadSpecificItemPriceChart(currentSelectedItemId, currentSelectedRegion, null, null, null);
        });
    }
});