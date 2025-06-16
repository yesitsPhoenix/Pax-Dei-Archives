// frontend/www/js/modules/salesChart.js
import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';

let salesChart = null;

export const renderSalesChart = async (timeframe = 'daily') => {
    if (!currentCharacterId) {
        if (salesChart) {
            salesChart.destroy();
            salesChart = null;
        }
        return;
    }

    try {
        const { data: sales, error } = await supabase
            .from('sales')
            .select('sale_date, total_sale_price')
            .eq('character_id', currentCharacterId)
            .order('sale_date', { ascending: true });

        if (error) {
            throw error;
        }

        const processedData = aggregateSalesData(sales, timeframe);
        const labels = Object.keys(processedData);
        const data = Object.values(processedData);


        const ctx = document.getElementById('salesChartCanvas').getContext('2d');

        if (salesChart) {
            salesChart.destroy();
        }

        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gross Sales',
                    data: data,
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: false
                }]
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
                            text: 'Total Sales (Gold)',
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
                                return `Sales: ${context.parsed.y.toLocaleString()} Gold`;
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
                        text: `Sales by ${timeframe === 'monthly' ? 'Month' : (timeframe === 'weekly' ? 'Week' : 'Day')}`,
                        font: {
                            size: 18
                        },
                        color: 'rgb(255, 255, 255)'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering sales chart:', error.message);
    }
};

const aggregateSalesData = (sales, timeframe) => {
    const aggregated = {};

    sales.forEach(sale => {
        const saleDate = new Date(sale.sale_date);
        let key;

        if (timeframe === 'monthly') {
            key = `${saleDate.getFullYear()}-${(saleDate.getMonth() + 1).toString().padStart(2, '0')}`;
        } else if (timeframe === 'weekly') {
            const date = new Date(saleDate);
            const day = date.getUTCDay();
            const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setUTCDate(diff));

            const year = monday.getUTCFullYear();
            const week = getWeekNumber(monday);
            key = `${year}-W${week.toString().padStart(2, '0')}`;
        } else if (timeframe === 'daily') {
            key = `${saleDate.getFullYear()}-${(saleDate.getMonth() + 1).toString().padStart(2, '0')}-${saleDate.getUTCDate().toString().padStart(2, '0')}`;
        }


        if (!aggregated[key]) {
            aggregated[key] = 0;
        }
        aggregated[key] += sale.total_sale_price;
    });

    const sortedKeys = Object.keys(aggregated).sort();
    const sortedAggregated = {};
    sortedKeys.forEach(key => {
        sortedAggregated[key] = aggregated[key];
    });

    return sortedAggregated;
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
