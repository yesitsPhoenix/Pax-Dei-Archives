import { supabase } from './supabaseClient.js';

const highestSalesList = document.getElementById('highest-sales-list');
const mostSoldQuantityList = document.getElementById('most-sold-quantity-list');
const topRevenueItemsList = document.getElementById('top-profitable-items-list');
const salesVolumeByCategoryList = document.getElementById('sales-volume-by-category-list');

let dailySalesChartInstance = null;
let dailyMarketActivityChartInstance = null;
let specificItemPriceChartInstance = null;
let dailyAvgPriceChartInstance = null;
let dailyAvgListingTimeChartInstance = null;

let currentSelectedItemId = null;
let currentSelectedRegion = null;

let specificItemPriceChartUnitInstance = null;
let specificItemPriceChartStackInstance = null;

const formatCurrency = (amount) => (amount !== null && amount !== undefined) ? amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A';
const formatDecimal = (amount, decimals = 2) => (amount !== null && amount !== undefined) ? parseFloat(amount).toFixed(decimals) : 'N/A';

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
  }

  const newChart = new Chart(ctx, chartConfig);

  if (chartId === 'daily-sales-chart') dailySalesChartInstance = newChart;
  if (chartId === 'daily-market-activity-chart') dailyMarketActivityChartInstance = newChart;
  if (chartId === 'specific-item-price-chart-unit') specificItemPriceChartInstance = newChart;
  if (chartId === 'specific-item-price-chart-stack') specificItemPriceChartStackInstance = newChart;
  if (chartId === 'daily-avg-price-chart') dailyAvgPriceChartInstance = newChart;
  if (chartId === 'daily-avg-listing-time-chart') dailyAvgListingTimeChartInstance = newChart;

  return newChart;
}


async function loadListTrendsData() {
  //console.log('loadListTrendsData called');
  if (!highestSalesList || !mostSoldQuantityList || !topRevenueItemsList || !salesVolumeByCategoryList) {
    console.warn('One or more list elements not found.');
    return;
  }

  highestSalesList.innerHTML = '<p class="text-white">Loading highest sales...</p>';
  mostSoldQuantityList.innerHTML = '<p class="text-white">Loading most sold items...</p>';
  topRevenueItemsList.innerHTML = '<p class="text-white">Loading revenue items...</p>';
  salesVolumeByCategoryList.innerHTML = '<p class="text-white">Loading sales volume...</p>';

  try {
    const { data, error } = await supabase.rpc('get_all_list_trends_data_by_region', {
      p_region_filter: currentSelectedRegion
    });

    if (error) {
      const errorMessage = `<p class="text-red-400">Error loading data: ${error.message}</p>`;
      highestSalesList.innerHTML = errorMessage;
      mostSoldQuantityList.innerHTML = errorMessage;
      topRevenueItemsList.innerHTML = errorMessage;
      salesVolumeByCategoryList.innerHTML = errorMessage;
      console.error('Error in get_all_list_trends_data_by_region:', error);
      return;
    }

    if (!data) {
      highestSalesList.innerHTML = '<p class="text-white">No data returned.</p>';
      mostSoldQuantityList.innerHTML = '<p class="text-white">No data returned.</p>';
      topRevenueItemsList.innerHTML = '<p class="text-white">No data returned.</p>';
      salesVolumeByCategoryList.innerHTML = '<p class="text-white">No data returned.</p>';
      console.warn('No data returned from get_all_list_trends_data_by_region.');
      return;
    }

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
    //console.log('List trends data loaded successfully.');
  } catch (err) {
    const errorMessage = `<p class="text-red-400">An error occurred: ${err.message}</p>`;
    highestSalesList.innerHTML = errorMessage;
    mostSoldQuantityList.innerHTML = errorMessage;
    topRevenueItemsList.innerHTML = errorMessage;
    salesVolumeByCategoryList.innerHTML = errorMessage;
    console.error('Error loading list trends data:', err);
  }
}

