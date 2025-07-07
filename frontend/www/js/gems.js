document.addEventListener('DOMContentLoaded', () => {
    const gemsListContainer = document.getElementById('gems-list');
    const filtersContainer = document.getElementById('gem-filters');
    let allGems = [];
    let activeFilters = new Set();

    async function loadGems() {
        try {
            const response = await fetch('backend/data/gems.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const gems = await response.json();
            allGems = gems;
            createFilters(gems);
            displayGems(gems);
        } catch (error) {
            console.error("Could not load gems:", error);
            gemsListContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load gem data. Please try again later.</p>';
        }
    }

    function createFilters(gems) {
        const sources = new Set();
        gems.forEach(gem => {
            gem.found_in.forEach(src => sources.add(src));
        });

        const sortedSources = Array.from(sources).sort();
        filtersContainer.innerHTML = '';

        // Add source filter buttons
        sortedSources.forEach(source => {
            const btn = document.createElement('button');
            btn.className = 'bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 transition text-sm';
            btn.textContent = source;
            btn.dataset.source = source;

            btn.addEventListener('click', () => {
                if (activeFilters.has(source)) {
                    activeFilters.delete(source);
                    btn.classList.remove('bg-blue-600');
                } else {
                    activeFilters.add(source);
                    btn.classList.add('bg-blue-600');
                }
                filterAndDisplayGems();
            });

            filtersContainer.appendChild(btn);
        });

        // Add "Clear Filters" button at the end
        const clearBtn = document.createElement('button');
        clearBtn.className = 'bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500 transition text-sm';
        clearBtn.textContent = 'Clear Filters';
        clearBtn.addEventListener('click', () => {
            activeFilters.clear();
            // Remove highlight from all filter buttons
            document.querySelectorAll('#gem-filters button[data-source]').forEach(btn => {
                btn.classList.remove('bg-blue-600');
            });
            displayGems(allGems);
        });
        filtersContainer.appendChild(clearBtn);
    }

    function filterAndDisplayGems() {
        if (activeFilters.size === 0) {
            displayGems(allGems);
            return;
        }

        const filtered = allGems.filter(gem =>
            gem.found_in.some(source => activeFilters.has(source))
        );
        displayGems(filtered);
    }

    function displayGems(gems) {
        gemsListContainer.innerHTML = '';
        if (gems.length === 0) {
            gemsListContainer.innerHTML = '<p class="text-gray-400 text-center w-full col-span-full">No gems match the selected filters.</p>';
            return;
        }

        gems.forEach(gem => {
            const gemCard = document.createElement('div');
            gemCard.className = 'gem-card bg-gray-800 rounded-lg p-4 text-center flex flex-col items-center';

            gemCard.innerHTML = `
                <img src="${gem.imageUrl}" alt="${gem.name}" class="w-24 h-24 rounded-full object-cover mb-2" onerror="this.onerror=null;this.src='https://placehold.co/96x96/000000/FFFFFF?text=No+Image';">
                <h3 class="text-xl font-semibold text-white">${gem.name}</h3>
                <p class="text-gray-400 text-sm mt-2">Found in:</p>
                <p class="text-gray-400 text-sm">${gem.found_in.join('<br>')}</p>
            `;

            gemsListContainer.appendChild(gemCard);
        });
    }

    loadGems();
});
