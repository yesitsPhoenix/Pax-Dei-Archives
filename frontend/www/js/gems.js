document.addEventListener('DOMContentLoaded', () => {
    const gemsListContainer = document.getElementById('gems-list');

    async function loadGems() {
        try {
            const response = await fetch('backend/data/gems.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const gems = await response.json();
            displayGems(gems);
        } catch (error) {
            console.error("Could not load gems:", error);
            gemsListContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load gem data. Please try again later.</p>';
        }
    }

    function displayGems(gems) {
        gemsListContainer.innerHTML = '';
        gems.forEach(gem => {
            const gemCard = document.createElement('div');
            gemCard.className = 'gem-card bg-gray-800 rounded-lg p-4 text-center flex flex-col items-center';

            const imageUrl = gem.imageUrl;

            gemCard.innerHTML = `
                <img src="${imageUrl}" alt="${gem.name}" class="w-24 h-24 rounded-full object-cover mb-2" onerror="this.onerror=null;this.src='https://placehold.co/96x96/000000/FFFFFF?text=No+Image';">
                <h3 class="text-xl font-semibold text-white">${gem.name}</h3>
                <p class="text-gray-400 text-sm mt-2">Found in:</p>
                <p class="text-gray-400 text-sm">${gem.found_in.join('<br>')}</p>
            `;
            gemsListContainer.appendChild(gemCard);
        });
    }

    loadGems();
});