async function loadDailyTotalSalesChart() {
  //console.log('loadDailyTotalSalesChart called');
  try {
    const { data, error } = await supabase.rpc('get_daily_total_sales', {
      p_region_filter: currentSelectedRegion
    });

    if (error) {
      if (dailySalesChartInstance) dailySalesChartInstance.destroy();
      const ctx = document.getElementById('daily-sales-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '16px Arial';
        ctx.fillText(`Error: ${error.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.error('Error in get_daily_total_sales:', error);
      return;
    }

    if (!data || data.length === 0) {
      if (dailySalesChartInstance) dailySalesChartInstance.destroy();
      const ctx = document.getElementById('daily-sales-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B0B0B0';
        ctx.font = '16px Arial';
        ctx.fillText('No data available for this region.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from get_daily_total_sales.');
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
    //console.log('Daily Total Sales chart loaded.');
  } catch (err) {
    if (dailySalesChartInstance) dailySalesChartInstance.destroy();
    const ctx = document.getElementById('daily-sales-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '16px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyTotalSalesChart:', err);
  }
}

async function loadDailyMarketActivityChart() {
  //console.log('loadDailyMarketActivityChart called');
  try {
    const { data, error } = await supabase.rpc('get_daily_market_activity_data', {
      p_region_filter: currentSelectedRegion
    });

    if (error) {
      if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
      const ctx = document.getElementById('daily-market-activity-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '16px Arial';
        ctx.fillText(`Error: ${error.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.error('Error in get_daily_market_activity_data:', error);
      return;
    }

    const newListingsData = data.new_listings || [];
    const salesCountData = data.sales_count || [];

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
    //console.log('Daily Market Activity chart loaded.');
  } catch (err) {
    if (dailyMarketActivityChartInstance) dailyMarketActivityChartInstance.destroy();
    const ctx = document.getElementById('daily-market-activity-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '16px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyMarketActivityChart:', err);
  }
}

async function loadDailyAverageItemPriceChart() {
  //console.log('loadDailyAverageItemPriceChart called');
  try {
    const { data, error } = await supabase.rpc('get_daily_average_sale_price', {
      p_region_filter: currentSelectedRegion
    });

    if (error) {
      if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-price-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '16px Arial';
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
        ctx.font = '16px Arial';
        ctx.fillText('No data available for average prices in this region.', ctx.canvas.width / 2, ctx.canvas.height / 2);
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
    //console.log('Daily Average Item Price chart loaded.');
  } catch (err) {
    if (dailyAvgPriceChartInstance) dailyAvgPriceChartInstance.destroy();
    const ctx = document.getElementById('daily-avg-price-chart')?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF6666';
      ctx.font = '16px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyAverageItemPriceChart:', err);
  }
}

async function loadDailyAverageListingTimeframeChart() {
  try {
    const { data, error } = await supabase.rpc('get_average_listing_timeframe', {
      p_region_filter: currentSelectedRegion
    });
    if (error) {
      if (dailyAvgListingTimeChartInstance) dailyAvgListingTimeChartInstance.destroy();
      const ctx = document.getElementById('daily-avg-listing-time-chart')?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF6666';
        ctx.font = '16px Arial';
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
        ctx.font = '16px Arial';
        ctx.fillText('No data available for average listing timeframe in this region.', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
      console.warn('No data from get_average_listing_timeframe.');
      return;
    }
    const labels = data.map(row => row.sale_date);
    const avgTimes = data.map(row => row.average_listing_time_days);
    const datasetsConfig = [{
      label: 'Avg. Days on Market',
      data: avgTimes,
      borderColor: '#4285F4', // A good blue
      backgroundColor: 'rgba(66, 133, 244, 0.2)', // Transparent blue for the area
      tension: 0.3,
      fill: true // Keep the area fill
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
      ctx.font = '16px Arial';
      ctx.fillText(`An unexpected error occurred: ${err.message}`, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
    console.error('Unexpected error in loadDailyAverageListingTimeframeChart:', err);
  }
}

async function loadSpecificItemPriceChart(itemId = null) {
  if (!itemId || itemId === 'all') {
    ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
      const ctx = document.getElementById(id)?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.fillText('  Please select an item to view its price trend.', ctx.canvas.width / 2, ctx.canvas.height / 2);
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
      p_region_filter: currentSelectedRegion
    });

    if (error) {
      ['specific-item-price-chart-unit', 'specific-item-price-chart-stack'].forEach(id => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FF6666';
          ctx.font = '16px Arial';
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
          ctx.font = '16px Arial';
          ctx.fillText('  No data has been recorded for this item yet.', ctx.canvas.width / 2, ctx.canvas.height / 2);
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
        ctx.font = '16px Arial';
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




async function populateDropdown(selectElementId, rpcFunctionName, valueColumn, textColumn, defaultOptionText) {
  //console.log('populateDropdown called for:', selectElementId);
  const selectElement = document.getElementById(selectElementId);
  if (!selectElement) {
    console.warn('Select element not found:', selectElementId);
    return;
  }

  if (selectElementId === 'item-filter-select') {
    selectElement.innerHTML = `<option value="all">${defaultOptionText}</option>`;
  } else {
    selectElement.innerHTML = '';
  }

  if (rpcFunctionName === 'get_all_items_for_dropdown') {
    try {
      const { data, error } = await supabase.rpc(rpcFunctionName);
      if (error) {
        console.error('Error in get_all_items_for_dropdown:', error);
        return;
      }
      data.forEach(row => {
        const option = document.createElement('option');
        option.value = row[valueColumn];
        option.textContent = row[textColumn];
        selectElement.appendChild(option);
      });
      //console.log('Dropdown populated:', selectElementId);
    } catch (err) {
      console.error('Unexpected error in populateDropdown:', err);
    }
  }
}

async function loadAllTrendsData() {
  //console.log('loadAllTrendsData called');
  await loadListTrendsData();
  await loadDailyTotalSalesChart();
  await loadDailyMarketActivityChart();
  await loadDailyAverageItemPriceChart();
  await loadDailyAverageListingTimeframeChart();
  await loadSpecificItemPriceChart(currentSelectedItemId);
  //console.log('All trends data loaded.');
}

document.addEventListener('DOMContentLoaded', async () => {
  //console.log('DOMContentLoaded event fired.');
  const itemFilterSelect = document.getElementById('item-filter-select');
  const regionFilterSelect = document.getElementById('region-filter-select');

  await populateDropdown('item-filter-select', 'get_all_items_for_dropdown', 'item_id', 'item_name', 'All Items');

  currentSelectedRegion = regionFilterSelect ? regionFilterSelect.value : 'all';
  currentSelectedItemId = itemFilterSelect ? (itemFilterSelect.value === 'all' || itemFilterSelect.value === '' ? null : parseInt(itemFilterSelect.value, 10)) : null;

  await loadAllTrendsData();

  if (itemFilterSelect) {
    itemFilterSelect.addEventListener('change', (event) => {
      currentSelectedItemId = event.target.value === 'all' || event.target.value === '' ? null : parseInt(event.target.value, 10);
      loadSpecificItemPriceChart(currentSelectedItemId);
      //console.log('Item filter changed to:', currentSelectedItemId);
    });
  }

  if (regionFilterSelect) {
    regionFilterSelect.addEventListener('change', async (event) => {
      currentSelectedRegion = event.target.value;
      //console.log('Region filter changed to:', currentSelectedRegion);
      await loadAllTrendsData();
    });
  }
});
