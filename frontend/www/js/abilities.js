document.addEventListener('DOMContentLoaded', async () => {
    const abilitiesListContainer = document.getElementById('abilities-list');
    const abilityFilterContainer = document.getElementById('ability-filters');
    const abilityPopupOverlay = document.getElementById('ability-popup-overlay');

    const GITHUB_PAGES_BASE_URL = "https://yesitsphoenix.github.io/Pax-Dei-Archives";

    if (!abilitiesListContainer || !abilityFilterContainer || !abilityPopupOverlay) {
        console.error('Required containers (abilities-list, ability-filters, or ability-popup-overlay) not found!');
        return;
    }

    let abilities = [];
    try {
        const response = await fetch('backend/data/abilities.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        abilities = await response.json();
    } catch (error) {
        console.error('Error fetching abilities:', error.message);
        abilitiesListContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load abilities. Please try again later.</p>`;
        return;
    }

    if (!abilities || abilities.length === 0) {
        abilitiesListContainer.innerHTML = `<p class="text-white text-center">No abilities found.</p>`;
        return;
    }

    const groupedAbilities = {};
    const allArmorTypes = new Set();
    const allWeaponTypes = new Set();

    abilities.forEach(ability => {
        const abilityName = ability.name;
        if (!groupedAbilities[abilityName]) {
            groupedAbilities[abilityName] = {
                name: ability.name,
                description: ability.description,
                image_url: ability.image_url,
                applies_to: new Set(),
                armor_type: ability.armor_type,
                weapon_type: ability.weapon_type
            };
        }
        groupedAbilities[abilityName].applies_to.add(ability.type);

        if (ability.armor_type) allArmorTypes.add(ability.armor_type);
        if (ability.weapon_type) allWeaponTypes.add(ability.weapon_type);
    });

    const sortedAbilityNames = Object.keys(groupedAbilities).sort((a, b) => a.localeCompare(b));

    const renderFilters = () => {
        let armorFilterOptions = Array.from(allArmorTypes).sort().map(type => `<option value="${type}">${type}</option>`).join('');
        let weaponFilterOptions = Array.from(allWeaponTypes).sort().map(type => `<option value="${type}">${type}</option>`).join('');

        abilityFilterContainer.innerHTML = `
            <div class="mb-6 flex flex-col md:flex-row gap-4 justify-center items-center">
                <select id="armor-type-filter" class="bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring focus:ring-yellow-500 focus:border-yellow-500">
                    <option value="">All Armor Types</option>
                    ${armorFilterOptions}
                </select>
                <select id="weapon-type-filter" class="bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring focus:ring-yellow-500 focus:border-yellow-500">
                    <option value="">All Weapon Types</option>
                    ${weaponFilterOptions}
                </select>
                <button id="clear-filters-btn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                    Clear Filters
                </button>
            </div>
        `;

        const armorFilter = document.getElementById('armor-type-filter');
        const weaponFilter = document.getElementById('weapon-type-filter');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');

            const applyFilters = () => {
            const selectedArmor = armorFilter.value;
            const selectedWeapon = weaponFilter.value;

            document.querySelectorAll('.ability-card').forEach(card => {
                const abilityName = card.querySelector('h3').textContent;
                const abilityData = groupedAbilities[abilityName];

                const matchesArmor = selectedArmor === '' || (abilityData.applies_to && Array.from(abilityData.applies_to).includes(selectedArmor));
                const matchesWeapon = selectedWeapon === '' || (abilityData.applies_to && Array.from(abilityData.applies_to).includes(selectedWeapon));

                if (matchesArmor && matchesWeapon) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        };

        armorFilter.addEventListener('change', () => {
            if (armorFilter.value !== '') {
                weaponFilter.value = '';
            }
            applyFilters();
        });

        weaponFilter.addEventListener('change', () => {
            if (weaponFilter.value !== '') {
                armorFilter.value = '';
            }
            applyFilters();
        });

        clearFiltersBtn.addEventListener('click', () => {
            armorFilter.value = '';
            weaponFilter.value = '';
            applyFilters();
        });
    };

    renderFilters();

    const showPopup = (abilityData, abilityId) => {
        const parsedDescription = marked.parse(abilityData.description);
        const appliesToArray = Array.from(abilityData.applies_to).sort();
        
        const slug = abilityId.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
        const currentUrl = `${GITHUB_PAGES_BASE_URL}/abilities/${slug}.html`;

        abilityPopupOverlay.innerHTML = `
            <div class="popup-content">
                <button class="popup-close">&times;</button>
                <h3 class="popup-title">${abilityData.name}</h3>
                <div class="text-center mb-4">
                    <img src="${abilityData.image_url}" alt="${abilityData.name} icon" class="w-24 h-24 mx-auto rounded-md border-2 border-yellow-500 object-cover mb-2">
                </div>
                <div class="popup-description text-gray-300 mb-4 overflow-y-auto max-h-48 custom-scrollbar-styling">${parsedDescription}</div>
                <div class="applies-to w-full text-center mb-4">
                    <p class="text-gray-400 text-sm font-semibold mb-1">Applies to:</p>
                    <div class="flex flex-wrap justify-center gap-1">
                        ${appliesToArray.map(type => `<span class="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">${type}</span>`).join('')}
                    </div>
                </div>
                <div class="flex justify-center mt-4">
                    <button id="copy-link-button" class="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded transition duration-200">
                        Copy Link
                    </button>
                </div>
            </div>
        `;
        abilityPopupOverlay.classList.add('show');

        document.querySelector('.popup-close').addEventListener('click', hidePopup);
        abilityPopupOverlay.addEventListener('click', (e) => {
            if (e.target === abilityPopupOverlay) {
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
        abilityPopupOverlay.classList.remove('show');
        abilityPopupOverlay.innerHTML = '';
    };

    abilitiesListContainer.innerHTML = '';

    sortedAbilityNames.forEach(abilityName => {
        const abilityData = groupedAbilities[abilityName];
        const appliesToArray = Array.from(abilityData.applies_to).sort();
        
        const abilityId = abilityName.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');

        const abilityCard = document.createElement('div');
        abilityCard.className = 'ability-card bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 flex flex-col items-center text-center';
        abilityCard.dataset.armorType = abilityData.armor_type || '';
        abilityCard.dataset.weaponType = abilityData.weapon_type || '';
        abilityCard.id = abilityId;

        abilityCard.innerHTML = `
            <img src="${abilityData.image_url}" alt="${abilityName} icon" class="w-16 h-16 mb-3 rounded-md border-2 border-yellow-500 object-cover">
            <h3 class="text-lg font-bold text-yellow-400 mb-2">${abilityName}</h3>

                <p class="text-gray-400 text-xs font-semibold mb-1">Applies to:</p>
                <div class="flex flex-wrap justify-center gap-1">
                    ${appliesToArray.map(type => `<span class="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">${type}</span>`).join('')}
                </div>
            </div>
        `;
        abilitiesListContainer.appendChild(abilityCard);

        abilityCard.addEventListener('click', (event) => {
            if (event.target.tagName === 'A' || event.target.closest('a')) {
                return;
            }
            showPopup(abilityData, abilityId);
        });
    });

    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const foundAbilityName = Object.keys(groupedAbilities).find(name => 
                name.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '') === targetId
            );
            if (foundAbilityName) {
                setTimeout(() => {
                    showPopup(groupedAbilities[foundAbilityName], targetId);
                }, 500);
            }
        }
    }
});