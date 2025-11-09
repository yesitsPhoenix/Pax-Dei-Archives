import { supabase } from './supabaseClient.js';

let rateHrDistributionChartInstance = null;
let popularityChartInstance = null;
let toolEffectivenessChartInstance = null;
let miracleImpactChartInstance = null;

const CHART_COLOR_PRIMARY = 'rgba(74, 222, 128, 0.6)';
const CHART_COLOR_SECONDARY = 'rgba(59, 130, 246, 0.6)';
const CHART_COLOR_TERTIARY = 'rgba(234, 179, 8, 0.6)';
const CHART_COLOR_QUATERNARY = 'rgba(168, 85, 247, 0.6)';
const BORDER_COLOR_PRIMARY = 'rgb(74, 222, 128)';
const BORDER_COLOR_SECONDARY = 'rgb(59, 130, 246)';
const BORDER_COLOR_TERTIARY = 'rgb(234, 179, 8)';
const BORDER_COLOR_QUATERNARY = 'rgb(168, 85, 247)';
const GRID_COLOR = 'rgba(156, 163, 175, 0.2)';
const TEXT_COLOR = 'rgb(255, 255, 255)';
const MIRACLE_COLOR_ACTIVE = 'rgba(255, 99, 132, 0.6)';
const MIRACLE_COLOR_INACTIVE = 'rgba(54, 162, 235, 0.6)';

function createRateHrDistributionChart(data) {
    const ctx = document.getElementById('rateHrDistributionChart')?.getContext('2d');
    if (!ctx) {
        return null;
    }

    if (rateHrDistributionChartInstance) {
        rateHrDistributionChartInstance.destroy();
    }

    rateHrDistributionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Number of Runs',
                data: data.values,
                backgroundColor: CHART_COLOR_PRIMARY,
                borderColor: BORDER_COLOR_PRIMARY,
                borderWidth: 1,
                barPercentage: 1.0,
                categoryPercentage: 1.0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Rate/hr Distribution',
                    color: TEXT_COLOR
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const bin = items[0].label;
                            return `Rate: ${bin} /hr`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Rate/hr Bin',
                        color: TEXT_COLOR
                    },
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Run Count',
                        color: TEXT_COLOR
                    },
                    beginAtZero: true,
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                }
            }
        }
    });
}

function createPopularityChart(data) {
    const ctx = document.getElementById('popularityChart')?.getContext('2d');
    if (!ctx) {
        return null;
    }

    if (popularityChartInstance) {
        popularityChartInstance.destroy();
    }

    popularityChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Run Count',
                data: data.values,
                backgroundColor: CHART_COLOR_SECONDARY,
                borderColor: BORDER_COLOR_SECONDARY,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Popularity by Category',
                    color: TEXT_COLOR
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Run Count',
                        color: TEXT_COLOR
                    },
                    beginAtZero: true,
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                }
            }
        }
    });
}

function createToolEffectivenessChart(data) {
    const ctx = document.getElementById('toolEffectivenessChart')?.getContext('2d');
    if (!ctx) {
        return null;
    }

    if (toolEffectivenessChartInstance) {
        toolEffectivenessChartInstance.destroy();
    }

    toolEffectivenessChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Average Rate/hr',
                data: data.values,
                backgroundColor: CHART_COLOR_TERTIARY,
                borderColor: BORDER_COLOR_TERTIARY,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Average Rate/hr by Tool',
                    color: TEXT_COLOR
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Average Rate/hr',
                        color: TEXT_COLOR
                    },
                    beginAtZero: true,
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                }
            }
        }
    });
}

function createMiracleImpactChart(data) {
    const ctx = document.getElementById('miracleImpactChart')?.getContext('2d');
    if (!ctx) {
        return null;
    }

    if (miracleImpactChartInstance) {
        miracleImpactChartInstance.destroy();
    }

    miracleImpactChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Miracle Active (Avg Rate/hr)',
                    data: data.activeRates,
                    backgroundColor: MIRACLE_COLOR_ACTIVE,
                    borderColor: 'rgb(255, 99, 132)',
                    borderWidth: 1
                },
                {
                    label: 'Miracle Inactive (Avg Rate/hr)',
                    data: data.inactiveRates,
                    backgroundColor: MIRACLE_COLOR_INACTIVE,
                    borderColor: 'rgb(54, 162, 235)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: TEXT_COLOR
                    }
                },
                title: {
                    display: true,
                    text: 'Miracle Impact on Rate/hr by Category',
                    color: TEXT_COLOR
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Category',
                        color: TEXT_COLOR
                    },
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Average Rate/hr',
                        color: TEXT_COLOR
                    },
                    beginAtZero: true,
                    grid: {
                        color: GRID_COLOR
                    },
                    ticks: {
                        color: TEXT_COLOR
                    }
                }
            }
        }
    });
}

