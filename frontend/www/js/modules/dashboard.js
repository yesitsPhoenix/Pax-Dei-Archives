const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');
const currentHoldingsEl = document.getElementById('dashboard-current-holdings');

export const renderDashboard = (allListings, characterData) => {
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl || !currentHoldingsEl) {
        console.error("Dashboard elements not found.");
        return;
    }
    
    // console.log("Character data received by renderDashboard:", characterData);
    // console.log("Gold value from characterData:", characterData ? characterData.gold : 0);

    const currentGoldHoldings = (characterData ? characterData.gold : 0);

    const soldListings = allListings.filter(l => l.is_fully_sold);
    const feesPaid = allListings.reduce((sum, l) => sum + (l.market_fee || 0), 0);
    const grossSales = soldListings.reduce((sum, l) => sum + (l.total_listed_price || 0), 0);
    const netProfit = grossSales - feesPaid;
    const activeListingsCount = allListings.filter(l => !l.is_fully_sold && !l.is_cancelled).length;


    const formatCurrency = (amount) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    grossSalesEl.innerHTML = `${formatCurrency(grossSales)} <i class="fa-solid fa-chart-line"></i>`;
    feesPaidEl.innerHTML = `${formatCurrency(feesPaid)} <i class="fa-solid fa-arrow-trend-down"></i>`;
    netProfitEl.innerHTML = `${formatCurrency(netProfit)} <i class="fas fa-coins"></i>`;
    activeListingsEl.textContent = activeListingsCount;
    currentHoldingsEl.innerHTML = `${formatCurrency(currentGoldHoldings)} <i class="fa-solid fa-sack-dollar"></i>`;
};
