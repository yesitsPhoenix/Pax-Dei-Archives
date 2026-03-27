import {
    listingsBody,
    listingsPaginationContainer,
    LISTINGS_PER_PAGE,
    getCurrentListingsPage,
    setCurrentListingsPage
} from './dom.js';
import { getMarketDataForSlug, getMarketDataByItemName, getItemData } from '../services/gamingToolsService.js';

export const renderListingsTable = (listings, actualListingsBody) => {
    const targetBody = actualListingsBody || listingsBody;
    if (!targetBody) return;

    targetBody.innerHTML = '';
    if (listings.length === 0) {
        targetBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No listings found for the current filters.</td></tr>';
        return;
    }

    listings.forEach(listing => {
        const paxDeiSlug = listing.pax_dei_slug ||
            (listing.items && listing.items.pax_dei_slug);

        // Use items.json URL if available (has correct category path), else fallback
        const itemData = paxDeiSlug ? getItemData(paxDeiSlug) : null;

        const paxDeiUrl = itemData?.url || (paxDeiSlug ? `https://paxdei.gaming.tools/${paxDeiSlug}` : '#');
        const isLinkEnabled = !!(itemData?.url || paxDeiSlug);
        const linkClasses = isLinkEnabled ? 'text-blue-600 hover:underline' : 'text-gray-700 cursor-default';
        const linkTarget = isLinkEnabled ? 'target="_blank"' : '';

        // Market Low column — try slug first, fall back to display name via items.json
        const myPrice = parseFloat(listing.listed_price_per_unit) || 0;
        const marketData = (paxDeiSlug ? getMarketDataForSlug(paxDeiSlug) : null)
            ?? getMarketDataByItemName(listing.item_name);
        let marketLowCell;

        if (!marketData) {
            marketLowCell = `<td class="py-3 px-6 text-left text-gray-500 text-md">—</td>`;
        } else {
            const { marketLow, totalListings } = marketData;
            const priceDiff = myPrice - marketLow;
            const priceDiffPct = marketLow > 0 ? (priceDiff / marketLow) * 100 : 0;

            // Smart gold formatter: enough precision to be meaningful at low values
            const fmtGold = (v) => {
                if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 }) + 'g';
                if (v >= 100)  return v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'g';
                return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'g';
            };

            const absDiff = Math.abs(priceDiff);
            const diffStr = fmtGold(absDiff);
            const pctStr = priceDiffPct.toFixed(0) + '%';

            // Tiered thresholds based on actual market price distribution:
            // 65% of items sell under 10g, 82% under 50g — flat % thresholds are misleading at low values.
            // Green uses OR (either condition alone keeps it green).
            // Yellow/Red use AND (must exceed both gates to trigger).
            let yellowGoldGate, yellowPctGate, redGoldGate, redPctGate;
            if (marketLow < 10) {
                yellowGoldGate = 0.5;  yellowPctGate = 10;
                redGoldGate    = 2;    redPctGate    = 30;
            } else if (marketLow < 100) {
                yellowGoldGate = 3;    yellowPctGate = 10;
                redGoldGate    = 10;   redPctGate    = 25;
            } else if (marketLow < 500) {
                yellowGoldGate = 15;   yellowPctGate = 8;
                redGoldGate    = 50;   redPctGate    = 20;
            } else {
                yellowGoldGate = 50;   yellowPctGate = 5;
                redGoldGate    = 150;  redPctGate    = 15;
            }

            const isRed    = priceDiff > redGoldGate    && priceDiffPct > redPctGate;
            const isYellow = !isRed && (priceDiff > yellowGoldGate && priceDiffPct > yellowPctGate);

            let colorClass, icon, tipText, diffLabel;
            if (myPrice <= marketLow) {
                colorClass = 'text-emerald-400';
                icon = '<i class="fas fa-check-circle text-md ml-1"></i>';
                diffLabel = myPrice < marketLow
                    ? `<span class="text-emerald-500 text-md">-${diffStr} (${pctStr} below)</span>`
                    : `<span class="text-emerald-500 text-md">= market low</span>`;
                tipText = `Your price (${fmtGold(myPrice)}) is at or below<br>the home valley low of <strong>${fmtGold(marketLow)}</strong>/unit`;
            } else if (isRed) {
                colorClass = 'text-red-400';
                icon = '<i class="fas fa-arrow-up text-md ml-1"></i>';
                diffLabel = `<span class="text-red-500 text-md">+${diffStr} (+${pctStr})</span>`;
                tipText = `Your price (${fmtGold(myPrice)}) is <strong>+${diffStr} (+${pctStr})</strong><br>above the home valley low of <strong>${fmtGold(marketLow)}</strong>/unit`;
            } else if (isYellow) {
                colorClass = 'text-yellow-400';
                icon = '<i class="fas fa-equals text-md ml-1"></i>';
                diffLabel = `<span class="text-yellow-500 text-md">+${diffStr} (+${pctStr})</span>`;
                tipText = `Your price (${fmtGold(myPrice)}) is <strong>+${diffStr} (+${pctStr})</strong><br>above the home valley low of <strong>${fmtGold(marketLow)}</strong>/unit`;
            } else {
                // Above market but within acceptable range for this price tier
                colorClass = 'text-emerald-400';
                icon = '<i class="fas fa-check-circle text-md ml-1"></i>';
                diffLabel = `<span class="text-emerald-500 text-md">+${diffStr} (+${pctStr})</span>`;
                tipText = `Your price (${fmtGold(myPrice)}) is <strong>+${diffStr} (+${pctStr})</strong><br>above the home valley low of <strong>${fmtGold(marketLow)}</strong>/unit<br><span style='color:#6b7280;font-size:0.85em'>Within acceptable range for this price tier</span>`;
            }

            const tipHtml = `<div class='text-gray-400 text-md mb-1' style='border-bottom:1px solid #334155;padding-bottom:4px;margin-bottom:4px'>${totalListings} listings &middot; gaming.tools</div><div class='${colorClass}'>${tipText}</div>`.replace(/"/g, '&quot;');
            marketLowCell = `
                <td class="py-3 px-6 text-left pda-cell-tip" data-tip-html="${tipHtml}">
                    <span class="${colorClass} font-medium text-md">
                        ${fmtGold(marketLow)}${icon}
                    </span>
                    <div class="mt-0.5">${diffLabel}</div>
                    <div class="text-gray-500 text-md">${totalListings} listed</div>
                </td>`;
        }

        // ── Quality attribute indicators ─────────────────────────────────────
        const isMastercrafted = !!listing.is_mastercrafted;
        const enchantTier = listing.enchantment_tier || 0;
        const enchantRomanMap = { 1: 'I', 2: 'II', 3: 'III' };
        const enchantLabel = enchantRomanMap[enchantTier] || null;
        const iconPath = itemData?.iconPath || null;

        // Icon block (with superimposed overlays when quality attributes are set)
        let iconHtml = '';
        if (iconPath) {
            const imgEnchantClass = enchantTier > 0 ? ` listing-icon-enchant-${enchantTier}` : '';
            const crownOverlay = isMastercrafted
                ? `<i class="fas fa-crown listing-icon-crown-overlay" title="Mastercrafted"></i>`
                : '';
            const romanOverlay = enchantLabel
                ? `<span class="listing-icon-roman-overlay">${enchantLabel}</span>`
                : '';
            iconHtml = `<div class="listing-item-icon">
                <img src="${iconPath}" alt="" loading="lazy" class="listing-item-icon-img${imgEnchantClass}" onerror="this.closest('.listing-item-icon').style.display='none'">
                ${crownOverlay}${romanOverlay}
            </div>`;
        }

        // Fallback text badges (shown only when there is no icon image)
        const crownBadge = isMastercrafted && !iconPath
            ? `<span class="listing-crown" title="Mastercrafted"><i class="fas fa-crown" style="color:#f59e0b;font-size:0.75em;margin-right:3px;"></i></span>`
            : '';
        const enchantBadge = enchantLabel && !iconPath
            ? `<span class="listing-enchant-badge listing-enchant-tier-${enchantTier}" title="Enchantment ${enchantLabel}">${enchantLabel}</span>`
            : '';
        // Cell left-border glow (used whether or not there is an icon)
        const enchantCellClass = enchantTier > 0 ? ` listing-enchant-glow-${enchantTier}` : '';
        // ─────────────────────────────────────────────────────────────────────

        const row = document.createElement('tr');
        row.dataset.listingId = listing.listing_id;
        row.innerHTML = `
            <td class="py-3 px-6 text-center w-1">
                <input type="checkbox" 
                       data-listing-id="${listing.listing_id}" 
                       class="listing-select-checkbox form-checkbox h-4 w-4 text-indigo-600 rounded">
            </td>
            <td class="py-3 px-6 text-left${enchantCellClass}">
                <div class="listing-item-cell">
                    ${iconHtml}
                    <span class="listing-item-name">${crownBadge}<a href="${paxDeiUrl}" ${linkTarget} class="${linkClasses}">${listing.item_name || 'N/A'}</a>${enchantBadge}</span>
                </div>
            </td>
            <td class="py-3 px-6 text-left">${listing.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.quantity_listed || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${(parseFloat(listing.listed_price_per_unit) || 0).toFixed(2)}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.total_listed_price || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.market_fee || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${new Date(listing.listing_date).toISOString().substring(0, 10)}</td>

            <td class="py-3 px-6 text-left">
                <div class="flex gap-2 whitespace-nowrap">
                    ${!listing.is_cancelled && !listing.is_fully_sold ? `
                        <button class="edit-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Edit</button>
                        <button class="sold-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Sold</button>
                        <button class="cancel-btn bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Cancel</button>
                    ` : ''}
                </div>
            </td>
        `;
        targetBody.appendChild(row);
    });
};

