import { supabase } from './supabaseClient.js';

// Exported for use in other modules, like main.js for search
export function normalizeAbilityNameForHash(name) {
    let normalized = name.toLowerCase();
    if (normalized.includes('/')) {
        normalized = normalized.split('/')[0].trim();
    }
    if (normalized.includes('(')) {
        normalized = normalized.split('(')[0].trim();
    }
    normalized = normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_');
    return normalized;
}

// New function to fetch abilities specifically for search, with optional term
export async function fetchAbilitiesForSearch(searchTerm = '') {
    if (!supabase) {
        console.error('Supabase client not initialized in abilities.js.');
        return [];
    }

    let query = supabase.from('abilities').select('*');

    if (searchTerm) {
        // Search by name (case-insensitive) or description (case-insensitive)
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching abilities for search:', error.message);
        return [];
    }
    return data;
}


function createAbilitySection(title, abilities, targetElementId) {
    const container = document.getElementById(targetElementId);
    if (!container) {
        return;
    }

    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'armor-type-section';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'armor-type-header';
    headerDiv.innerHTML = `
        <h3>${title}</h3>
        <span class="collapse-icon">▼</span>
    `;
    sectionDiv.appendChild(headerDiv);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'armor-cards-container';

    abilities.forEach(ability => {
        const card = document.createElement('div');
        card.className = 'ability-card';
        card.dataset.abilityNameNormalized = normalizeAbilityNameForHash(ability.name);
        card.innerHTML = `
            <img src="${ability.image_url}" alt="${ability.name} image" class="ability-image">
            <div class="ability-name">${ability.name}</div>
        `;
        card.addEventListener('click', () => showPopup(ability));
        cardsContainer.appendChild(card);
    });

    sectionDiv.appendChild(cardsContainer);
    container.appendChild(sectionDiv);

    headerDiv.addEventListener('click', () => {
        headerDiv.classList.toggle('expanded');
        cardsContainer.classList.toggle('expanded');
    });
}

function showPopup(ability) {
    let popupOverlay = document.getElementById('ability-popup-overlay');
    if (!popupOverlay) {
        popupOverlay = document.createElement('div');
        popupOverlay.id = 'ability-popup-overlay';
        popupOverlay.className = 'popup-overlay';
        document.body.appendChild(popupOverlay);
    }

    const renderedDescription = marked.parse(ability.description);
    const abilityHash = normalizeAbilityNameForHash(ability.name);
    const itemLink = `${window.location.origin}${window.location.pathname}#${abilityHash}`;

    popupOverlay.innerHTML = `
        <div class="popup-content">
            <button class="popup-close">&times;</button>
            <h2 class="popup-title">${ability.name}</h2>
            <img src="${ability.image_url}" alt="${ability.name} icon" class="w-24 h-24 mx-auto mb-4 rounded-lg object-contain bg-gray-800 p-2">
            <p class="popup-description">${renderedDescription}</p>
            <div class="flex flex-col items-center mt-6">
                <button id="copy-ability-link" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200">
                    Copy Link to Ability
                </button>
                <span id="copy-feedback" class="mt-2 text-sm text-green-400 opacity-0 transition-opacity duration-300">Copied!</span>
            </div>
        </div>
    `;

    popupOverlay.classList.add('show');

    popupOverlay.querySelector('.popup-close').addEventListener('click', hidePopup);
    popupOverlay.addEventListener('click', (event) => {
        if (event.target === popupOverlay) {
            hidePopup();
        }
    });

    const copyButton = document.getElementById('copy-ability-link');
    const feedbackSpan = document.getElementById('copy-feedback');

    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(itemLink);
            feedbackSpan.style.opacity = '1';
            setTimeout(() => {
                feedbackSpan.style.opacity = '0';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy link: ', err);
            alert('Failed to copy link. Please copy it manually: ' + itemLink);
        }
    });
}

function hidePopup() {
    const popupOverlay = document.getElementById('ability-popup-overlay');
    if (popupOverlay) {
        popupOverlay.classList.remove('show');
    }
}

