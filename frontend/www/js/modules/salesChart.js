import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';

let marketActivityChart = null;

export const renderSalesChart = async (timeframe = 'daily') => {
    if (!currentCharacterId) {
        if (marketActivityChart) {
            marketActivityChart.destroy();
            marketActivityChart = null;
        }
        return;
    }

    try {
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('sale_date, total_sale_price')
            .eq('character_id', currentCharacterId)
            .order('sale_date', { ascending: true });

        if (salesError) {
            throw salesError;
        }

        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('purchase_date, total_purchase_price')
            .eq('character_id', currentCharacterId)
            .order('purchase_date', { ascending: true });

        if (purchasesError) {
            throw purchasesError;
        }

        const combinedData = [];
        sales.forEach(s => combinedData.push({ type: 'sale', date: s.sale_date, amount: s.total_sale_price }));
        purchases.forEach(p => combinedData.push({ type: 'purchase', date: p.purchase_date, amount: p.total_purchase_price }));

        combinedData.sort((a, b) => new Date(a.date) - new Date(b.date));

        const { aggregatedSales, aggregatedPurchases, allLabels } = aggregateTransactionData(combinedData, timeframe);

        const ctx = document.getElementById('salesChartCanvas').getContext('2d');

        if (marketActivityChart) {
            marketActivityChart.destroy();
            marketActivityChart = null;
        }

        marketActivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Gross Sales',
                        data: allLabels.map(label => Math.round(aggregatedSales[label] || 0)),
                        borderColor: '#FFD700',
                        backgroundColor: 'rgba(255, 215, 0, 0.2)',
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Total Purchases',
                        data: allLabels.map(label => Math.round(aggregatedPurchases[label] || 0)),
                        borderColor: 'rgba(173, 76, 10, 1)',
                        backgroundColor: 'rgba(173, 76, 10, 0.2)',
                        tension: 0.1,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'category',
                        title: {
                            display: true,
                            text: timeframe === 'monthly' ? 'Month' : (timeframe === 'weekly' ? 'Week' : 'Day'),
                            color: 'rgb(255, 255, 255)'
                        },
                        ticks: {
                            color: 'rgb(255, 255, 255)'
                        },
                        grid: {
                            color: 'rgba(248, 248, 248, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (Gold)',
                            color: 'rgb(255, 255, 255)'
                        },
                        ticks: {
                            color: 'rgb(255, 255, 255)',
                            callback: function(value, index, values) {
                                return value.toLocaleString();
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: 'rgb(255, 255, 255)'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()} Gold`;
                            }
                        },
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        bodyColor: 'rgb(255, 255, 255)',
                        titleColor: 'rgb(255, 255, 255)',
                        padding: 10,
                        cornerRadius: 8
                    },
                    title: {
                        display: true,
                        text: `Market Activity by ${timeframe === 'monthly' ? 'Month' : (timeframe === 'weekly' ? 'Week' : 'Day')}`,
                        font: {
                            size: 18
                        },
                        color: 'rgb(255, 255, 255)'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering market activity chart:', error.message);
    }
};

const aggregateTransactionData = (transactions, timeframe) => {
    const aggregatedSales = {};
    const aggregatedPurchases = {};
    const allLabelsSet = new Set();

    transactions.forEach(transaction => {
        const transactionDate = new Date(transaction.date);
        let key;

        if (timeframe === 'monthly') {
            key = `${transactionDate.getFullYear()}-${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}`;
        } else if (timeframe === 'weekly') {
            const date = new Date(transactionDate);
            const day = date.getUTCDay();
            const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setUTCDate(diff));

            const year = monday.getUTCFullYear();
            const week = getWeekNumber(monday);
            key = `${year}-W${week.toString().padStart(2, '0')}`;
        } else if (timeframe === 'daily') {
            key = `${transactionDate.getFullYear()}-${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}-${transactionDate.getUTCDate().toString().padStart(2, '0')}`;
        }

        allLabelsSet.add(key);

        if (transaction.type === 'sale') {
            if (!aggregatedSales[key]) {
                aggregatedSales[key] = 0;
            }
            aggregatedSales[key] += Math.round(transaction.amount || 0);
        } else if (transaction.type === 'purchase') {
            if (!aggregatedPurchases[key]) {
                aggregatedPurchases[key] = 0;
            }
            aggregatedPurchases[key] += Math.round(transaction.amount || 0);
        }
    });

    const allLabels = Array.from(allLabelsSet).sort();

    return { aggregatedSales, aggregatedPurchases, allLabels };
};

const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const setupSalesChartListeners = () => {
    const viewSalesWeeklyBtn = document.getElementById('viewSalesWeekly');
    const viewSalesMonthlyBtn = document.getElementById('viewSalesMonthly');
    const viewSalesDailyBtn = document.getElementById('viewSalesDaily');

    if (viewSalesWeeklyBtn) {
        viewSalesWeeklyBtn.addEventListener('click', () => renderSalesChart('weekly'));
    }
    if (viewSalesMonthlyBtn) {
        viewSalesMonthlyBtn.addEventListener('click', () => renderSalesChart('monthly'));
    }
    if (viewSalesDailyBtn) {
        viewSalesDailyBtn.addEventListener('click', () => renderSalesChart('daily'));
    }
};
