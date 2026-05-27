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
let dailyAvgListingTimeChartInstance = null;
let specificItemPriceChartUnitInstance = null;
let specificItemPriceChartStackInstance = null;

// ===== STATE VARIABLES =====
let currentSelectedItemId = null;
let currentSelectedRegion = 'all';
let currentSelectedCharacterId = null;
let currentTimeframe = 'daily';
let currentSpecificItemPriceMetric = 'unit';

const DAILY_LOOKBACK_DAYS = 120;
const MAX_TRENDS_ROWS = 5000;

// ===== FORMATTING UTILITIES =====
const formatCurrency = (amount) => (amount !== null && amount !== undefined) ? amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A';
const formatDecimal = (amount, decimals = 2) => (amount !== null && amount !== undefined) ? parseFloat(amount).toFixed(decimals) : 'N/A';

function normalizeFilterValue(value) {
  return value && value !== 'all' ? value : null;
}

function applyListingFilters(query) {
  const region = normalizeFilterValue(currentSelectedRegion);

  if (region) query = query.eq('market_stalls.region', region);
  if (currentSelectedCharacterId) query = query.eq('character_id', currentSelectedCharacterId);

  return query;
}

function applySalesFilters(query) {
  const region = normalizeFilterValue(currentSelectedRegion);

  if (region) query = query.eq('market_listings.market_stalls.region', region);
  if (currentSelectedCharacterId) query = query.eq('market_listings.character_id', currentSelectedCharacterId);

  return query;
}

function dateKey(value) {
  return new Date(value).toISOString().split('T')[0];
}

function applyDailyLookback(rows, dateField) {
  if (currentTimeframe !== 'daily' || !rows?.length) return rows || [];

  const validRows = rows.filter(row => row[dateField]);
  const latestTime = Math.max(...validRows.map(row => new Date(row[dateField]).getTime()));
  if (!Number.isFinite(latestTime)) return validRows;

  return applyDailyLookbackFromTime(validRows, dateField, latestTime);
}

function applyDailyLookbackFromTime(rows, dateField, latestTime) {
  if (currentTimeframe !== 'daily' || !rows?.length || !Number.isFinite(latestTime)) return rows || [];

  const cutoff = new Date(latestTime);
  cutoff.setDate(cutoff.getDate() - (DAILY_LOOKBACK_DAYS - 1));
  return rows.filter(row => row[dateField] && new Date(row[dateField]) >= cutoff);
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
}

function addSelectOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function getItemNameFromSale(sale) {
  const item = sale.market_listings?.items;
  return Array.isArray(item) ? item[0]?.item_name : item?.item_name;
}

