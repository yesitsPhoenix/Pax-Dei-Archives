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
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d,yyyy'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value',
                        color: '#ffffff'
                    },
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    };

    let chartInstance;
    if (chartId === 'daily-sales-chart' && dailySalesChartInstance) {
        dailySalesChartInstance.destroy();
    } else if (chartId === 'daily-avg-price-chart' && dailyAvgPriceChartInstance) {
        dailyAvgPriceChartInstance.destroy();
    } else if (chartId === 'specific-item-price-chart' && specificItemPriceChartInstance) {
        specificItemPriceChartInstance.destroy();
    }

    chartInstance = new Chart(ctx, chartConfig);

    if (chartId === 'daily-sales-chart') {
        dailySalesChartInstance = chartInstance;
    } else if (chartId === 'daily-avg-price-chart') {
        dailyAvgPriceChartInstance = chartInstance;
    } else if (chartId === 'specific-item-price-chart') {
        specificItemPriceChartInstance = chartInstance;
    }

    return chartInstance;
}

async function populateDropdown(selectElementId, rpcFunctionName, valueColumn, textColumn, allOptionText) {
    try {
        const selectElement = document.getElementById(selectElementId);
        if (!selectElement) {
            console.warn(`Select element with ID ${selectElementId} not found.`);
            return;
        }

        const { data, error } = await supabase.rpc(rpcFunctionName);

        if (error) {
            console.error(`Error fetching data for ${selectElementId}:`, error);
            return;
        }

        selectElement.innerHTML = ''; // Clear existing options

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = allOptionText;
        selectElement.appendChild(allOption);

        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueColumn];
            option.textContent = item[textColumn];
            selectElement.appendChild(option);
        });

    } catch (err) {
        console.error(`An unexpected error occurred populating ${selectElementId}:`, err);
    }
}

async function loadDailyTotalSalesChart(region = null) {
    try {
        // Changed parameter name to region_filter
        const { data, error } = await supabase.rpc('get_daily_total_sales', { region_filter: region });

        if (error) {
            console.error('Error fetching daily total sales:', error);
            return;
        }

        const dates = data.map(row => row.sale_date);
        const totalSales = data.map(row => row.total_sales);
        renderChart('daily-sales-chart', dates, totalSales, 'Daily Total Sales', 'rgb(75, 192, 192)', 'rgba(75, 192, 192, 0.5)');
    } catch (err) {
        console.error('An unexpected error occurred loading daily total sales chart:', err);
    }
}

async function loadDailyAveragePriceChart(region = null) {
    try {
        // Changed function name to get_daily_average_sale_price and parameter name to region_filter
        const { data, error } = await supabase.rpc('get_daily_average_sale_price', { region_filter: region });

        if (error) {
            console.error('Error fetching daily average price:', error);
            return;
        }

        const dates = data.map(row => row.sale_date);
        const averagePrices = data.map(row => row.average_price);
        renderChart('daily-avg-price-chart', dates, averagePrices, 'Daily Average Price', 'rgb(255, 99, 132)', 'rgba(255, 99, 132, 0.5)');
    } catch (err) {
        console.error('An unexpected error occurred loading daily average price chart:', err);
    }
}

async function loadSpecificItemPriceChart(itemId, region = null) {
    try {
        // Changed parameter name to region_filter
        const { data, error } = await supabase.rpc('get_item_price_history', { p_item_id: itemId, region_filter: region });

        if (error) {
            console.error('Error fetching specific item price history:', error);
            return;
        }

        const dates = data.map(row => row.sale_date);
        const prices = data.map(row => row.average_price);
        const itemName = data.length > 0 ? data[0].item_name : `Item ID: ${itemId}`;

        renderChart('specific-item-price-chart', dates, prices, `${itemName} Price History`, 'rgb(53, 162, 235)', 'rgba(53, 162, 235, 0.5)');
    } catch (err) {
        console.error('An unexpected error occurred loading specific item price chart:', err);
    }
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

        //console.log('Raw data received from get_all_list_trends_data_by_region:', data);

        let highestSales = [];
        let mostSoldItems = [];
        let topRevenueItems = [];
        let salesVolumeByCategory = [];

        // Check if data is in the problematic string format
        if (data && data.length > 0 && typeof data[0]?.get_all_list_trends_data_by_region === 'string') {
            try {
                const rawString = data[0].get_all_list_trends_data_by_region;
                const cleanedString = rawString.substring(2, rawString.length - 2);
                const jsonStrings = cleanedString.split('\",\"');

                if (jsonStrings.length === 4) {
                    highestSales = JSON.parse(jsonStrings[0].replace(/\"\"/g, '"'));
                    mostSoldItems = JSON.parse(jsonStrings[1].replace(/\"\"/g, '"'));
                    topRevenueItems = JSON.parse(jsonStrings[2].replace(/\"\"/g, '"'));
                    salesVolumeByCategory = JSON.parse(jsonStrings[3].replace(/\"\"/g, '"'));
                } else {
                    console.warn("Unexpected number of JSON parts in the returned string.");
                }
            } catch (parseError) {
                console.error('Error parsing list trends data string:', parseError);
                const errorMessage = `<p class="text-red-400">Error parsing data: ${parseError.message}</p>`;
                highestSalesList.innerHTML = errorMessage;
                mostSoldQuantityList.innerHTML = errorMessage;
                topRevenueItemsList.innerHTML = errorMessage;
                salesVolumeByCategoryList.innerHTML = errorMessage;
                return;
            }
        } else if (data && data.length > 0) {
            const trendsData = data[0];
            highestSales = trendsData.highest_individual_sales || [];
            mostSoldItems = trendsData.most_sold_items_by_quantity || [];
            topRevenueItems = trendsData.top_profitable_items || [];
            salesVolumeByCategory = trendsData.sales_volume_by_category || [];
        }


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
                        <p class="text-gray-400">Stack Qty: ${sale.quantity_listed || 'N/A'} | Stack Price: ${formatCurrency(sale.total_listed_price)}</p>
                    </div>
                </div>
            `).join('');
        } else {
            highestSalesList.innerHTML = '<p class="text-white">No highest sales data found yet.</p>';
        }

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

async function loadAllTrendsData() {
    await loadListTrendsData(currentSelectedRegion);
    await loadDailyTotalSalesChart(currentSelectedRegion);
    await loadDailyAveragePriceChart(currentSelectedRegion);
    await loadSpecificItemPriceChart(currentSelectedItemId, currentSelectedRegion);
}

document.addEventListener('DOMContentLoaded', async () => {
    const regionFilterSelect = document.getElementById('region-filter-select');
    const itemFilterSelect = document.getElementById('item-filter-select');

    await populateDropdown('item-filter-select', 'get_all_items_for_dropdown', 'item_id', 'item_name', 'All Items');
    await populateDropdown('region-filter-select', 'get_all_regions_for_dropdown', 'region_name', 'region_name', 'All Regions');


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
            loadSpecificItemPriceChart(currentSelectedItemId, currentSelectedRegion);
        });
    }
});