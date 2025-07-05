import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';

let marketActivityChart = null;

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
      aggregatedPVE,
      allLabels
    } = aggregateTransactionData(transactions, timeframe);

    if (marketActivityChart) {
      marketActivityChart.destroy();
    }

    marketActivityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          createDataset('Gross Sales', aggregatedSales, allLabels, '#FFD700'),
          createDataset('Purchases', aggregatedPurchases, allLabels, '#00CED1'),
          createDataset('Fees Paid', aggregatedFees, allLabels, '#FF6384'),
          createDataset('PVE Net Gain/Loss', aggregatedPVE, allLabels, '#32CD32')
        ]
      },
      options: chartOptions(timeframe)
    });
  } catch (error) {
    console.error('Error rendering market activity chart:', error.message);
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

const chartOptions = (timeframe) => ({
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
      text: `Market & PVE Activity by ${timeframe === 'monthly' ? 'Month' : timeframe === 'weekly' ? 'Week' : 'Day'} in UTC`,
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
      const d = new Date(Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate()));
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      d.setUTCDate(diff);
      const year = d.getUTCFullYear();
      const week = getWeekNumber(d);
      key = `${year}-W${week.toString().padStart(2, '0')}`;
    } else {
      // Modified for daily figures to remove the year
      key = `${(transactionDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${transactionDate.getUTCDate().toString().padStart(2, '0')}`;
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

  const allLabels = Array.from(allLabelsSet).sort();

  return { aggregatedSales, aggregatedPurchases, aggregatedFees, aggregatedPVE, allLabels };
};

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const hexToRGBA = (hex, alpha = 1) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const setupSalesChartListeners = (getDataCallback) => {
  document.getElementById('viewSalesWeekly')?.addEventListener('click', () => renderSalesChart(getDataCallback(), 'weekly'));
  document.getElementById('viewSalesMonthly')?.addEventListener('click', () => renderSalesChart(getDataCallback(), 'monthly'));
  document.getElementById('viewSalesDaily')?.addEventListener('click', () => renderSalesChart(getDataCallback(), 'daily'));
};