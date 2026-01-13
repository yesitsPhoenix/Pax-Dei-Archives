/**
 * Market Trends - State Manager Implementation
 * Week 4 Migration: Using MarketStateManager for data fetching
 * 
 * FEATURES:
 * - Uses marketState for character data, items, and regions
 * - Reduced database queries through intelligent caching
 * - Maintains existing chart rendering and filter logic
 * - All RPC calls now go through state manager where possible
 * 
 * @version 2.0.0
 */

import { supabase } from './supabaseClient.js';
import { marketState } from './marketStateManager.js';
import { startOfWeek, startOfMonth } from "https://cdn.jsdelivr.net/npm/date-fns@2.30.0/+esm";

// ===== DOM ELEMENTS =====
const highestSalesList = document.getElementById('highest-sales-list');
const mostSoldQuantityList = document.getElementById('most-sold-quantity-list');
const topRevenueItemsList = document.getElementById('top-profitable-items-list');
const salesVolumeByCategoryList = document.getElementById('sales-volume-by-category-list');

// ===== CHART INSTANCES =====
let dailySalesChartInstance = null;
let dailyMarketActivityChartInstance = null;
let specificItemPriceChartInstance = null;
let dailyAvgPriceChartInstance = null;
let dailyAvgListingTimeChartInstance = null;
let specificItemPriceChartUnitInstance = null;
let specificItemPriceChartStackInstance = null;
let specificItemListingVsSaleChartInstance = null;

// ===== STATE VARIABLES =====
let currentSelectedItemId = null;
let currentSelectedRegion = 'all';
let currentSelectedCharacterId = null;
let currentTimeframe = 'daily';

// ===== FORMATTING UTILITIES =====
const formatCurrency = (amount) => (amount !== null && amount !== undefined) ? amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A';
const formatDecimal = (amount, decimals = 2) => (amount !== null && amount !== undefined) ? parseFloat(amount).toFixed(decimals) : 'N/A';

// ===== CHART RENDERING =====

/**
 * Render a Chart.js chart with consistent styling
 * @param {string} chartId - Canvas element ID
 * @param {Array} labels - X-axis labels (dates)
 * @param {Array} datasetsConfig - Chart dataset configurations
 * @param {string} type - Chart type (default: 'line')
 */
