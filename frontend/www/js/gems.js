document.addEventListener('DOMContentLoaded', async () => {
    const gemsListContainer = document.getElementById('gems-list');
    const filtersContainer = document.getElementById('gem-filters');
    const gemPopupOverlay = document.getElementById('gem-popup-overlay'); // Corrected ID to match HTML

    const GITHUB_PAGES_BASE_URL = "https://yesitsphoenix.github.io/Pax-Dei-Archives";

    if (!gemsListContainer || !filtersContainer || !gemPopupOverlay) {
        // Updated error message to reflect the correct ID being searched
        console.error('Required containers (gems-list, gem-filters, or gem-popup-overlay) not found!');
        return;
    }

    let allGems = [];
    const groupedGems = {};
    const allSources = new Set();
    let activeFilters = new Set(); // Added to track active source filters

    try {
        const response = await fetch('backend/data/gems.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allGems = await response.json();
    } catch (error) {
        console.error("Could not load gems:", error);
        gemsListContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load gem data. Please try again later.</p>';
        return;
    }

    allGems.forEach(gem => {
        const gemName = gem.name;
        if (!groupedGems[gemName]) {
            groupedGems[gemName] = {
                name: gem.name,
                description: gem.description,
                imageUrl: gem.imageUrl,
                found_in: new Set()
            };
        }
        gem.found_in.forEach(source => {
            groupedGems[gemName].found_in.add(source);
            allSources.add(source);
        });
    });

    const sortedGemNames = Object.keys(groupedGems).sort((a, b) => a.localeCompare(b));

    const renderFilters = () => {
        const sortedSources = Array.from(allSources).sort();
        filtersContainer.innerHTML = `
            <div class="mb-6 flex flex-wrap gap-2 justify-center items-center">
                ${sortedSources.map(source => `
                    <button class="source-filter-btn bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition text-sm ${activeFilters.has(source) ? 'active-filter' : ''}" data-source="${source}">
                        ${source}
                    </button>
                `).join('')}
                <button id="clear-filters-btn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                    Clear Filters
                </button>
            </div>
        `;

        document.querySelectorAll('.source-filter-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const source = event.target.dataset.source;
                if (activeFilters.has(source)) {
                    activeFilters.delete(source);
                    event.target.classList.remove('active-filter');
                } else {
                    activeFilters.add(source);
                    event.target.classList.add('active-filter');
                }
                applyFilters();
            });
        });

        document.getElementById('clear-filters-btn').addEventListener('click', () => {
            activeFilters.clear();
            document.querySelectorAll('.source-filter-btn').forEach(button => {
                button.classList.remove('active-filter');
            });
            applyFilters();
        });
    };

    // Initial render of filters
    renderFilters();

    const applyFilters = () => {
        document.querySelectorAll('.gem-card').forEach(card => {
            const cardSources = card.dataset.sources ? card.dataset.sources.split(',') : [];
            
            // If no filters are active, show all cards
            if (activeFilters.size === 0) {
                card.classList.remove('hidden');
                return;
            }

            // AND logic: Check if ALL active filters are present in the card's sources
            const matchesFilter = [...activeFilters].every(filterSource => cardSources.includes(filterSource));

            if (matchesFilter) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    };

    const showPopup = (gemData, gemId) => {
        const foundInArray = Array.from(gemData.found_in).sort();
        
        const slug = gemId.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
        const currentUrl = `${GITHUB_PAGES_BASE_URL}/gems/${slug}.html`;

        gemPopupOverlay.innerHTML = `
            <div class="popup-content">
                <button class="popup-close">&times;</button>
                <h3 class="popup-title">${gemData.name}</h3>
                <div class="text-center mb-4">
                    <img src="${gemData.imageUrl}" alt="${gemData.name} icon" class="w-24 h-24 mx-auto rounded-md border-2 border-yellow-500 object-cover mb-2" onerror="this.onerror=null;this.src='https://placehold.co/96x96/000000/FFFFFF?text=No+Image';">
                </div>
                <div class="popup-description text-gray-300 mb-4 overflow-y-auto max-h-48 custom-scrollbar-styling"></div>
                <div class="applies-to w-full text-center mb-4">
                    <p class="text-gray-400 text-sm font-semibold mb-1">Found In:</p>
                    <div class="flex flex-wrap justify-center gap-1">
                        ${foundInArray.map(source => `<span class="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">${source}</span>`).join('')}
                    </div>
                </div>

            </div>
        `;
        gemPopupOverlay.classList.add('show');

        document.querySelector('.popup-close').addEventListener('click', hidePopup);
        gemPopupOverlay.addEventListener('click', (e) => {
            if (e.target === gemPopupOverlay) {
                hidePopup();
            }
        });

        document.getElementById('copy-link-button').addEventListener('click', () => {
            navigator.clipboard.writeText(currentUrl).then(() => {
                const originalText = document.getElementById('copy-link-button').textContent;
                document.getElementById('copy-link-button').textContent = 'Copied!';
                setTimeout(() => {
                    document.getElementById('copy-link-button').textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    };

    const hidePopup = () => {
        gemPopupOverlay.classList.remove('show');
        gemPopupOverlay.innerHTML = '';
    };

    gemsListContainer.innerHTML = '';

    sortedGemNames.forEach(gemName => {
        const gemData = groupedGems[gemName];
        const foundInArray = Array.from(gemData.found_in).sort();
        
        const gemId = gemName.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');

        const gemCard = document.createElement('div');
        gemCard.className = 'gem-card bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 flex flex-col items-center text-center';
        gemCard.dataset.sources = foundInArray.join(',');
        gemCard.id = gemId;

        gemCard.innerHTML = `
            <img src="${gemData.imageUrl}" alt="${gemName} icon" class="w-16 h-16 mb-3 rounded-md border-2 border-yellow-500 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/64x64/000000/FFFFFF?text=No+Image';">
            <h3 class="text-lg font-bold text-yellow-400 mb-2">${gemName}</h3>

                <p class="text-gray-400 text-xs font-semibold mb-1">Found In:</p>
                <div class="flex flex-wrap justify-center gap-1">
                    ${foundInArray.map(source => `<span class="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">${source}</span>`).join('')}
                </div>
            </div>
        `;
        gemsListContainer.appendChild(gemCard);

        gemCard.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' || event.target.closest('a')) {
                return;
            }
            showPopup(gemData, gemId);
        });
    });

    applyFilters();

    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const foundGemName = Object.keys(groupedGems).find(name => 
                name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '') === targetId
            );
            if (foundGemName) {
                setTimeout(() => {
                    showPopup(groupedGems[foundGemName], targetId);
                }, 500);
            }
        }
    }
});