// Renamed from fetchAndRenderAbilities to avoid confusion and allow separate search fetching
// This function will still be used by abilities.js itself for its dedicated page
export async function fetchAllAbilities() { // Renamed and exported
    if (!supabase) {
        console.error('Supabase client not initialized. Ensure supabaseClient.js is loaded correctly and exports supabase.');
        return null;
    }

    const { data, error } = await supabase
        .from('abilities')
        .select('*');

    if (error) {
        console.error('Error fetching abilities:', error.message);
        return null;
    }
    return data;
}

// This function remains internal to abilities.js for rendering its page
export async function fetchAndRenderAbilities() { // Re-added to maintain existing functionality
    const data = await fetchAllAbilities();
    if (!data) return;

    const armorAbilitiesGrouped = {};
    const weaponAbilitiesGrouped = {};

    const armorTypesOrder = ['Heavy Helm', 'Heavy Torso', 'Heavy Greaves', 'Heavy Boots',
                             'Medium Helm', 'Medium Chest', 'Medium Pants', 'Medium Boots',
                             'Light Cap', 'Light Tunic', 'Light Pants', 'Light Shoes'];

    const weaponTypesOrder = ['Mace', 'Great Maul', 'Great Axe', 'Sword', 'Greatsword',
                              'Handspear', 'Polearm', 'Staff of Zephyr (Cleric Staff)',
                              'Staff of Divine (Cleric Staff)', 'Sylvan Staff'];

    data.forEach(ability => {
        if (armorTypesOrder.includes(ability.type)) {
            if (!armorAbilitiesGrouped[ability.type]) {
                armorAbilitiesGrouped[ability.type] = [];
            }
            armorAbilitiesGrouped[ability.type].push(ability);
        } else if (weaponTypesOrder.includes(ability.type)) {
            if (!weaponAbilitiesGrouped[ability.type]) {
                weaponAbilitiesGrouped[ability.type] = [];
            }
            weaponAbilitiesGrouped[ability.type].push(ability);
        }
    });

    const armorAbilitiesContainer = document.getElementById('armor-abilities');
    if (armorAbilitiesContainer) {
        const existingSections = armorAbilitiesContainer.querySelectorAll('.armor-type-section');
        existingSections.forEach(section => section.remove());

        for (const armorType of armorTypesOrder) {
            const abilities = armorAbilitiesGrouped[armorType];
            if (abilities) {
                createAbilitySection(armorType, abilities, 'armor-abilities');
            }
        }
    }

    const weaponAbilitiesContainer = document.getElementById('weapon-abilities');
    if (weaponAbilitiesContainer) {
        const weaponAbilitiesPlaceholder = weaponAbilitiesContainer.querySelector('p');
        if (weaponAbilitiesPlaceholder && Object.keys(weaponAbilitiesGrouped).length > 0) {
            weaponAbilitiesPlaceholder.remove();
        }

        for (const weaponType of weaponTypesOrder) {
            const abilities = weaponAbilitiesGrouped[weaponType];
            if (abilities) {
                createAbilitySection(weaponType, abilities, 'weapon-abilities');
            }
        }
    }

    return data; // Return data for handleUrlHash
}

async function handleUrlHash() {
    // Use the specific render function for the abilities page
    const allAbilities = await fetchAndRenderAbilities();

    if (!allAbilities) {
        return;
    }

    const hash = window.location.hash.substring(1);

    if (hash) {
        const targetAbilityNameNormalized = hash;

        const abilityToOpen = allAbilities.find(ability =>
            normalizeAbilityNameForHash(ability.name) === targetAbilityNameNormalized
        );

        if (abilityToOpen) {
            const foundCard = document.querySelector(`.ability-card[data-ability-name-normalized="${targetAbilityNameNormalized}"]`);

            if (foundCard) {
                const sectionContainer = foundCard.closest('.armor-cards-container');
                const sectionHeader = sectionContainer ? sectionContainer.previousElementSibling : null;

                if (sectionHeader && sectionContainer) {
                    sectionHeader.classList.add('expanded');
                    sectionContainer.classList.add('expanded');
                    sectionHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                showPopup(abilityToOpen);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', handleUrlHash);