function renderChart(chartId, labels, datasetsConfig, type = 'line') {
  const ctx = document.getElementById(chartId)?.getContext('2d');
  if (!ctx) {
    console.warn('Canvas context not found for chartId:', chartId);
    return null;
  }

  const chartDatasets = datasetsConfig.map(ds => ({
    ...ds,
    tension: ds.tension !== undefined ? ds.tension : 0.3,
    fill: ds.fill !== undefined ? ds.fill : (type === 'line')
  }));

  let yAxisCallback;
  let tooltipLabelCallback;
  let yAxisTitleText = '';
  let yAxisColor = '#B0B0B0';

  // Configure axis formatting based on chart type
  if (chartId === 'daily-market-activity-chart') {
    yAxisCallback = function(value) { return formatCurrency(value); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      return `${context.dataset.label}: ${formatCurrency(value)}`;
    };
    yAxisTitleText = 'Count';
  } else if (chartId === 'daily-avg-listing-time-chart') {
    yAxisCallback = function(value) { return formatDecimal(value, 1); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      return `${context.dataset.label}: ${formatDecimal(value, 1)} Days`;
    };
    yAxisTitleText = 'Days';
  } else if (chartId.includes('avg') || chartId.includes('specific-item-price')) {
    yAxisCallback = function(value) { return formatDecimal(value); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      if (chartId === 'specific-item-price-chart-stack') {
        return `${context.dataset.label}: ${formatDecimal(value, 0)}`;
      }
      return `${context.dataset.label}: ${formatDecimal(value)} Gold`;
    };
    yAxisTitleText = chartId === 'specific-item-price-chart-stack' ? 'Average Stack Size' : 'Price (Gold)';
  } else if (chartId.includes('sales-chart')) {
    yAxisCallback = function(value) { return formatCurrency(value); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      return `${context.dataset.label}: ${formatCurrency(value)} Gold`;
    };
    yAxisTitleText = 'Total Gold';
  } else if (chartId === 'specific-item-listing-vs-sale-chart') {
    yAxisCallback = function(value) { return formatCurrency(value); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      return `${context.dataset.label}: ${formatCurrency(value)} Gold`;
    };
    yAxisTitleText = 'Price (Gold per Stack)';
  }

  const chartConfig = {
    type: type,
    data: {
      labels: labels,
      datasets: chartDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            tooltipFormat: 'MMM d',
            displayFormats: { day: 'MMM d' }
          },
          ticks: { color: '#B0B0B0' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          title: { display: true, text: 'Date', color: '#FFFFFF' }
        },
        y: {
          ticks: {
            color: yAxisColor,
            callback: yAxisCallback
          },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          title: { display: true, text: yAxisTitleText, color: '#FFFFFF' }
        }
      },
      plugins: {
        legend: { labels: { color: '#FFFFFF' } },
        tooltip: {
          callbacks: {
            label: tooltipLabelCallback
          },
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          bodyColor: '#ffffff',
          titleColor: '#ffffff',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  };

  // Destroy existing chart instance
  if (chartId === 'daily-sales-chart' && dailySalesChartInstance) {
    dailySalesChartInstance.destroy();
    dailySalesChartInstance = null;
  } else if (chartId === 'daily-market-activity-chart' && dailyMarketActivityChartInstance) {
    dailyMarketActivityChartInstance.destroy();
    dailyMarketActivityChartInstance = null;
  } else if (chartId === 'specific-item-price-chart-unit' && specificItemPriceChartInstance) {
    specificItemPriceChartInstance.destroy();
    specificItemPriceChartInstance = null;
  } else if (chartId === 'specific-item-price-chart-stack' && specificItemPriceChartStackInstance) {
    specificItemPriceChartStackInstance.destroy();
    specificItemPriceChartStackInstance = null;
  } else if (chartId === 'daily-avg-price-chart' && dailyAvgPriceChartInstance) {
    dailyAvgPriceChartInstance.destroy();
    dailyAvgPriceChartInstance = null;
  } else if (chartId === 'daily-avg-listing-time-chart' && dailyAvgListingTimeChartInstance) {
    dailyAvgListingTimeChartInstance.destroy();
    dailyAvgListingTimeChartInstance = null;
  } else if (chartId === 'specific-item-listing-vs-sale-chart' && specificItemListingVsSaleChartInstance) {
    specificItemListingVsSaleChartInstance.destroy();
    specificItemListingVsSaleChartInstance = null;
  }

  const newChart = new Chart(ctx, chartConfig);

  // Store chart instance
  if (chartId === 'daily-sales-chart') dailySalesChartInstance = newChart;
  if (chartId === 'daily-market-activity-chart') dailyMarketActivityChartInstance = newChart;
  if (chartId === 'specific-item-price-chart-unit') specificItemPriceChartInstance = newChart;
  if (chartId === 'specific-item-price-chart-stack') specificItemPriceChartStackInstance = newChart;
  if (chartId === 'daily-avg-price-chart') dailyAvgPriceChartInstance = newChart;
  if (chartId === 'daily-avg-listing-time-chart') dailyAvgListingTimeChartInstance = newChart;
  if (chartId === 'specific-item-listing-vs-sale-chart') specificItemListingVsSaleChartInstance = newChart;
  
  return newChart;
}

// ===== DATA LOADING FUNCTIONS =====

/**
 * Load list trends data (highest sales, most sold items, etc.)
 * Uses state manager for consistent data fetching
 */
async function loadListTrendsData() {
  if (!highestSalesList || !mostSoldQuantityList || !topRevenueItemsList || !salesVolumeByCategoryList) {
    console.warn('One or more list elements not found.');
    return;
  }

  highestSalesList.innerHTML = '<p class="text-white">Loading highest sales...</p>';
  mostSoldQuantityList.innerHTML = '<p class="text-white">Loading most sold items...</p>';
  topRevenueItemsList.innerHTML = '<p class="text-white">Loading revenue items...</p>';
  salesVolumeByCategoryList.innerHTML = '<p class="text-white">Loading sales volume...</p>';

  try {
    // Use marketState to fetch trends data (this will be cached automatically)
    const data = await marketState.getMarketStats(currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all');

    if (!data) {
      const noDataMessage = '<p class="text-white">No data returned.</p>';
      highestSalesList.innerHTML = noDataMessage;
      mostSoldQuantityList.innerHTML = noDataMessage;
      topRevenueItemsList.innerHTML = noDataMessage;
      salesVolumeByCategoryList.innerHTML = noDataMessage;
      console.warn('No data returned from getMarketStats.');
      return;
    }

    // Render highest individual sales
    const highestSales = data.get_highest_individual_sales || [];
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

    // Render most sold items by quantity
    const mostSoldItems = data.get_most_sold_items_by_quantity || [];
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

    // Render top profitable items
    const topRevenueItems = data.top_profitable_items || [];
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

    // Render sales volume by category
    const salesVolumeByCategory = data.sales_volume_by_category || [];
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
    const errorMessage = `<p class="text-red-400">An error occurred: ${err.message}</p>`;
    highestSalesList.innerHTML = errorMessage;
    mostSoldQuantityList.innerHTML = errorMessage;
    topRevenueItemsList.innerHTML = errorMessage;
    salesVolumeByCategoryList.innerHTML = errorMessage;
    console.error('Error loading list trends data:', err);
  }
}

/**
 * Load daily total sales chart data
 * Uses state manager's getDailySalesData method
 */
async function loadDailyTotalSalesChart() {
  try {
    const data = await marketState.getDailySalesData(
      currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      currentSelectedCharacterId
    );

    if (!data || data.length === 0) {
      if (dailySalesChartInstance) dailySalesChartInstance.destroy();
      const ctx = document.getElementById('daily-sales-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '14px Arial';
        ctx.fillText('No data available based on current filters.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from getDailySalesData.');
      return;
    }

    const labels = data.map(row => row.sale_date);
    const totalSales = data.map(row => row.total_gold_sold);

    const datasetsConfig = [{
      label: 'Daily Sales in Gold',
      data: totalSales,
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)'
    }];

    if (dailySalesChartInstance) dailySalesChartInstance.destroy();
    dailySalesChartInstance = renderChart(
      'daily-sales-chart',
      labels,
      datasetsConfig
    );
  } catch (err) {
    if (dailySalesChartInstance) dailySalesChartInstance.destroy();
    const ctx = document.getElementById('daily-sales-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '14px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyTotalSalesChart:', err);
  }
}

/**
 * Load daily market activity chart (listings vs sales)
 * Uses state manager's getMarketActivityData method
 */
async function loadDailyMarketActivityChart() {
  try {
    const data = await marketState.getMarketActivityData(
      currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      currentSelectedCharacterId
    );

    const newListingsData = data.new_listings || [];
    const salesCountData = data.sales_count || [];

    if (!data || (newListingsData.length === 0 && salesCountData.length === 0)) {
      if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
      const ctx = document.getElementById('daily-market-activity-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '14px Arial';
        ctx.fillText('No data available for daily market activity.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from getMarketActivityData.');
      return;
    }

    const allDates = new Set();
    newListingsData.forEach(row => allDates.add(row.date));
    salesCountData.forEach(row => allDates.add(row.date));
    const sortedLabels = Array.from(allDates).sort();

    const listingsMap = new Map(newListingsData.map(row => [row.date, row.count]));
    const salesMap = new Map(salesCountData.map(row => [row.date, row.count]));

    const listingsCounts = sortedLabels.map(date => listingsMap.get(date) || null);
    const salesCounts = sortedLabels.map(date => salesMap.get(date) || null);

    const datasetsConfig = [
      {
        label: 'Daily New Listings',
        data: listingsCounts,
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)'
      },
      {
        label: 'Daily Sales Count',
        data: salesCounts,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)'
      }
    ];

    if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
    dailyMarketActivityChartInstance = renderChart(
      'daily-market-activity-chart',
      sortedLabels,
      datasetsConfig
    );
  } catch (err) {
    if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
    const ctx = document.getElementById('daily-market-activity-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '14px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyMarketActivityChart:', err);
  }
}

/**
 * Load daily average sale price chart
 * Direct RPC call (not cached in state manager yet)
 */
async function loadDailyAverageItemPriceChart() {
  try {
    const { data, error } = await supabase.rpc('get_daily_average_sale_price', {
      p_region_filter: currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      p_character_id: currentSelectedCharacterId
    });

    if (error) {
      if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-price-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '14px Arial';
        ctx.fillText(`Error: ${error.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.error('Error in get_daily_average_sale_price:', error);
      return;
    }

    if (!data || data.length === 0) {
      if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-price-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '14px Arial';
        ctx.fillText('No data available based on current filters.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from get_daily_average_sale_price.');
      return;
    }

    const labels = data.map(row => row.sale_date);
    const prices = data.map(row => row.average_price);

    const datasetsConfig = [{
      label: 'Daily Average Item Sold Price',
      data: prices,
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)'
    }];

    if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
    dailyAvgPriceChartInstance = renderChart(
      'daily-avg-price-chart',
      labels,
      datasetsConfig
    );
  } catch (err) {
    if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
    const ctx = document.getElementById('daily-avg-price-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '14px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyAverageItemPriceChart:', err);
  }
}

/**
 * Populate character dropdown
 * Uses state manager's cached character data
 */
async function populateCharacterDropdown() {
  const select = document.getElementById('character-filter-select');
  if (!select) return;

  select.innerHTML = `<option value="">All Characters</option>`;

  try {
    // Get characters from state manager instead of direct RPC call
    const characters = marketState.getCharacters();
    
    if (!characters || characters.length === 0) {
      //console.log('No characters found in state manager');
      return;
    }

    characters.forEach(char => {
      const option = document.createElement('option');
      option.value = char.character_id;
      option.textContent = char.character_name;
      select.appendChild(option);
    });

    //console.log(`✓ Populated character dropdown with ${characters.length} characters from cache`);
  } catch (err) {
    console.error('Unexpected error loading characters:', err);
  }
}

/**
 * Load average listing timeframe chart
 * Direct RPC call (not cached in state manager yet)
 */
async function loadDailyAverageListingTimeframeChart() {
  try {
    const { data, error } = await supabase.rpc('get_average_listing_timeframe', {
      p_region_filter: currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      p_character_id: currentSelectedCharacterId
    });
    
    if (error) {
      if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-listing-time-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '14px Arial';
        ctx.fillText(`Error: ${error.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.error('Error in get_average_listing_timeframe:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-listing-time-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '14px Arial';
        ctx.fillText('No data available based on current filters.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from get_average_listing_timeframe.');
      return;
    }
    
    const labels = data.map(row => row.sale_date);
    const avgTimes = data.map(row => row.average_time_hours / 24);
    
    const datasetsConfig = [{
      label: 'Avg. Days on Market',
      data: avgTimes,
      borderColor: '#4285F4',
      backgroundColor: 'rgba(66, 133, 244, 0.2)',
      tension: 0.3,
      fill: true
    }];
    
    if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
    dailyAvgListingTimeChartInstance = renderChart(
      'daily-avg-listing-time-chart',
      labels,
      datasetsConfig
    );
  } catch (err) {
    if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
    const ctx = document.getElementById('daily-avg-listing-time-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '14px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyAverageListingTimeframeChart:', err);
  }
}

/**
 * Load specific item price chart
 * Shows price per unit and average stack size trends
 */
async function loadSpecificItemPriceChart(itemId = null) {
  if (!itemId || itemId === 'all') {
    ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
      const ctx = document.getElementById(id)?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px Arial';
        ctx.fillText('Please select an item to view its price trend.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
    });
    if (specificItemPriceChartUnitInstance) {
      specificItemPriceChartUnitInstance.destroy();
      specificItemPriceChartUnitInstance = null;
    }
    if (specificItemPriceChartStackInstance) {
      specificItemPriceChartStackInstance.destroy();
      specificItemPriceChartStackInstance = null;
    }
    return;
  }

  try {
    const { data, error } = await supabase.rpc('get_item_price_history', {
      p_item_id: itemId,
      p_region_filter: currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      p_character_id: currentSelectedCharacterId
    });

    if (error) {
      ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FF6666';
          ctx.font = '14px Arial';
          ctx.fillText(`Error: ${error.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      });
      if (specificItemPriceChartUnitInstance) {
        specificItemPriceChartUnitInstance.destroy();
        specificItemPriceChartUnitInstance = null;
      }
      if (specificItemPriceChartStackInstance) {
        specificItemPriceChartStackInstance.destroy();
        specificItemPriceChartStackInstance = null;
      }
      return;
    }

    if (!data || data.length === 0) {
      ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#B0B0B0';
          ctx.font = '14px Arial';
          ctx.fillText('No data available based on current filters.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      });
      if (specificItemPriceChartUnitInstance) {
        specificItemPriceChartUnitInstance.destroy();
        specificItemPriceChartUnitInstance = null;
      }
      if (specificItemPriceChartStackInstance) {
        specificItemPriceChartStackInstance.destroy();
        specificItemPriceChartStackInstance = null;
      }
      return;
    }

    const labels = data.map(row => row.sale_date);
    const pricesPerUnit = data.map(row => parseFloat(row.average_price));
    const averageStackSizes = data.map(row => parseFloat(row.average_stack_size));
    const itemName = data.length > 0 ? data[0].item_name : `Item ID: ${itemId}`;

    if (specificItemPriceChartUnitInstance) {
      specificItemPriceChartUnitInstance.destroy();
      specificItemPriceChartUnitInstance = null;
    }
    if (specificItemPriceChartStackInstance) {
      specificItemPriceChartStackInstance.destroy();
      specificItemPriceChartStackInstance = null;
    }

    specificItemPriceChartUnitInstance = renderChart(
      'specific-item-price-chart-unit',
      labels,
      [{
        label: `${itemName} - Price per Unit`,
        data: pricesPerUnit,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)'
      }]
    );

    specificItemPriceChartStackInstance = renderChart(
      'specific-item-price-chart-stack',
      labels,
      [{
        label: `${itemName} - Average Stack Size Sold`,
        data: averageStackSizes,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)'
      }]
    );
  } catch (err) {
    ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
      const ctx = document.getElementById(id)?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '14px Arial';
        ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
    });
    if (specificItemPriceChartUnitInstance) {
      specificItemPriceChartUnitInstance.destroy();
      specificItemPriceChartUnitInstance = null;
    }
    if (specificItemPriceChartStackInstance) {
      specificItemPriceChartStackInstance.destroy();
      specificItemPriceChartStackInstance = null;
    }
  }
}

/**
 * Load specific item listing vs sale chart
 * Compares average listing price vs average sale price over time
 */
async function loadSpecificItemListingVsSaleChart(itemId) {
  const chartId = 'specific-item-listing-vs-sale-chart';
  
  if (!itemId || itemId === 'all') {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px Arial';
      ctx.fillText('Please select an item to view its price trend.', ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    if (specificItemListingVsSaleChartInstance) {
      specificItemListingVsSaleChartInstance.destroy();
      specificItemListingVsSaleChartInstance = null;
    }
    return;
  }

  try {
    let listingsQuery = supabase
      .from('market_listings')
      .select(`
        listing_date,
        total_listed_price,
        market_stalls!inner ( region )
      `)
      .eq('item_id', itemId);

    if (currentSelectedRegion && currentSelectedRegion !== 'all') {
      listingsQuery = listingsQuery.eq('market_stalls.region', currentSelectedRegion);
    }
    if (currentSelectedCharacterId) {
      listingsQuery = listingsQuery.eq('character_id', currentSelectedCharacterId);
    }

    const { data: listingsData, error: listingsError } = await listingsQuery;

    if (listingsError) throw listingsError;

    let salesQuery = supabase
      .from('sales')
      .select(`
        sale_date,
        total_sale_price,
        market_listings!inner (
          item_id,
          character_id,
          market_stalls!inner ( region )
        )
      `)
      .eq('market_listings.item_id', itemId);

    if (currentSelectedRegion && currentSelectedRegion !== 'all') {
      salesQuery = salesQuery.eq('market_listings.market_stalls.region', currentSelectedRegion);
    }
    if (currentSelectedCharacterId) {
      salesQuery = salesQuery.eq('market_listings.character_id', currentSelectedCharacterId);
    }

    const { data: salesData, error: salesError } = await salesQuery;

    if (salesError) throw salesError;

    if ((!listingsData || listingsData.length === 0) && (!salesData || salesData.length === 0)) {
      const ctx = document.getElementById(chartId)?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '14px Arial';
        ctx.fillText('No listing or sales data available.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      if (specificItemListingVsSaleChartInstance) {
        specificItemListingVsSaleChartInstance.destroy();
        specificItemListingVsSaleChartInstance = null;
      }
      return;
    }

    const aggregatedData = {};

    listingsData.forEach(item => {
      const date = new Date(item.listing_date).toISOString().split('T')[0];
      if (!aggregatedData[date]) aggregatedData[date] = { listingSum: 0, listingCount: 0, saleSum: 0, saleCount: 0 };
      aggregatedData[date].listingSum += item.total_listed_price;
      aggregatedData[date].listingCount++;
    });

    salesData.forEach(item => {
      const date = new Date(item.sale_date).toISOString().split('T')[0];
      if (!aggregatedData[date]) aggregatedData[date] = { listingSum: 0, listingCount: 0, saleSum: 0, saleCount: 0 };
      aggregatedData[date].saleSum += item.total_sale_price;
      aggregatedData[date].saleCount++;
    });

    const sortedDates = Object.keys(aggregatedData).sort();
    const avgListingPrices = sortedDates.map(date => {
      const d = aggregatedData[date];
      return d.listingCount > 0 ? d.listingSum / d.listingCount : null;
    });
    const avgSalePrices = sortedDates.map(date => {
      const d = aggregatedData[date];
      return d.saleCount > 0 ? d.saleSum / d.saleCount : null;
    });

    const datasets = [
      {
        label: 'Avg Listing Price (Stack)',
        data: avgListingPrices,
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        spanGaps: true
      },
      {
        label: 'Avg Sale Price (Stack)',
        data: avgSalePrices,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        spanGaps: true
      }
    ];

    if (specificItemListingVsSaleChartInstance) {
      specificItemListingVsSaleChartInstance.destroy();
      specificItemListingVsSaleChartInstance = null;
    }

    specificItemListingVsSaleChartInstance = renderChart(chartId, sortedDates, datasets);

  } catch (err) {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '14px Arial';
      ctx.fillText(`Error: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Error loading item listing vs sale chart:', err);
  }
}

/**
 * Populate dropdown with items
 * Uses state manager's cached items data
 */
async function populateItemDropdown() {
  const selectElement = document.getElementById('item-filter-select');
  if (!selectElement) {
    console.warn('Item select element not found');
    return;
  }

  selectElement.innerHTML = `<option value="all">All Items</option>`;

  try {
    // Get items from state manager instead of direct RPC call
    const items = marketState.getAllItems();
    
    if (!items || items.length === 0) {
      //console.log('No items found in state manager');
      return;
    }

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.item_id;
      option.textContent = item.item_name;
      selectElement.appendChild(option);
    });

    //console.log(`✓ Populated item dropdown with ${items.length} items from cache`);
  } catch (err) {
    console.error('Unexpected error in populateItemDropdown:', err);
  }
}

/**
 * Load all trends data
 * Orchestrates loading of all charts and lists
 */
async function loadAllTrendsData() {
  await loadListTrendsData();
  await loadDailyTotalSalesChart();
  await loadDailyMarketActivityChart();
  await loadDailyAverageItemPriceChart();
  await loadDailyAverageListingTimeframeChart();
  await loadSpecificItemPriceChart(currentSelectedItemId);
  await loadSpecificItemListingVsSaleChart(currentSelectedItemId);
}

/**
 * Clear all filters and reload data
 */
async function clearFilters() {
  const itemFilterSelect = document.getElementById('item-filter-select');
  const regionFilterSelect = document.getElementById('region-filter-select');
  const characterFilterSelect = document.getElementById('character-filter-select');

  if (itemFilterSelect) {
    itemFilterSelect.value = '';
  }
  if (regionFilterSelect) {
    regionFilterSelect.value = 'all';
  }
  if (characterFilterSelect) {
    characterFilterSelect.value = '';
  }

  currentSelectedItemId = null;
  currentSelectedRegion = 'all';
  currentSelectedCharacterId = null;

  await loadAllTrendsData();
}

// ===== TIMEFRAME AGGREGATION (Weekly/Monthly) =====

/**
 * Update chart time unit for timeframe views
 */
function updateTimeUnit(chart, unit) {
  if (chart?.options?.scales?.x?.time) {
    chart.options.scales.x.time.unit = unit;
    chart.update();
  }
}

/**
 * Group data by time period (week/month)
 */
function groupByPeriod(data, dateField, valueField, period = 'week', mode = 'sum') {
  const grouped = {};
  data.forEach(row => {
    const date = new Date(row[dateField]);
    const key =
      period === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : startOfMonth(date);
    const k = key.toISOString();

    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(Number(row[valueField] || 0));
  });

  return Object.entries(grouped).map(([date, arr]) => ({
    date,
    value:
      mode === 'average'
        ? arr.reduce((a, b) => a + b, 0) / arr.length
        : arr.reduce((a, b) => a + b, 0)
  }));
}

/**
 * Load all trends data with timeframe aggregation
 */
async function loadAllTrendsDataByTimeframe() {
  if (currentTimeframe === 'daily') {
    await loadAllTrendsData();
    return;
  }

  const period = currentTimeframe === 'weekly' ? 'week' : 'month';
  const capitalized = currentTimeframe.charAt(0).toUpperCase() + currentTimeframe.slice(1);
  const unit = currentTimeframe === 'weekly' ? 'week' : 'month';

  try {
    // Use state manager methods for sales and market activity data
    const salesData = await marketState.getDailySalesData(
      currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      currentSelectedCharacterId
    );

    if (salesData?.length) {
      const groupedSales = groupByPeriod(salesData, 'sale_date', 'total_gold_sold', period, 'sum');
      const labels = groupedSales.map(d => d.date);
      const totals = groupedSales.map(d => d.value);
      const config = [
        {
          label: `${capitalized} Total Sales (Gold)`,
          data: totals,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }
      ];
      if (dailySalesChartInstance) dailySalesChartInstance.destroy();
      dailySalesChartInstance = renderChart('daily-sales-chart', labels, config);
      updateTimeUnit(dailySalesChartInstance, unit);
    }

    // Average price data (still using direct RPC)
    const { data: avgPriceData } = await supabase.rpc('get_daily_average_sale_price', {
      p_region_filter: currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      p_character_id: currentSelectedCharacterId
    });

    if (avgPriceData?.length) {
      const groupedPrices = groupByPeriod(avgPriceData, 'sale_date', 'average_price', period, 'average');
      const labels = groupedPrices.map(d => d.date);
      const prices = groupedPrices.map(d => d.value);
      const config = [
        {
          label: `${capitalized} Avg Sale Price`,
          data: prices,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)'
        }
      ];
      if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
      dailyAvgPriceChartInstance = renderChart('daily-avg-price-chart', labels, config);
      updateTimeUnit(dailyAvgPriceChartInstance, unit);
    }

    // Market activity data (using state manager)
    const marketData = await marketState.getMarketActivityData(
      currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      currentSelectedCharacterId
    );

    if (marketData?.new_listings?.length || marketData?.sales_count?.length) {
      const listings = groupByPeriod(marketData.new_listings || [], 'date', 'count', period, 'sum');
      const sales = groupByPeriod(marketData.sales_count || [], 'date', 'count', period, 'sum');

      const labels = Array.from(
        new Set([...listings.map(l => l.date), ...sales.map(s => s.date)])
      ).sort();

      const listingsMap = new Map(listings.map(x => [x.date, x.value]));
      const salesMap = new Map(sales.map(x => [x.date, x.value]));

      const listingsData = labels.map(date => listingsMap.get(date) || 0);
      const salesDataArr = labels.map(date => salesMap.get(date) || 0);

      const config = [
        {
          label: `${capitalized} Listings`,
          data: listingsData,
          borderColor: 'rgb(255, 159, 64)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)'
        },
        {
          label: `${capitalized} Sales`,
          data: salesDataArr,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }
      ];
      if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
      dailyMarketActivityChartInstance = renderChart('daily-market-activity-chart', labels, config);
      updateTimeUnit(dailyMarketActivityChartInstance, unit);
    }

    // Listing timeframe data (still using direct RPC)
    const { data: listingData } = await supabase.rpc('get_average_listing_timeframe', {
      p_region_filter: currentSelectedRegion ? currentSelectedRegion.toLowerCase() : 'all',
      p_character_id: currentSelectedCharacterId
    });

    if (listingData?.length) {
      const groupedListings = groupByPeriod(listingData, 'sale_date', 'average_time_hours', period, 'average');
      const labels = groupedListings.map(d => d.date);
      const avgDays = groupedListings.map(d => d.value / 24);
      const config = [
        {
          label: `${capitalized} Avg Days on Market`,
          data: avgDays,
          borderColor: '#4285F4',
          backgroundColor: 'rgba(66,133,244,0.2)'
        }
      ];
      if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
      dailyAvgListingTimeChartInstance = renderChart('daily-avg-listing-time-chart', labels, config);
      updateTimeUnit(dailyAvgListingTimeChartInstance, unit);
    }

  } catch (err) {
    console.error("Error loading aggregated timeframe data:", err);
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  //console.log('=== Market Trends v2 (State Manager) - Initializing ===');
  
  const itemFilterSelect = document.getElementById('item-filter-select');
  const regionFilterSelect = document.getElementById('region-filter-select');
  const characterFilterSelect = document.getElementById('character-filter-select');
  const traderLoginContainer = document.getElementById('traderLoginContainer');
  const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
  const trendsContent = document.getElementById('trendsContent');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Not logged in - show login prompt
    if (traderLoginContainer) {
      traderLoginContainer.style.display = 'block';
    }
    if (trendsContent) {
      trendsContent.style.display = 'none';
    }

    if (traderDiscordLoginButton) {
      traderDiscordLoginButton.addEventListener('click', async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: window.location.href,
            scopes: 'identify'
          }
        });
        if (error) {
          console.error('Error logging in with Discord:', error.message);
          const traderLoginError = document.getElementById('traderLoginError');
          if (traderLoginError) {
            traderLoginError.textContent = 'Login failed. Please try again.';
            traderLoginError.style.display = 'block';
          }
        }
      });
    }

  } else {
    // Logged in - initialize state manager and load data
    if (traderLoginContainer) {
      traderLoginContainer.style.display = 'none';
    }
    if (trendsContent) {
      trendsContent.style.display = 'block';
    }

    try {
      // Initialize state manager
      //console.log('Initializing Market State Manager...');
      await marketState.initialize();
      //console.log('✓ State Manager initialized');

      // Populate dropdowns from cached data
      await populateItemDropdown();
      await populateCharacterDropdown();

      // Set initial filter values
      currentSelectedRegion = regionFilterSelect ? regionFilterSelect.value : 'all';
      currentSelectedItemId = itemFilterSelect ? (itemFilterSelect.value === 'all' || itemFilterSelect.value === '' ? null : parseInt(itemFilterSelect.value, 10)) : null;

      // Load all trends data
      //console.log('Loading trends data...');
      await loadAllTrendsData();
      //console.log('✓ Trends data loaded');

      // Set up event listeners
      if (itemFilterSelect) {
        itemFilterSelect.addEventListener('change', (event) => {
          currentSelectedItemId = event.target.value === 'all' || event.target.value === '' ? null : parseInt(event.target.value, 10);
          loadSpecificItemPriceChart(currentSelectedItemId);
          loadSpecificItemListingVsSaleChart(currentSelectedItemId);
        });
      }

      if (regionFilterSelect) {
        regionFilterSelect.addEventListener('change', async (event) => {
          currentSelectedRegion = event.target.value;
          await loadAllTrendsData();
        });
      }

      if (characterFilterSelect) {
        characterFilterSelect.addEventListener('change', async (event) => {
          currentSelectedCharacterId = event.target.value || null;
          await loadAllTrendsData();
        });
      }

      if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
      }

      // Timeframe buttons
      const dailyBtn = document.getElementById('viewDaily');
      const weeklyBtn = document.getElementById('viewWeekly');
      const monthlyBtn = document.getElementById('viewMonthly');
      const buttons = [dailyBtn, weeklyBtn, monthlyBtn];

      function setActiveButton(activeBtn) {
        buttons.forEach(btn => {
          if (!btn) return;
          btn.classList.remove('bg-blue-700', 'scale-105');
          btn.classList.add('bg-blue-500');
        });
        if (activeBtn) {
          activeBtn.classList.add('bg-blue-700', 'scale-105');
        }
      }

      async function refreshChartsFor(timeframe, btn) {
        currentTimeframe = timeframe;
        setActiveButton(btn);
        await loadAllTrendsDataByTimeframe();
      }

      if (dailyBtn) dailyBtn.addEventListener('click', () => refreshChartsFor('daily', dailyBtn));
      if (weeklyBtn) weeklyBtn.addEventListener('click', () => refreshChartsFor('weekly', weeklyBtn));
      if (monthlyBtn) monthlyBtn.addEventListener('click', () => refreshChartsFor('monthly', monthlyBtn));

      setActiveButton(dailyBtn);

      //console.log('=== Market Trends v2 Initialization Complete ===');

    } catch (error) {
      console.error('Error during initialization:', error);
      alert('Failed to load trends data. Please refresh the page.');
    }
  }
});