async function loadRuns(filterCriteria) {
    let query = supabase
        .from('farming_runs')
        .select('amount, time_ms, category, tool_used, miracle_active, item');

    if (filterCriteria.category && filterCriteria.category !== 'All Categories') {
        query = query.eq('category', filterCriteria.category);
    }
    if (filterCriteria.item && filterCriteria.item !== 'All Items' && filterCriteria.item !== '') {
        query = query.eq('item', filterCriteria.item);
    }
    if (filterCriteria.tool_used && filterCriteria.tool_used !== 'All Tools' && filterCriteria.tool_used !== '') {
        query = query.eq('tool_used', filterCriteria.tool_used);
    }

    const { data: rawRuns, error } = await query;

    if (error || !rawRuns) {
        return [];
    }

    const runsWithRates = rawRuns.map(run => {
        const time_hr = run.time_ms / 3600000;
        const rate_hr = time_hr > 0 ? Math.round(run.amount / time_hr) : 0;

        return {
            rate_hr: rate_hr,
            category: run.category,
            tool_used: run.tool_used,
            miracle_active: run.miracle_active
        };
    }).filter(run => run.rate_hr > 0);

    return runsWithRates;
}

function processRateHrDistributionData(runs) {
    const rates = runs.map(r => r.rate_hr).filter(r => r !== null && r !== undefined);
    if (rates.length === 0) return { labels: [], values: [] };

    // Define the upper bounds for the first 5 bins
    const binUpperBounds = [2000, 4000, 6000, 8000, 10000]; 
    const binLabels = ['0-2k', '2k-4k', '4k-6k', '6k-8k', '8k-10k', '10k+'];
    // Initialize bin counts for 6 bins (5 defined bounds + 1 catch-all)
    const binCounts = new Array(binLabels.length).fill(0); 

    for (const rate of rates) {
        let assigned = false;
        
        // Find which bin the rate falls into (i corresponds to the bin index)
        for (let i = 0; i < binUpperBounds.length; i++) {
            // Rates are already filtered to be > 0 in loadRuns
            if (rate <= binUpperBounds[i]) {
                binCounts[i]++;
                assigned = true;
                break;
            }
        }
        
        // If the rate is larger than the highest bound (10000), it goes into the last bin ('10k+')
        if (!assigned) {
            binCounts[binLabels.length - 1]++;
        }
    }

    return {
        labels: binLabels,
        values: binCounts
    };
}

function processPopularityData(runs) {
    const categoryCounts = {};
    for (const run of runs) {
        const key = run.category;
        if (key) {
            categoryCounts[key] = (categoryCounts[key] || 0) + 1;
        }
    }

    const sortedCategories = Object.entries(categoryCounts).sort(([, countA], [, countB]) => countB - countA);

    return {
        labels: sortedCategories.map(([category]) => category),
        values: sortedCategories.map(([, count]) => count)
    };
}

function processToolEffectivenessData(runs) {
    const toolData = {};
    for (const run of runs) {
        const key = run.tool_used;
        if (key && run.rate_hr > 0) {
            if (!toolData[key]) {
                toolData[key] = { totalRate: 0, count: 0 };
            }
            toolData[key].totalRate += run.rate_hr;
            toolData[key].count += 1;
        }
    }

    const toolAverages = Object.entries(toolData)
        .filter(([key]) => key && key.toLowerCase() !== 'hand')
        .map(([key, data]) => ({
            label: key,
            averageRate: Math.round(data.totalRate / data.count)
        }))
        .sort((a, b) => b.averageRate - a.averageRate);

    return {
        labels: toolAverages.map(d => d.label),
        values: toolAverages.map(d => d.averageRate)
    };
}

function processMiracleImpactData(runs) {
    const categories = Array.from(new Set(runs.map(r => r.category).filter(c => c)));
    const results = {
        labels: [],
        activeRates: [],
        inactiveRates: []
    };

    for (const category of categories) {
        const categoryRuns = runs.filter(run => run.category === category);
        
        const activeRuns = categoryRuns.filter(run => run.miracle_active === true && run.rate_hr > 0);
        const inactiveRuns = categoryRuns.filter(run => run.miracle_active === false && run.rate_hr > 0);
        
        const avgActive = activeRuns.length > 0 
            ? Math.round(activeRuns.reduce((sum, run) => sum + run.rate_hr, 0) / activeRuns.length)
            : 0;
            
        const avgInactive = inactiveRuns.length > 0 
            ? Math.round(inactiveRuns.reduce((sum, run) => sum + run.rate_hr, 0) / inactiveRuns.length)
            : 0;

        if (avgActive > 0 || avgInactive > 0) {
            results.labels.push(category);
            results.activeRates.push(avgActive);
            results.inactiveRates.push(avgInactive);
        }
    }

    return results;
}

export async function loadRunCharts(filterCriteria) {
    const runs = await loadRuns(filterCriteria);

    const rateHrData = processRateHrDistributionData(runs);
    const popularityData = processPopularityData(runs);
    const toolEffectivenessData = processToolEffectivenessData(runs);
    const miracleImpactData = processMiracleImpactData(runs);

    createRateHrDistributionChart(rateHrData);
    createPopularityChart(popularityData);
    createToolEffectivenessChart(toolEffectivenessData);
    createMiracleImpactChart(miracleImpactData);
}

document.addEventListener('DOMContentLoaded', () => {
    loadRunCharts({});
});