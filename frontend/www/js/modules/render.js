import {
    listingsBody,
    listingsPaginationContainer,
    LISTINGS_PER_PAGE,
    getCurrentListingsPage,
    setCurrentListingsPage
} from './dom.js';
import {
    loadActiveListings
} from './init.js';

export const renderListingsTable = (listings) => {
    listingsBody.innerHTML = '';
    if (listings.length === 0) {
        listingsBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No listings found for the current filters.</td></tr>';
        return;
    }

    listings.forEach(listing => {
        const paxDeiSlug = listing.pax_dei_slug ||
            (listing.items && listing.items.pax_dei_slug);

        const paxDeiUrl = paxDeiSlug ? `https://paxdei.gaming.tools/${paxDeiSlug}` : '#';

        const isLinkEnabled = !!paxDeiSlug;
        const linkClasses = isLinkEnabled ? 'text-blue-600 hover:underline' : 'text-gray-700 cursor-default';
        const linkTarget = isLinkEnabled ? 'target="_blank"' : '';

        const row = document.createElement('tr');
        row.dataset.listingId = listing.listing_id;
        row.innerHTML = `
            <td class="py-3 px-6 text-center w-1">
                <input type="checkbox" 
                       data-listing-id="${listing.listing_id}" 
                       class="listing-select-checkbox form-checkbox h-4 w-4 text-indigo-600 rounded">
            </td>
            <td class="py-3 px-6 text-left">
                <a href="${paxDeiUrl}" ${linkTarget} class="${linkClasses}">
                    ${listing.item_name || 'N/A'}
                </a>
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
        listingsBody.appendChild(row);
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
                loadActiveListings(marketStallId);
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