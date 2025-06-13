// js/modules/dashboard.js

const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');

export const renderDashboard = (allListings) => {
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl) {
        console.error("Dashboard elements not found.");
        return;
    }

    const soldListings = allListings.filter(l => l.is_fully_sold);
    const feesPaid = allListings.reduce((sum, l) => sum + (l.market_fee || 0), 0);
    const grossSales = soldListings.reduce((sum, l) => sum + (l.total_listed_price || 0), 0);
    const netProfit = grossSales - feesPaid;
    const activeListingsCount = allListings.filter(l => !l.is_fully_sold && !l.is_cancelled).length;

    const formatCurrency = (amount) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    grossSalesEl.innerHTML = `${formatCurrency(grossSales)} <i class="fas fa-coins"></i>`;
    feesPaidEl.innerHTML = `${formatCurrency(feesPaid)} <i class="fas fa-coins"></i>`;
    netProfitEl.innerHTML = `${formatCurrency(netProfit)} <i class="fas fa-coins"></i>`;
    activeListingsEl.textContent = activeListingsCount;
};