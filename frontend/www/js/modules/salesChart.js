import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';

let marketActivityChart = null;
let pveActivityChart = null;

export const renderSalesChart = (transactions, timeframe = 'daily') => {
  const ctx = document.getElementById('salesChartCanvas')?.getContext('2d');
  if (!currentCharacterId || !transactions || !ctx) {
    if (marketActivityChart) {
      marketActivityChart.destroy();
      marketActivityChart = null;
    }
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  try {
    const {
      aggregatedSales,
      aggregatedPurchases,
      aggregatedFees,
      allLabels,
      displayLabels
    } = aggregateTransactionData(transactions, timeframe);

    if (marketActivityChart) {
      marketActivityChart.destroy();
    }

    marketActivityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [
          createDataset('Gross Sales', aggregatedSales, allLabels, '#FFD700'),
          createDataset('Purchases', aggregatedPurchases, allLabels, '#00CED1'),
          createDataset('Fees Paid', aggregatedFees, allLabels, '#FF6384')
        ]
      },
      options: chartOptions(timeframe, 'Market Activity')
    });
  } catch (error) {
    console.error('Error rendering market activity chart:', error.message);
  }
};

export const renderPVEChart = (transactions, timeframe = 'daily') => {
  const ctx = document.getElementById('pveChartCanvas')?.getContext('2d');
  if (!currentCharacterId || !transactions || !ctx) {
    if (pveActivityChart) {
      pveActivityChart.destroy();
      pveActivityChart = null;
    }
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  try {
    const {
      aggregatedPVE,
      allLabels,
      displayLabels
    } = aggregateTransactionData(transactions, timeframe);

    if (pveActivityChart) {
      pveActivityChart.destroy();
    }

    pveActivityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [
          createDataset('PVE Net Gain/Loss', aggregatedPVE, allLabels, '#32CD32')
        ]
      },
      options: chartOptions(timeframe, 'PVE Gold Activity')
    });
  } catch (error) {
    console.error('Error rendering PVE activity chart:', error.message);
  }
};

const createDataset = (label, dataMap, labels, color) => ({
  label,
  data: labels.map(key => Math.round(dataMap[key] || 0)),
  borderColor: color,
  backgroundColor: hexToRGBA(color, 0.2),
  tension: 0.3,
  fill: false
});

const chartOptions = (timeframe, titleText) => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'category',
      title: {
        display: true,
        text: timeframe === 'monthly' ? 'Month' : timeframe === 'weekly' ? 'Week' : 'Day',
        color: '#ffffff'
      },
      ticks: { color: '#ffffff' },
      grid: { color: 'rgba(248, 248, 248, 0.1)' }
    },
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Amount (Gold)',
        color: '#ffffff'
      },
      ticks: {
        color: '#ffffff',
        callback: value => value.toLocaleString()
      },
      grid: { color: 'rgba(255, 255, 255, 0.1)' }
    }
  },
  plugins: {
    legend: { display: true, position: 'top', labels: { color: '#ffffff' } },
    tooltip: {
      callbacks: {
        label: context => `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()} Gold`
      },
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      bodyColor: '#ffffff',
      titleColor: '#ffffff',
      padding: 10,
      cornerRadius: 8
    },
    title: {
      display: true,
      text: `${titleText} by ${timeframe === 'monthly' ? 'Month' : timeframe === 'weekly' ? 'Week' : 'Day'} in UTC`,
      font: { size: 18 },
      color: '#ffffff'
    }
  }
});

const aggregateTransactionData = (transactions, timeframe) => {
  const aggregatedSales = {};
  const aggregatedPurchases = {};
  const aggregatedFees = {};
  const aggregatedPVE = {};
  const allLabelsSet = new Set();

  transactions.forEach(transaction => {
    const transactionDate = new Date(transaction.date);
    let key;
    if (timeframe === 'monthly') {
      key = `${transactionDate.getUTCFullYear()}-${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    } else if (timeframe === 'weekly') {
      // Get the ISO week year and week number
      const d = new Date(Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate()));
      const { year, week } = getISOWeekAndYear(d);
      key = `${year}-W${week.toString().padStart(2, '0')}`;
    } else {
      // Daily format: Include year for proper sorting
      key = `${transactionDate.getUTCFullYear()}-${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${transactionDate.getUTCDate().toString().padStart(2, '0')}`;
    }

    const type = (transaction.type || '').trim().toLowerCase();

    if (type === 'sale') {
      aggregatedSales[key] = (aggregatedSales[key] || 0) + Math.round(transaction.total_amount || 0);
    } else if (type === 'purchase') {
      aggregatedPurchases[key] = (aggregatedPurchases[key] || 0) + Math.round(transaction.total_amount || 0);
    } else if (type === 'listing fee') {
      aggregatedFees[key] = (aggregatedFees[key] || 0) + Math.round(transaction.fee || 0);
    } else if (type === 'pve gold') {
      aggregatedPVE[key] = (aggregatedPVE[key] || 0) + Math.round(transaction.total_amount || 0);
    }

    allLabelsSet.add(key);
  });

  // Sort all labels chronologically using the full key format
  const allLabels = Array.from(allLabelsSet).sort((a, b) => a.localeCompare(b));

  // Create display labels by stripping the year for daily view
  const displayLabels = allLabels.map(label => {
    if (timeframe === 'daily') {
      // Convert YYYY-MM-DD to MM-DD for display
      const parts = label.split('-');
      return `${parts[1]}-${parts[2]}`;
    }
    // For monthly and weekly, keep as-is
    return label;
  });

  return { aggregatedSales, aggregatedPurchases, aggregatedFees, aggregatedPVE, allLabels, displayLabels };
};

const getISOWeekAndYear = (date) => {
  // Create a copy to avoid modifying the original
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  
  // Get the year of this Thursday (this is the ISO week year)
  const year = d.getUTCFullYear();
  
  // Get first day of that year
  const yearStart = new Date(Date.UTC(year, 0, 1));
  
  // Calculate week number
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  return { year, week: weekNo };
};

const hexToRGBA = (hex, alpha = 1) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const setupSalesChartListeners = (getDataCallback) => {

};
