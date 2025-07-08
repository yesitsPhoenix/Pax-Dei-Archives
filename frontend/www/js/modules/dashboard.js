const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');
const currentHoldingsEl = document.getElementById('dashboard-current-holdings');
const earnedPveGoldEl = document.getElementById('dashboard-earned-pve-gold');

export const renderDashboard = (dashboardStats, characterData) => {
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl || !currentHoldingsEl || !earnedPveGoldEl) {
        console.error("Dashboard elements not found.");
        return;
    }
    
    const currentGoldHoldings = characterData ? characterData.gold : 0;
    const grossSales = dashboardStats.gross_sales || 0;
    const feesPaid = dashboardStats.fees_paid || 0;
    const activeListingsCount = dashboardStats.active_listings_count || 0;
    const netProfit = grossSales - feesPaid;
    const pveGoldTotal = dashboardStats.pve_gold_total || 0;

    const formatCurrency = (amount) => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return safeAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    grossSalesEl.innerHTML = `${formatCurrency(grossSales)} <i class="fa-solid fa-chart-line"></i>`;
    feesPaidEl.innerHTML = `${formatCurrency(feesPaid)} <i class="fa-solid fa-arrow-trend-down"></i>`;
    netProfitEl.innerHTML = `${formatCurrency(netProfit)} <i class="fas fa-coins"></i>`;
    activeListingsEl.innerHTML = `${activeListingsCount} <i class="fa-solid fa-list"></i>`;
    currentHoldingsEl.innerHTML = `${formatCurrency(currentGoldHoldings)} <i class="fa-solid fa-sack-dollar"></i>`;
    earnedPveGoldEl.innerHTML = `${formatCurrency(pveGoldTotal)} <i class="fa-solid fa-hand-holding-dollar"></i>`;
};