export const renderListingsPagination = (totalCount, marketStallId) => {
    if (!listingsPaginationContainer) return;
    const totalPages = Math.ceil(totalCount / LISTINGS_PER_PAGE);
    listingsPaginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const MAX_VISIBLE_PAGES = 7;
    const halfVisiblePages = Math.floor(MAX_VISIBLE_PAGES / 2);

    const createButton = (text, page, disabled = false, isCurrent = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        let classes = 'px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ';
        if (disabled) {
            classes += 'bg-gray-700 text-gray-500 cursor-not-allowed';
        } else if (isCurrent) {
            classes += 'bg-yellow-500 text-gray-900';
        } else {
            classes += 'bg-blue-500 hover:bg-blue-700 text-white';
        }
        button.className = classes;
        button.disabled = disabled;
        if (!disabled) {
            button.addEventListener('click', () => {
                setCurrentListingsPage(page, marketStallId);
                if (typeof window._pdaLoadListings === 'function') window._pdaLoadListings(marketStallId);
            });
        }
        return button;
    };

    const currentPage = getCurrentListingsPage(marketStallId);

    listingsPaginationContainer.appendChild(createButton('Previous', currentPage - 1, currentPage === 1));

    let startPage = Math.max(1, currentPage - halfVisiblePages);
    let endPage = Math.min(totalPages, currentPage + halfVisiblePages);

    if (endPage - startPage + 1 < MAX_VISIBLE_PAGES) {
        if (currentPage <= halfVisiblePages) {
            endPage = Math.min(totalPages, MAX_VISIBLE_PAGES);
            startPage = 1;
        } else if (currentPage > totalPages - halfVisiblePages) {
            startPage = Math.max(1, totalPages - MAX_VISIBLE_PAGES + 1);
            endPage = totalPages;
        }
    }

    if (startPage > 1) {
        listingsPaginationContainer.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            listingsPaginationContainer.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        listingsPaginationContainer.appendChild(createButton(i, i, false, i === currentPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            listingsPaginationContainer.appendChild(ellipsis);
        }
        listingsPaginationContainer.appendChild(createButton(totalPages, totalPages));
    }

    listingsPaginationContainer.appendChild(createButton('Next', currentPage + 1, currentPage === totalPages));
};