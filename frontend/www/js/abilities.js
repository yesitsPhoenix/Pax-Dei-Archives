import { supabase } from './supabaseClient.js';

const ABILITIES_CACHE_KEY = 'paxDeiAbilities';
const ABILITIES_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
    const cachedData = localStorage.getItem(ABILITIES_CACHE_KEY);

    if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < ABILITIES_CACHE_EXPIRY_MS) {
            abilities = data;
        } else {
            localStorage.removeItem(ABILITIES_CACHE_KEY);
        }
    }

    if (abilities.length === 0) {
        const { data, error } = await supabase
            .from('abilities')
            .select('*');

        if (error) {
            console.error('Error fetching abilities:', error.message);
            abilitiesListContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load abilities. Please try again later.</p>`;
            return;
        }

        abilities = data || [];
        if (abilities.length > 0) {
            localStorage.setItem(ABILITIES_CACHE_KEY, JSON.stringify({ data: abilities, timestamp: Date.now() }));
        }
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
                icon_url: ability.icon_url,
                applies_to: { armor: new Set(), weapon: new Set(), category: new Set() },
                min_tier: ability.min_tier || 100,
                max_tier: ability.max_tier || 0
            };
        }
        if (ability.applies_to_armor) {
            groupedAbilities[abilityName].applies_to.armor.add(ability.applies_to_armor);
            allArmorTypes.add(ability.applies_to_armor);
        }
        if (ability.applies_to_weapon) {
            groupedAbilities[abilityName].applies_to.weapon.add(ability.applies_to_weapon);
            allWeaponTypes.add(ability.applies_to_weapon);
        }
        if (ability.category) {
            groupedAbilities[abilityName].applies_to.category.add(ability.category);
        }
        groupedAbilities[abilityName].min_tier = Math.min(groupedAbilities[abilityName].min_tier, ability.tier);
        groupedAbilities[abilityName].max_tier = Math.max(groupedAbilities[abilityName].max_tier, ability.tier);
    });

    const renderAbilities = (filteredAbilities) => {
        abilitiesListContainer.innerHTML = '';
        if (Object.keys(filteredAbilities).length === 0) {
            abilitiesListContainer.innerHTML = '<p class="text-gray-400 text-center mt-5">No abilities match your criteria.</p>';
            return;
        }

        Object.keys(filteredAbilities).sort().forEach(abilityName => {
            const abilityData = filteredAbilities[abilityName];
            const appliesToArray = [
                ...Array.from(abilityData.applies_to.category).sort(),
                ...Array.from(abilityData.applies_to.armor).sort(),
                ...Array.from(abilityData.applies_to.weapon).sort()
            ];

            const abilityId = abilityName.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
            const abilityCard = document.createElement('div');
            abilityCard.id = abilityId;
            abilityCard.className = `
                bg-gray-800 rounded-lg p-5 flex flex-col items-center justify-between text-center 
                shadow-lg hover:shadow-xl transition-shadow duration-300 transform hover:-translate-y-1 
                w-full sm:w-64 md:w-72 lg:w-80 h-auto cursor-pointer border border-transparent hover:border-yellow-600
            `;
            abilityCard.innerHTML = `
                <img src="${abilityData.icon_url || 'https://placehold.co/64x64/333333/FFFFFF?text=Icon'}" alt="${abilityData.name} icon" class="w-16 h-16 mb-3 rounded-md border-2 border-yellow-500 object-cover">
                <h3 class="text-lg font-bold text-yellow-400 mb-2">${abilityName}</h3>
                <p class="text-gray-400 text-xs font-semibold mb-1">Applies to:</p>
                <div class="flex flex-wrap justify-center gap-1">
                    ${appliesToArray.map(type => `<span class="bg-gray-700 text-gray-200 px-3 py-1 rounded-full text-xs whitespace-nowrap">${type}</span>`).join('')}
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
    };

    const showPopup = (abilityData, abilityId) => {
        const popupTitle = document.getElementById('abilityModalTitle');
        const popupIcon = document.getElementById('abilityModalIcon');
        const popupDescription = document.getElementById('abilityModalDescription');
        const popupAppliesTo = document.getElementById('abilityModalAppliesTo');
        const popupTierRange = document.getElementById('abilityModalTierRange');
        const shareLinkInput = document.getElementById('shareLinkInput');
        const copyShareLinkButton = document.getElementById('copyShareLinkButton');

        if (!popupTitle || !popupIcon || !popupDescription || !popupAppliesTo || !popupTierRange || !shareLinkInput || !copyShareLinkButton) {
            console.error('One or more popup elements not found!');
            return;
        }

        popupTitle.textContent = abilityData.name;
        popupIcon.src = abilityData.icon_url || 'https://placehold.co/64x64/333333/FFFFFF?text=Icon';
        popupIcon.alt = `${abilityData.name} icon`;
        popupDescription.innerHTML = abilityData.description;

        const appliesToHtml = [];
        if (abilityData.applies_to.category.size > 0) {
            appliesToHtml.push(`<strong>Categories:</strong> ${Array.from(abilityData.applies_to.category).sort().join(', ')}`);
        }
        if (abilityData.applies_to.armor.size > 0) {
            appliesToHtml.push(`<strong>Armor:</strong> ${Array.from(abilityData.applies_to.armor).sort().join(', ')}`);
        }
        if (abilityData.applies_to.weapon.size > 0) {
            appliesToHtml.push(`<strong>Weapons:</strong> ${Array.from(abilityData.applies_to.weapon).sort().join(', ')}`);
        }
        popupAppliesTo.innerHTML = appliesToHtml.join('<br>');

        if (abilityData.min_tier <= abilityData.max_tier) {
            popupTierRange.textContent = `Tier Range: ${abilityData.min_tier} - ${abilityData.max_tier}`;
        } else {
            popupTierRange.textContent = `Tier Range: Not specified`;
        }
        
        const shareableLink = `${GITHUB_PAGES_BASE_URL}/abilities.html#${abilityId}`;
        shareLinkInput.value = shareableLink;

        copyShareLinkButton.onclick = () => {
            shareLinkInput.select();
            document.execCommand('copy');
            alert('Link copied to clipboard!');
        };

        abilityPopupOverlay.classList.add('active');
        document.body.classList.add('modal-open');
    };

    const closePopup = () => {
        abilityPopupOverlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    };

    document.getElementById('closeAbilityModal').addEventListener('click', closePopup);
    abilityPopupOverlay.addEventListener('click', (event) => {
        if (event.target === abilityPopupOverlay) {
            closePopup();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && abilityPopupOverlay.classList.contains('active')) {
            closePopup();
        }
    });

    const allFilters = {
        armor: Array.from(allArmorTypes).sort(),
        weapon: Array.from(allWeaponTypes).sort()
    };

    const currentFilters = {
        armor: [],
        weapon: [],
        search: ''
    };

    const renderFilters = () => {
        abilityFilterContainer.innerHTML = '';

        const renderFilterSection = (title, type, options) => {
            if (options.length === 0) return '';
            return `
                <div class="mb-4">
                    <h4 class="text-md font-semibold text-white mb-2">${title}</h4>
                    <div class="flex flex-wrap gap-2">
                        ${options.map(option => `
                            <button class="filter-button px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200
                                ${currentFilters[type].includes(option) ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                                data-filter-type="${type}" data-filter-value="${option}">
                                ${option}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const armorFilterHtml = renderFilterSection('Filter by Armor', 'armor', allFilters.armor);
        const weaponFilterHtml = renderFilterSection('Filter by Weapon', 'weapon', allFilters.weapon);

        abilityFilterContainer.insertAdjacentHTML('beforeend', armorFilterHtml);
        abilityFilterContainer.insertAdjacentHTML('beforeend', weaponFilterHtml);

        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const type = event.target.dataset.filterType;
                const value = event.target.dataset.filterValue;
                const index = currentFilters[type].indexOf(value);

                if (index > -1) {
                    currentFilters[type].splice(index, 1);
                } else {
                    currentFilters[type].push(value);
                }
                applyFilters();
                renderFilters();
            });
        });
    };

    const applyFilters = () => {
        let filtered = Object.values(groupedAbilities);

        if (currentFilters.armor.length > 0) {
            filtered = filtered.filter(ability =>
                currentFilters.armor.some(filter => ability.applies_to.armor.has(filter))
            );
        }
        if (currentFilters.weapon.length > 0) {
            filtered = filtered.filter(ability =>
                currentFilters.weapon.some(filter => ability.applies_to.weapon.has(filter))
            );
        }
        if (currentFilters.search) {
            const searchTermLower = currentFilters.search.toLowerCase();
            filtered = filtered.filter(ability =>
                ability.name.toLowerCase().includes(searchTermLower) ||
                ability.description.toLowerCase().includes(searchTermLower) ||
                Array.from(ability.applies_to.armor).some(type => type.toLowerCase().includes(searchTermLower)) ||
                Array.from(ability.applies_to.weapon).some(type => type.toLowerCase().includes(searchTermLower)) ||
                Array.from(ability.applies_to.category).some(type => type.toLowerCase().includes(searchTermLower))
            );
        }

        const filteredAsObject = filtered.reduce((acc, ability) => {
            acc[ability.name] = ability;
            return acc;
        }, {});

        renderAbilities(filteredAsObject);
    };

    renderFilters();
    renderAbilities(groupedAbilities);

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