function getCategoryNameFromSale(sale) {
  const item = Array.isArray(sale.market_listings?.items)
    ? sale.market_listings.items[0]
    : sale.market_listings?.items;
  const category = Array.isArray(item?.item_categories)
    ? item.item_categories[0]
    : item?.item_categories;
  return category?.category_name || 'Uncategorized';
}

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
    yAxisTitleText = chartId === 'specific-item-price-chart-stack'
      ? 'Average Stack Size'
      : `Price (Gold per ${currentSpecificItemPriceMetric === 'stack' ? 'Stack' : 'Unit'})`;
  } else if (chartId.includes('sales-chart')) {
    yAxisCallback = function(value) { return formatCurrency(value); };
    tooltipLabelCallback = function(context) {
      let value = context.parsed.y;
      return `${context.dataset.label}: ${formatCurrency(value)} Gold`;
    };
    yAxisTitleText = 'Total Gold';
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
  } else if (chartId === 'specific-item-price-chart-unit' && specificItemPriceChartUnitInstance) {
    specificItemPriceChartUnitInstance.destroy();
    specificItemPriceChartUnitInstance = null;
  } else if (chartId === 'specific-item-price-chart-stack' && specificItemPriceChartStackInstance) {
    specificItemPriceChartStackInstance.destroy();
    specificItemPriceChartStackInstance = null;
  } else if (chartId === 'daily-avg-listing-time-chart' && dailyAvgListingTimeChartInstance) {
    dailyAvgListingTimeChartInstance.destroy();
    dailyAvgListingTimeChartInstance = null;
  }

  const newChart = new Chart(ctx, chartConfig);

  // Store chart instance
  if (chartId === 'daily-sales-chart') dailySalesChartInstance = newChart;
  if (chartId === 'daily-market-activity-chart') dailyMarketActivityChartInstance = newChart;
  if (chartId === 'specific-item-price-chart-unit') specificItemPriceChartUnitInstance = newChart;
  if (chartId === 'specific-item-price-chart-stack') specificItemPriceChartStackInstance = newChart;
  if (chartId === 'daily-avg-listing-time-chart') dailyAvgListingTimeChartInstance = newChart;
  
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
    let salesQuery = supabase
      .from('sales')
      .select(`
        quantity_sold,
        sale_price_per_unit,
        total_sale_price,
        market_listings!inner (
          item_id,
          character_id,
          quantity_listed,
          total_listed_price,
          items (
            item_name,
            item_categories:category_id ( category_name )
          ),
          market_stalls!inner ( region )
        )
      `)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);

    salesQuery = applySalesFilters(salesQuery);
    const { data: salesRows, error } = await salesQuery;

    if (error) throw error;

    const rows = salesRows || [];
    if (!rows.length) {
      const noDataMessage = '<p class="text-white">No sales data found for the current filters.</p>';
      highestSalesList.innerHTML = noDataMessage;
      mostSoldQuantityList.innerHTML = noDataMessage;
      topRevenueItemsList.innerHTML = noDataMessage;
      salesVolumeByCategoryList.innerHTML = noDataMessage;
      return;
    }

    const highestSales = rows
      .map(sale => ({
        item_name: getItemNameFromSale(sale) || 'Unknown Item',
        category_name: getCategoryNameFromSale(sale),
        total_sale_price: Number(sale.total_sale_price) || 0,
        quantity_sold: Number(sale.quantity_sold) || 0,
        sale_price_per_unit: Number(sale.sale_price_per_unit) || 0,
        quantity_listed: Number(sale.market_listings?.quantity_listed) || 0,
        total_listed_price: Number(sale.market_listings?.total_listed_price) || 0
      }))
      .sort((a, b) => b.total_sale_price - a.total_sale_price)
      .slice(0, 10);

    const itemStats = new Map();
    const categoryStats = new Map();

    rows.forEach(sale => {
      const itemId = sale.market_listings?.item_id || getItemNameFromSale(sale) || 'unknown';
      const itemName = getItemNameFromSale(sale) || 'Unknown Item';
      const categoryName = getCategoryNameFromSale(sale);
      const quantitySold = Number(sale.quantity_sold) || 0;
      const totalSalePrice = Number(sale.total_sale_price) || 0;
      const pricePerUnit = Number(sale.sale_price_per_unit) || 0;
      const stackQty = Number(sale.market_listings?.quantity_listed) || quantitySold || 0;
      const stackPrice = Number(sale.market_listings?.total_listed_price) || totalSalePrice || 0;

      if (!itemStats.has(itemId)) {
        itemStats.set(itemId, {
          item_name: itemName,
          category_name: categoryName,
          total_quantity_sold: 0,
          total_revenue: 0,
          unitPrices: [],
          stackQuantities: [],
          stackPrices: []
        });
      }

      const item = itemStats.get(itemId);
      item.total_quantity_sold += quantitySold;
      item.total_revenue += totalSalePrice;
      item.unitPrices.push(pricePerUnit);
      item.stackQuantities.push(stackQty);
      item.stackPrices.push(stackPrice);

      if (!categoryStats.has(categoryName)) {
        categoryStats.set(categoryName, { category_name: categoryName, total_quantity_sold: 0 });
      }
      categoryStats.get(categoryName).total_quantity_sold += quantitySold;
    });

    // Render highest individual sales
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
    const mostSoldItems = Array.from(itemStats.values())
      .map(item => ({
        ...item,
        average_price_per_unit: average(item.unitPrices),
        avg_stack_quantity: average(item.stackQuantities),
        avg_stack_price: average(item.stackPrices)
      }))
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
      .slice(0, 10);
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
    const topRevenueItems = Array.from(itemStats.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);
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
    const salesVolumeByCategory = Array.from(categoryStats.values())
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
      .slice(0, 10);
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
    let query = supabase
      .from('sales')
      .select(`
        sale_date,
        total_sale_price,
        market_listings!inner (
          character_id,
          market_stalls!inner ( region )
        )
      `)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);

    query = applySalesFilters(query);
    const { data: rawData, error } = await query;
    if (error) throw error;

    const totalsByDate = new Map();
    (rawData || []).forEach(row => {
      const key = dateKey(row.sale_date);
      totalsByDate.set(key, (totalsByDate.get(key) || 0) + (Number(row.total_sale_price) || 0));
    });

    const data = applyDailyLookback(
      Array.from(totalsByDate, ([sale_date, total_gold_sold]) => ({ sale_date, total_gold_sold }))
        .sort((a, b) => a.sale_date.localeCompare(b.sale_date)),
      'sale_date'
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
      console.warn('No data from sales query.');
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
    let listingsQuery = supabase
      .from('market_listings')
      .select(`
        listing_date,
        character_id,
        market_stalls!inner ( region )
      `)
      .order('listing_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    listingsQuery = applyListingFilters(listingsQuery);

    let salesQuery = supabase
      .from('sales')
      .select(`
        sale_date,
        market_listings!inner (
          character_id,
          market_stalls!inner ( region )
        )
      `)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    salesQuery = applySalesFilters(salesQuery);

    const [{ data: listingsRows, error: listingsError }, { data: salesRows, error: salesError }] = await Promise.all([
      listingsQuery,
      salesQuery
    ]);

    if (listingsError) throw listingsError;
    if (salesError) throw salesError;

    const listingsByDate = new Map();
    (listingsRows || []).forEach(row => {
      const key = dateKey(row.listing_date);
      listingsByDate.set(key, (listingsByDate.get(key) || 0) + 1);
    });

    const salesByDate = new Map();
    (salesRows || []).forEach(row => {
      const key = dateKey(row.sale_date);
      salesByDate.set(key, (salesByDate.get(key) || 0) + 1);
    });

    const listingDailyRows = Array.from(listingsByDate, ([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const salesDailyRows = Array.from(salesByDate, ([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const latestActivityTime = Math.max(
      ...[...listingDailyRows, ...salesDailyRows].map(row => new Date(row.date).getTime()).filter(Number.isFinite)
    );

    const data = {
      new_listings: applyDailyLookbackFromTime(listingDailyRows, 'date', latestActivityTime),
      sales_count: applyDailyLookbackFromTime(salesDailyRows, 'date', latestActivityTime)
    };

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
    let query = supabase
      .from('sales')
      .select(`
        sale_date,
        market_listings!inner (
          listing_date,
          character_id,
          market_stalls!inner ( region )
        )
      `)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    query = applySalesFilters(query);
    const { data: rawData, error } = await query;
    
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
      console.error('Error loading average listing timeframe:', error);
      return;
    }

    const grouped = new Map();
    (rawData || []).forEach(row => {
      const saleDate = new Date(row.sale_date);
      const listingDate = new Date(row.market_listings?.listing_date);
      if (Number.isNaN(saleDate.getTime()) || Number.isNaN(listingDate.getTime())) return;

      const key = dateKey(row.sale_date);
      const hours = Math.max((saleDate - listingDate) / (1000 * 60 * 60), 0);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(hours);
    });

    const data = applyDailyLookback(
      Array.from(grouped, ([sale_date, hours]) => ({
        sale_date,
        average_time_hours: average(hours)
      })).sort((a, b) => a.sale_date.localeCompare(b.sale_date)),
      'sale_date'
    );
    
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
      console.warn('No data for average listing timeframe.');
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
    let query = supabase
      .from('sales')
      .select(`
        sale_date,
        sale_price_per_unit,
        total_sale_price,
        quantity_sold,
        market_listings!inner (
          item_id,
          character_id,
          items ( item_name ),
          market_stalls!inner ( region )
        )
      `)
      .eq('market_listings.item_id', itemId)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    query = applySalesFilters(query);
    const { data: rawData, error } = await query;

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

    if (!rawData || rawData.length === 0) {
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

    const grouped = new Map();
    rawData.forEach(row => {
      const key = dateKey(row.sale_date);
      if (!grouped.has(key)) grouped.set(key, { unitPrices: [], stackPrices: [], stackSizes: [], itemName: getItemNameFromSale(row) });
      const bucket = grouped.get(key);
      bucket.unitPrices.push(Number(row.sale_price_per_unit) || 0);
      bucket.stackPrices.push(Number(row.total_sale_price) || 0);
      bucket.stackSizes.push(Number(row.quantity_sold) || 0);
      if (!bucket.itemName) bucket.itemName = getItemNameFromSale(row);
    });

    const data = applyDailyLookback(
      Array.from(grouped, ([sale_date, bucket]) => ({
        sale_date,
        average_price_per_unit: average(bucket.unitPrices),
        average_stack_price: average(bucket.stackPrices),
        average_stack_size: average(bucket.stackSizes),
        item_name: bucket.itemName
      })).sort((a, b) => a.sale_date.localeCompare(b.sale_date)),
      'sale_date'
    );

    const labels = data.map(row => row.sale_date);
    const averagePrices = data.map(row => currentSpecificItemPriceMetric === 'stack'
      ? parseFloat(row.average_stack_price)
      : parseFloat(row.average_price_per_unit)
    );
    const averageStackSizes = data.map(row => parseFloat(row.average_stack_size));
    const itemName = data.length > 0 ? data[0].item_name : `Item ID: ${itemId}`;
    const priceHeading = document.getElementById('specific-item-price-heading');
    if (priceHeading) {
      priceHeading.textContent = currentSpecificItemPriceMetric === 'stack'
        ? 'Avg Price per Stack'
        : 'Avg Price per Unit';
    }

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
        label: `${itemName} - Price per ${currentSpecificItemPriceMetric === 'stack' ? 'Stack' : 'Unit'}`,
        data: averagePrices,
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
  await loadDailyAverageListingTimeframeChart();
  await loadSpecificItemPriceChart(currentSelectedItemId);
}

/**
 * Clear all filters and reload data
 */
async function clearFilters() {
  const itemFilterSelect = document.getElementById('item-filter-select');
  const regionFilterSelect = document.getElementById('region-filter-select');
  const characterFilterSelect = document.getElementById('character-filter-select');

  if (itemFilterSelect) {
    itemFilterSelect.value = 'all';
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

  await loadAllTrendsDataByTimeframe();
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
    let salesQuery = supabase
      .from('sales')
      .select(`
        sale_date,
        total_sale_price,
        market_listings!inner (
          listing_date,
          character_id,
          market_stalls!inner ( region )
        )
      `)
      .order('sale_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    salesQuery = applySalesFilters(salesQuery);
    const { data: rawSalesData, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    const salesByDate = new Map();
    (rawSalesData || []).forEach(row => {
      const key = dateKey(row.sale_date);
      salesByDate.set(key, (salesByDate.get(key) || 0) + (Number(row.total_sale_price) || 0));
    });
    const salesData = Array.from(salesByDate, ([sale_date, total_gold_sold]) => ({ sale_date, total_gold_sold }))
      .sort((a, b) => a.sale_date.localeCompare(b.sale_date));

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

    let listingsQuery = supabase
      .from('market_listings')
      .select(`
        listing_date,
        character_id,
        market_stalls!inner ( region )
      `)
      .order('listing_date', { ascending: false })
      .limit(MAX_TRENDS_ROWS);
    listingsQuery = applyListingFilters(listingsQuery);
    const { data: rawListingsData, error: listingsError } = await listingsQuery;
    if (listingsError) throw listingsError;

    const listingsByDate = new Map();
    (rawListingsData || []).forEach(row => {
      const key = dateKey(row.listing_date);
      listingsByDate.set(key, (listingsByDate.get(key) || 0) + 1);
    });

    const salesCountByDate = new Map();
    (rawSalesData || []).forEach(row => {
      const key = dateKey(row.sale_date);
      salesCountByDate.set(key, (salesCountByDate.get(key) || 0) + 1);
    });

    const marketData = {
      new_listings: Array.from(listingsByDate, ([date, count]) => ({ date, count })),
      sales_count: Array.from(salesCountByDate, ([date, count]) => ({ date, count }))
    };

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

    const listingHoursByDate = new Map();
    (rawSalesData || []).forEach(row => {
      const saleDate = new Date(row.sale_date);
      const listingDate = new Date(row.market_listings?.listing_date);
      if (Number.isNaN(saleDate.getTime()) || Number.isNaN(listingDate.getTime())) return;

      const key = dateKey(row.sale_date);
      const hours = Math.max((saleDate - listingDate) / (1000 * 60 * 60), 0);
      if (!listingHoursByDate.has(key)) listingHoursByDate.set(key, []);
      listingHoursByDate.get(key).push(hours);
    });

    const listingData = Array.from(listingHoursByDate, ([sale_date, hours]) => ({
      sale_date,
      average_time_hours: average(hours)
    }));

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
  const priceUnitToggle = document.getElementById('priceUnitToggle');
  const priceStackToggle = document.getElementById('priceStackToggle');
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
        });
      }

      if (regionFilterSelect) {
        regionFilterSelect.addEventListener('change', async (event) => {
          currentSelectedRegion = event.target.value;
          await loadAllTrendsDataByTimeframe();
        });
      }

      if (characterFilterSelect) {
        characterFilterSelect.addEventListener('change', async (event) => {
          currentSelectedCharacterId = event.target.value || null;
          await loadAllTrendsDataByTimeframe();
        });
      }

      function setPriceMetric(metric) {
        currentSpecificItemPriceMetric = metric;
        if (priceUnitToggle && priceStackToggle) {
          priceUnitToggle.classList.toggle('bg-blue-700', metric === 'unit');
          priceUnitToggle.classList.toggle('bg-gray-700', metric !== 'unit');
          priceStackToggle.classList.toggle('bg-blue-700', metric === 'stack');
          priceStackToggle.classList.toggle('bg-gray-700', metric !== 'stack');
        }
        loadSpecificItemPriceChart(currentSelectedItemId);
      }

      if (priceUnitToggle) priceUnitToggle.addEventListener('click', () => setPriceMetric('unit'));
      if (priceStackToggle) priceStackToggle.addEventListener('click', () => setPriceMetric('stack'));

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
