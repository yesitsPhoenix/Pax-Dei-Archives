// trader.js
import { supabase } from './supabaseClient.js';
import { initializeListings, loadActiveListings, populateMarketStallDropdown, setupMarketStallTabs, clearMarketStallsCache } from './modules/init.js';
import { initializeCharacters, insertCharacterModalHtml, currentCharacterId, getCurrentCharacter } from './modules/characters.js';
import { initializeSales, loadTransactionHistory } from './modules/sales.js';
import { renderDashboard, renderMarketPulse } from './modules/dashboard.js';
import { renderPVEChart, renderSalesChart } from './modules/salesChart.js';
import {
    loadZoneDataForCharacter,
    clearZoneData,
    getMarketDataForSlug,
    getMarketDataByItemName,
    getItemNameForSlug,
    getOwnListingCountForSlug,
    getItemIdByName,
    findOwnListings,
    summarizeOwnListings,
    getSavedAvatarHash,
    saveAvatarHash,
    clearAvatarHash,
    hashAvatarId
} from './services/gamingToolsService.js';

import {
    showAddListingModalBtn,
    addListingModal,
    closeAddListingModalBtn,
    addListingFormModal,
    modalItemNameInput,
    modalItemCategorySelect,
    modalItemNameSuggestions,
    modalMarketStallLocationSelect,
    getActiveStallId
} from './modules/dom.js';

let currentUser = null;
let allCharacterActivityData = [];
let allItems = [];


const initCustomModal = () => {
    const modalHtml = `
        <div id="customModalContainer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center hidden" style="z-index: 10000;">
            <div id="customModalContentWrapper" class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const customModalContainer = document.getElementById('customModalContainer');
    const customModalContentWrapper = document.getElementById('customModalContentWrapper');

    customModalContainer.addEventListener('click', (event) => {
        if (event.target === customModalContainer) {
            customModalContainer.classList.add('hidden');
            if (window.customModalResolvePromise) {
                window.customModalResolvePromise(false);
                window.customModalResolvePromise = null;
            }
        }
    });

    return { customModalContainer, customModalContentWrapper };
};

export const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        window.customModalResolvePromise = resolve;

        if (!window.customModalElements) {
            window.customModalElements = initCustomModal();
        }

        const { customModalContainer, customModalContentWrapper } = window.customModalElements;

        customModalContentWrapper.innerHTML = '';

        const modalTitle = document.createElement('h3');
        modalTitle.classList.add('text-xl', 'font-bold', 'mb-4', 'text-gray-800');
        modalTitle.textContent = title;
        customModalContentWrapper.appendChild(modalTitle);

        const modalMessage = document.createElement('p');
        modalMessage.classList.add('mb-6', 'text-gray-700');
        modalMessage.innerHTML = message;
        customModalContentWrapper.appendChild(modalMessage);

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('flex', 'justify-end', 'gap-3');
        customModalContentWrapper.appendChild(buttonContainer);

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.text;
            button.classList.add('px-4', 'py-2', 'rounded-full', 'font-bold');

            if (btn.type === 'confirm') {
                button.classList.add('bg-blue-500', 'hover:bg-blue-700', 'text-white');
            } else if (btn.type === 'cancel') {
                button.classList.add('bg-gray-500', 'hover:bg-gray-700', 'text-white');
            } else {
                button.classList.add('bg-gray-300', 'hover:bg-gray-400', 'text-gray-800');
            }

            button.addEventListener('click', () => {
                customModalContainer.classList.add('hidden');
                if (window.customModalResolvePromise) {
                    window.customModalResolvePromise(btn.value);
                    window.customModalResolvePromise = null;
                }
            });
            buttonContainer.appendChild(button);
        });

        customModalContainer.classList.remove('hidden');
    });
};

const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');


async function fetchCharacterActivity(characterId) {
    if (!characterId) return [];

    const { data, error } = await supabase.rpc('get_all_character_activity_json', {
        p_character_id: characterId
    });

    if (error) {
        console.error("Error fetching character activity using RPC:", error);
        return [];
    }
    return data;
}


const processCharacterActivityData = (rawData) => {
    if (!rawData) return [];
    const { sales, purchases, cancellations, listing_fees, pve_transactions } = rawData;
    const allTransactions = [
        ...(sales || []),
        ...(purchases || []),
        ...(cancellations || []),
        ...(listing_fees || []),
        ...(pve_transactions || [])
    ];
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    return allTransactions;
};


const handleUserAuthentication = (user) => {
    const traderLoginContainer = document.getElementById('traderLoginContainer');
    const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');

    const avatarIdCard = document.getElementById('avatar-id-card');
    if (user) {
        currentUser = user;
        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'none';
        }
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'block';
        }
        if (avatarIdCard) {
            avatarIdCard.classList.remove('hidden');
        }
    } else {
        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'block';
        }
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'none';
        }
        if (avatarIdCard) {
            avatarIdCard.classList.add('hidden');
        }
    }
};


const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    handleUserAuthentication(user);

    if (user) {
        insertCharacterModalHtml();
        await initializeCharacters(currentUser.id, async () => {
            await loadTraderPageData();
        });
        initializeListings(currentUser.id);
        initializeSales();
    }
};

export async function fetchAllItemsForDropdown() {
    const { data, error } = await supabase.rpc('get_all_items_for_dropdown');
    if (error) {
        console.error('Error fetching items for dropdowns:', error);
        console.error('Supabase RPC error details:', error.message, error.details, error.hint);
        throw error;
    }
    return data;
}


async function populateItemData() {
    try {
        allItems = await fetchAllItemsForDropdown();
        initializeAutocomplete(allItems);
    } catch (err) {
        console.error('An unexpected error occurred while fetching item data:', err);
    }
}


const updateAllCharts = (timeframe) => {
    if (allCharacterActivityData) {
        renderSalesChart(allCharacterActivityData, timeframe);
        renderPVEChart(allCharacterActivityData, timeframe);
    } else {
        renderSalesChart([], timeframe);
        renderPVEChart([], timeframe);
    }
};


const clearTraderPageUI = () => {
    renderDashboard({}, null, []);
    loadTransactionHistory([]);
    if (document.querySelector('.market-stall-tabs')) {
        document.querySelector('.market-stall-tabs').innerHTML = '<p class="text-gray-600 text-center py-4">Select a character to manage market stalls.</p>';
    }
    if (document.querySelector('.tab-content-container')) {
        document.querySelector('.tab-content-container').innerHTML = '';
    }
};


export const loadTraderPageData = async (reloadActiveListings = true) => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (!currentUser || !currentUser.id || !currentCharacterId) {
        clearTraderPageUI();
        if (reloadActiveListings) {
            const activeStallId = getActiveStallId();
            await loadActiveListings(activeStallId);
        }
        updateAllCharts('daily');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        return;
    }

    try {
        // Show loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        clearMarketStallsCache();
        const [
            dashboardStatsResult,
            currentCharacterData,
            rawActivityData
        ] = await Promise.all([
            supabase.rpc('get_character_dashboard_stats', { p_character_id: currentCharacterId }),
            getCurrentCharacter(true),
            fetchCharacterActivity(currentCharacterId)
        ]);

        if (dashboardStatsResult.error) {
            throw dashboardStatsResult.error;
        }

        allCharacterActivityData = processCharacterActivityData(rawActivityData);

        await renderDashboard(dashboardStatsResult.data ? dashboardStatsResult.data[0] : {}, currentCharacterData, allCharacterActivityData);
        loadTransactionHistory(allCharacterActivityData);
        updateAllCharts('daily');
        if (modalMarketStallLocationSelect) {
            await populateMarketStallDropdown(modalMarketStallLocationSelect);
        }
        await setupMarketStallTabs(); // this calls loadActiveListings(firstStallId) internally

        // ── Gaming.tools market data (non-blocking) ──────────────────────────
        clearZoneData();
        if (currentCharacterData?.shard && currentCharacterData?.province && currentCharacterData?.home_valley) {
            renderMarketPulse(null, null, currentCharacterData, true);
            loadZoneDataForCharacter(currentCharacterData).then(async (result) => {
                if (!result) {
                    renderMarketPulse(null, null, currentCharacterData, false,
                        'Market data unavailable for this zone. The zone may not be tracked yet.');
                    return;
                }
                // Re-render listings now that price map is populated
                const activeStallId = getActiveStallId();
                await loadActiveListings(activeStallId);
                // Own listings via saved avatar hash
                const avatarHash = getSavedAvatarHash();
                const ownListings = avatarHash ? findOwnListings(avatarHash) : null;
                const ownSummary = ownListings ? summarizeOwnListings(ownListings) : null;
                renderMarketPulse(result.zoneSummary, ownSummary, currentCharacterData);
            }).catch((err) => {
                console.warn('[Trader] Gaming.tools data error:', err);
                renderMarketPulse(null, null, currentCharacterData, false,
                    'Could not load market data from gaming.tools.');
            });
        } else {
            renderMarketPulse(null, null, currentCharacterData, false,
                'Character is missing zone data (shard/province/home valley). Update your character profile to enable Market Pulse.');
        }

    } catch (error) {
        console.error('Error loading trader page data:', error.message);
        await showCustomModal('Error', 'Failed to load trader data: ' + error.message, [{ text: 'OK', value: true }]);
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
};


const handleDiscordLogin = async () => {
    let currentPath = window.location.pathname;

    if (!currentPath.includes('/Pax-Dei-Archives')) {
        if (currentPath === '/') {
            currentPath = '/Pax-Dei-Archives/';
        } else {
            currentPath = '/Pax-Dei-Archives' + currentPath;
        }
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            redirectTo: window.location.origin + currentPath
        }
    });
    if (error) {
        console.error('Error logging in with Discord:', error.message);
        if (traderLoginError) {
            traderLoginError.textContent = 'Login failed: ' + error.message;
            traderLoginError.style.display = 'block';
        }
    }
};


const setupChartTimeframeListeners = () => {
    document.getElementById('viewDaily')?.addEventListener('click', () => updateAllCharts('daily'));
    document.getElementById('viewWeekly')?.addEventListener('click', () => updateAllCharts('weekly'));
    document.getElementById('viewMonthly')?.addEventListener('click', () => updateAllCharts('monthly'));
};


const setupAddListingModalListeners = () => {
    if (showAddListingModalBtn) {
        showAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.remove('hidden');
            }
            if (addListingFormModal) {
                addListingFormModal.reset();
            }
        });
    }

    if (closeAddListingModalBtn) {
        closeAddListingModalBtn.addEventListener('click', () => {
            if (addListingModal) {
                addListingModal.classList.add('hidden');
            }
        });
    }

    if (addListingModal) {
        // Modal closes via Esc key or the Close button only — no backdrop click to close.

        // Close on Esc
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !addListingModal.classList.contains('hidden')) {
                addListingModal.classList.add('hidden');
            }
        });
    }
};


const setupValleyPresenceModal = () => {
    const modal    = document.getElementById('valleyPresenceModal');
    const closeBtn  = document.getElementById('valleyPresenceModalClose');
    const closeBtn2 = document.getElementById('valleyPresenceModalClose2');
    if (!modal) return;
    const close = () => modal.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    closeBtn2?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
};

const setupQuickGuideModal = () => {
    const modal = document.getElementById('quickGuideModal');
    const openBtn = document.getElementById('quick-guide-btn');
    const closeBtn = document.getElementById('quickGuideClose');
    const closeBtn2 = document.getElementById('quickGuideClose2');
    if (!modal || !openBtn) return;
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn2?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
};

const setupAvatarIdGuideModal = () => {
    const modal = document.getElementById('avatarIdGuideModal');
    const openBtn = document.getElementById('avatar-id-guide-btn');
    const closeBtn = document.getElementById('avatarIdGuideClose');
    const closeBtn2 = document.getElementById('avatarIdGuideClose2');
    if (!modal || !openBtn) return;
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn2?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
};

const setupAvatarIdListeners = () => {
    const input = document.getElementById('avatar-id-input');
    const hashBtn = document.getElementById('avatar-id-hash-btn');
    const clearBtn = document.getElementById('avatar-id-clear-btn');
    const statusEl = document.getElementById('avatar-id-status');

    if (!input || !hashBtn || !clearBtn) return;

    // Restore saved state on load
    const saved = getSavedAvatarHash();
    if (saved) {
        input.value = '';
        input.placeholder = 'Avatar ID hashed and saved \u2713';
        if (statusEl) statusEl.textContent = 'Avatar ID is active. Your listings will be highlighted in Market Pulse.';
    }

    hashBtn.addEventListener('click', async () => {
        const raw = input.value.trim();
        if (!raw) {
            if (statusEl) statusEl.textContent = 'Please enter your Avatar ID first.';
            return;
        }
        try {
            if (statusEl) statusEl.textContent = 'Hashing\u2026';
            const hash = await hashAvatarId(raw);
            saveAvatarHash(hash);
            input.value = '';
            input.placeholder = 'Avatar ID hashed and saved \u2713';
            if (statusEl) statusEl.textContent = 'Saved. Reloading Market Pulse\u2026';
            // Re-run zone load to apply own listings
            const character = await (await import('./modules/characters.js')).getCurrentCharacter();
            if (character) {
                const result = await loadZoneDataForCharacter(character);
                if (result) {
                    const ownListings = findOwnListings(hash);
                    const ownSummary = ownListings ? summarizeOwnListings(ownListings) : null;
                    renderMarketPulse(result.zoneSummary, ownSummary, character);
                }
            }
            if (statusEl) statusEl.textContent = 'Avatar ID active. Your listings are now highlighted in Market Pulse.';
        } catch (err) {
            console.error('[AvatarID] Hash error:', err);
            if (statusEl) statusEl.textContent = 'Error hashing Avatar ID. Please try again.';
        }
    });

    clearBtn.addEventListener('click', () => {
        clearAvatarHash();
        input.value = '';
        input.placeholder = 'Paste your Avatar ID here\u2026';
        if (statusEl) statusEl.textContent = 'Avatar ID cleared.';
        // Re-render pulse without own listings
        const section = document.getElementById('market-pulse-section');
        if (section) {
            const ownRow = section.querySelector('.market-pulse-own-row');
            if (ownRow) ownRow.classList.add('hidden');
        }
    });
};


const addPageEventListeners = () => {
    if (showCreateCharacterModalBtn) {
        showCreateCharacterModalBtn.addEventListener('click', () => {
            const createCharacterModal = document.getElementById('createCharacterModal');
            if (createCharacterModal) {
                createCharacterModal.classList.remove('hidden');
            }
        });
    }
    if (traderDiscordLoginButton) {
        traderDiscordLoginButton.addEventListener('click', handleDiscordLogin);
    }
    setupChartTimeframeListeners();
    setupAddListingModalListeners();
    setupAvatarIdListeners();
    setupAvatarIdGuideModal();
    setupQuickGuideModal();
    setupValleyPresenceModal();

};


function createAutocompleteHandlers(inputElement, suggestionsContainerElement, dataArray, selectionCallback) {
    let currentFocus = -1;
    let filteredData = [];

    const showSuggestions = () => {
        if (suggestionsContainerElement.children.length > 0) {
            suggestionsContainerElement.style.display = 'block';
        } else {
            suggestionsContainerElement.style.display = 'none';
        }
    };

    const hideSuggestions = () => {
        suggestionsContainerElement.style.display = 'none';
        currentFocus = -1;
    };

    const renderSuggestions = (items) => {
        suggestionsContainerElement.innerHTML = '';
        filteredData = items;

        if (items.length === 0 && inputElement.value.length > 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.classList.add('autocomplete-no-results');
            noResultsDiv.innerHTML = `No results found for "<strong>${inputElement.value}</strong>"`;
            suggestionsContainerElement.appendChild(noResultsDiv);
        } else {
            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('autocomplete-suggestion-item');
                const match = new RegExp(inputElement.value, 'gi');
                itemDiv.innerHTML = item.item_name.replace(match, '<strong>$&</strong>');

                itemDiv.dataset.itemId = item.item_id;
                itemDiv.dataset.itemCategory = item.category_id;
                itemDiv.dataset.paxDeiSlug = item.pax_dei_slug;
                itemDiv.dataset.itemName = item.item_name;

                itemDiv.addEventListener('click', function() {
                    selectionCallback(item);
                    hideSuggestions();
                });
                suggestionsContainerElement.appendChild(itemDiv);
            });
        }
        showSuggestions();
    };

    const filterItems = (inputValue) => {
        const lowerCaseInput = inputValue.toLowerCase();
        return dataArray.filter(item =>
            item.item_name.toLowerCase().includes(lowerCaseInput)
        ).sort((a, b) => {
            const nameA = a.item_name.toLowerCase();
            const nameB = b.item_name.toLowerCase();
            if (nameA === lowerCaseInput) return -1;
            if (nameB === lowerCaseInput) return 1;
            if (nameA.startsWith(lowerCaseInput) && !nameB.startsWith(lowerCaseInput)) return 1;
            if (!nameA.startsWith(lowerCaseInput) && nameB.startsWith(lowerCaseInput)) return -1;
            return nameA.localeCompare(nameB);
        });
    };

    const addActive = (x) => {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add('highlighted');
        x[currentFocus].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const removeActive = (x) => {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove('highlighted');
        }
    };

    return {
        handleInput: function() {
            const val = inputElement.value;
            if (val.length === 0) {
                hideSuggestions();
                delete inputElement.dataset.selectedItemId;
                delete inputElement.dataset.selectedPaxDeiSlug;
                delete inputElement.dataset.selectedItemCategory;
                return;
            }
            const filtered = filterItems(val);
            renderSuggestions(filtered);
        },
        handleKeydown: function(e) {
            let x = suggestionsContainerElement.getElementsByClassName('autocomplete-suggestion-item');
            if (e.keyCode == 40) {
                currentFocus++;
                addActive(x);
            } else if (e.keyCode == 38) {
                currentFocus--;
                addActive(x);
            } else if (e.keyCode == 13) {
                e.preventDefault();
                if (currentFocus > -1 && x[currentFocus]) {
                    x[currentFocus].click();
                } else if (filteredData.length === 1 && inputElement.value.toLowerCase() === filteredData[0].item_name.toLowerCase()) {
                    selectionCallback(filteredData[0]);
                    hideSuggestions();
                }
            } else if (e.keyCode == 27) {
                hideSuggestions();
            }
        },
        handleBlur: function() {
            const exactMatch = dataArray.find(item => item.item_name.toLowerCase() === inputElement.value.toLowerCase());
            if (exactMatch) {
                // Only re-invoke selectionCallback if this item isn't already selected;
                // otherwise every click on dead space re-triggers the sales history fetch and causes a flash.
                if (inputElement.dataset.selectedItemId !== String(exactMatch.item_id)) {
                    selectionCallback(exactMatch);
                }
            } else {
                delete inputElement.dataset.selectedItemId;
                delete inputElement.dataset.selectedPaxDeiSlug;
                delete inputElement.dataset.selectedItemCategory;
            }
            setTimeout(() => hideSuggestions(), 150);
        }
    };
}


export function setupCustomAutocomplete(inputElement, suggestionsContainerElement, dataArray, selectionCallback) {
    const handlers = createAutocompleteHandlers(inputElement, suggestionsContainerElement, dataArray, selectionCallback);

    inputElement.addEventListener('input', handlers.handleInput);
    inputElement.addEventListener('keydown', handlers.handleKeydown);
    inputElement.addEventListener('blur', handlers.handleBlur);

    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !suggestionsContainerElement.contains(e.target)) {
            handlers.handleBlur(); 
        }
    });
}

async function fetchItemSalesHistory(itemId) {
    try {
        const { data, error } = await supabase
            .from('sales')
            .select('quantity_sold, sale_price_per_unit, total_sale_price, sale_date, market_listings!inner(item_id)')
            .eq('market_listings.item_id', itemId)
            .eq('character_id', currentCharacterId)
            .order('sale_date', { ascending: false })
            .limit(100);

        if (error || !data || data.length === 0) return null;

        const totalUnits  = data.reduce((s, r) => s + (r.quantity_sold || 0), 0);
        const avgPerUnit  = data.reduce((s, r) => s + (r.sale_price_per_unit || 0), 0) / data.length;
        const avgPerStack = data.reduce((s, r) => s + (r.total_sale_price || 0), 0) / data.length;
        const lastSold    = data[0].sale_date;
        const saleCount   = data.length;

        return { avgPerUnit, avgPerStack, totalUnits, saleCount, lastSold };
    } catch {
        return null;
    }
}

function initializeAutocomplete(allItems) {
    // Holds the last fetched market data, own listing count, and sales history for the add-listing modal
    let _addListingMarketData = null;
    let _addListingOwnCount = 0;   // how many of the zone listings for this item belong to the user
    let _addListingHistoryData = null;
    let _addListingHistoryLoading = false;

    function getRelativeTime(isoDate) {
        const diff = Date.now() - new Date(isoDate).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    function buildSuggestion(md, hist, count, stacks) {
        const hasMarket   = !!md;
        const hasHist     = !!hist;
        const hasCount    = count > 0;
        const hasStacks   = stacks > 0;
        const lowSupply   = hasMarket && md.totalListings <= 3;
        const highSupply  = hasMarket && md.totalListings > 20;

        if (!hasMarket && !hasHist) return null;

        let suggestedPerStack = null;
        let insight = '';
        let insightClass = 'text-gray-400';

        if (hasMarket && hasHist && hasCount) {
            const ratio = md.marketLow / hist.avgPerUnit;
            const marketFloor = Math.round(md.marketLow * count);

            if (lowSupply) {
                // Low competition — price above market low, but never below it
                const histBased = Math.round(hist.avgPerUnit * count * 1.05);
                suggestedPerStack = Math.max(histBased, marketFloor);
                insight = `Only ${md.totalListings} listing${md.totalListings !== 1 ? 's' : ''} in your zone — low competition, you have pricing power.`;
                insightClass = 'text-emerald-400';
            } else if (ratio < 0.75) {
                suggestedPerStack = marketFloor;
                insight = `Market has dropped well below your historical avg — competitive pricing recommended.`;
                insightClass = 'text-rose-400';
            } else if (ratio < 0.95) {
                suggestedPerStack = marketFloor;
                insight = `Market is slightly below your avg — pricing near market low will move faster.`;
                insightClass = 'text-amber-400';
            } else if (ratio <= 1.1) {
                // Market aligns — use hist avg but never below market low
                suggestedPerStack = Math.max(Math.round(hist.avgPerUnit * count), marketFloor);
                insight = `Market aligns with your historical avg — your usual price looks good.`;
                insightClass = 'text-emerald-400';
            } else {
                // Market has risen above hist — suggest market low as the new baseline
                suggestedPerStack = marketFloor;
                insight = `Market low is above your historical avg — consider pricing higher than usual.`;
                insightClass = 'text-emerald-400';
            }
        } else if (hasMarket && hasCount) {
            const marketFloor = Math.round(md.marketLow * count);
            if (lowSupply) {
                suggestedPerStack = Math.round(md.marketLow * count * 1.1);
                insight = `Only ${md.totalListings} listing${md.totalListings !== 1 ? 's' : ''} in your zone — no competition, priced 10% above market low.`;
                insightClass = 'text-emerald-400';
            } else {
                suggestedPerStack = marketFloor;
                insight = `No sales history yet — market low used as baseline.`;
                insightClass = 'text-gray-400';
            }
        } else if (hasHist && hasCount) {
            suggestedPerStack = Math.round(hist.avgPerUnit * count);
            insight = `No live market data — based on your sales history only.`;
            insightClass = 'text-gray-400';
        }

        // Total revenue if stacks known
        const totalRevenue = (suggestedPerStack !== null && hasStacks)
            ? suggestedPerStack * stacks
            : null;

        // Market impact note
        let impactNote = null;
        if (hasMarket && hasStacks && md.totalListings > 0) {
            const pct = Math.round((stacks / md.totalListings) * 100);
            if (stacks >= md.totalListings) {
                impactNote = { text: `You'd be adding ${stacks} stacks to ${md.totalListings} existing — this doubles+ the supply in your zone.`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
            } else if (pct >= 50) {
                impactNote = { text: `You'd be adding ${stacks} stacks to ${md.totalListings} existing (~${pct}% of current supply).`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
            } else if (pct >= 20) {
                impactNote = { text: `Adding ${stacks} stacks alongside ${md.totalListings} existing listings (~${pct}% of supply).`, cls: 'text-gray-300', bubble: 'bg-gray-400' };
            }
            // Below 20% — not worth flagging
        }

        return { suggestedPerStack, totalRevenue, insight, insightClass, impactNote };
    }

    function renderAddListingHint() {
        const hintEl = document.getElementById('modal-market-price-hint');
        if (!hintEl) return;

        const md      = _addListingMarketData;
        const hist    = _addListingHistoryData;
        const loading = _addListingHistoryLoading;

        if (!md && !hist && !loading) {
            hintEl.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fas fa-info-circle text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm italic">No market or sales data found for this item yet.</span>
                </div>`;
            hintEl.classList.remove('hidden');
            return;
        }

        const count  = parseInt(document.getElementById('modal-item-count-per-stack')?.value, 10);
        const stacks = parseInt(document.getElementById('modal-item-stacks')?.value, 10);
        const price  = parseFloat(document.getElementById('modal-item-price-per-stack')?.value);
        const hasCount  = count > 0;
        const hasStacks = stacks > 0;
        const hasPrice  = price > 0;
        const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

        // ── Supply context tag (shown in market column header) ───────────────
        const supplyTag = md
            ? md.totalListings <= 3
                ? `<span class="ml-2 text-xs font-semibold text-emerald-300 bg-emerald-900/50 border border-emerald-500/40 rounded px-1.5 py-0.5">Low supply</span>`
                : md.totalListings > 20
                    ? `<span class="ml-2 text-xs font-semibold text-rose-300 bg-rose-900/50 border border-rose-500/40 rounded px-1.5 py-0.5">High supply</span>`
                    : ''
            : '';

        // ── Market column ────────────────────────────────────────────────────
        const marketCol = md ? `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-3 flex-wrap">
                    <i class="fas fa-globe text-blue-400"></i>
                    <span class="text-blue-300 text-base font-semibold uppercase tracking-wide">Live Market</span>
                    ${supplyTag}
                </div>
                <div class="space-y-1.5">
                    <div class="flex justify-between gap-2">
                        <span class="text-white text-sm">Low/unit</span>
                        <span class="text-amber-400 font-bold text-sm">${fmt(md.marketLow)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-white text-sm">Avg/unit</span>
                        <span class="text-white text-sm">${fmt(md.marketAvg)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-400/40 pt-1.5 mt-1.5">
                        <div class="flex justify-between gap-2">
                            <span class="text-white text-sm">Low/stack <span class="text-gray-400 text-xs">(${count})</span></span>
                            <span class="text-amber-400 font-bold text-sm">${fmt(md.marketLow * count)}g</span>
                        </div>
                        <div class="flex justify-between gap-2 mt-1">
                            <span class="text-white text-sm">Avg/stack</span>
                            <span class="text-white text-sm">${fmt(md.marketAvg * count)}g</span>
                        </div>
                    </div>` : `<div class="text-gray-400 text-sm italic mt-1">Enter count for stack prices</div>`}
                    <div class="text-gray-400 text-xs mt-1.5">
                        ${md.totalListings} listing${md.totalListings !== 1 ? 's' : ''} in your home valley${_addListingOwnCount > 0 ? ` <span class="text-emerald-400">(${_addListingOwnCount} yours)</span>` : ''}
                    </div>
                </div>
            </div>` : `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-3">
                    <i class="fas fa-globe text-gray-500"></i>
                    <span class="text-gray-400 text-base font-semibold uppercase tracking-wide">Live Market</span>
                </div>
                <div class="text-gray-400 text-sm italic">No market data in your zone</div>
            </div>`;

        // ── History column ───────────────────────────────────────────────────
        let histCol;
        if (loading) {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-3">
                    <i class="fas fa-chart-bar text-purple-400"></i>
                    <span class="text-purple-300 text-base font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-400 text-sm italic"><i class="fas fa-spinner fa-spin mr-1"></i>Loading history&hellip;</div>
            </div>`;
        } else if (hist) {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-3">
                    <i class="fas fa-chart-bar text-purple-400"></i>
                    <span class="text-purple-300 text-base font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="space-y-1.5">
                    <div class="flex justify-between gap-2">
                        <span class="text-white text-sm">Avg/unit</span>
                        <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-white text-sm">Avg/stack</span>
                        <span class="text-white text-sm">${fmt(hist.avgPerStack)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-400/40 pt-1.5 mt-1.5">
                        <div class="flex justify-between gap-2">
                            <span class="text-white text-sm">Hist/stack <span class="text-gray-400 text-xs">(${count})</span></span>
                            <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit * count)}g</span>
                        </div>
                    </div>` : ''}
                    <div class="text-gray-400 text-xs mt-1.5">${hist.saleCount} sale${hist.saleCount !== 1 ? 's' : ''} &middot; last ${getRelativeTime(hist.lastSold)}</div>
                </div>
            </div>`;
        } else {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-3">
                    <i class="fas fa-chart-bar text-gray-500"></i>
                    <span class="text-gray-400 text-base font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-400 text-sm italic">No sales recorded for this item</div>
            </div>`;
        }

        // ── Suggestion + context rows ────────────────────────────────────────
        const suggestion = buildSuggestion(md, hist, count, stacks);
        const bubbleMap = {
            'text-rose-400':    'bg-rose-400',
            'text-amber-400':   'bg-amber-400',
            'text-emerald-400': 'bg-emerald-400',
            'text-gray-300':    'bg-gray-400',
            'text-gray-400':    'bg-gray-400',
        };

        let bottomRows = '';
        if (suggestion) { // suggestion hoisted above
            // Row 1 — suggested price + use button + total revenue at suggested
            const suggestedTotal = (suggestion.suggestedPerStack !== null && hasStacks)
                ? `<span class="text-gray-400 text-sm mx-1">&rarr;</span><span class="text-white text-sm">Total at suggested: <span class="text-yellow-200 font-bold">${fmt(suggestion.suggestedPerStack * stacks)}g</span> <span class="text-gray-400 text-xs">(${stacks} stack${stacks !== 1 ? 's' : ''})</span></span>`
                : '';
            bottomRows += `
            <div class="border-t border-slate-400/40 pt-2.5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span class="text-white text-sm font-semibold flex items-center gap-1.5">
                    <i class="fas fa-lightbulb text-yellow-400"></i> Suggested price:
                </span>
                ${suggestion.suggestedPerStack !== null
                    ? `<span class="text-yellow-300 font-bold text-base">${fmt(suggestion.suggestedPerStack)}g</span>${hasCount ? ` <span class="text-gray-400 text-sm">/stack (${count})</span>` : ''}
                       <button id="modal-use-suggested-price-btn" type="button" class="px-2 py-0.5 text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/40 rounded transition-colors">Use</button>`
                    : `<span class="text-gray-400 text-sm italic">Enter count above</span>`}
                ${suggestedTotal}
            </div>`;

            // Row 2 — insight
            if (suggestion.insight) {
                bottomRows += `
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${bubbleMap[suggestion.insightClass] || 'bg-gray-400'}"></span>
                <span class="${suggestion.insightClass} text-sm">${suggestion.insight}</span>
            </div>`;
            }

            // Row 3 — market impact (only if notable)
            if (suggestion.impactNote) {
                bottomRows += `
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${suggestion.impactNote.bubble}"></span>
                <span class="${suggestion.impactNote.cls} text-sm">${suggestion.impactNote.text}</span>
            </div>`;
            }
        }

        // Row 4 — live price total (always shown when price+stacks are filled)
        if (hasPrice && hasStacks) {
            const liveTotal = price * stacks;
            bottomRows += `
            <div class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-400/30">
                <i class="fas fa-calculator text-gray-400 text-xs"></i>
                <span class="text-white text-sm">At <span class="text-white font-semibold">${fmt(price)}g</span>/stack &times; ${stacks} stack${stacks !== 1 ? 's' : ''} = <span class="text-cyan-300 font-bold">${fmt(liveTotal)}g</span> total revenue</span>
            </div>`;
        }

        hintEl.innerHTML = `<div class="flex gap-5">${marketCol}<div class="w-px bg-slate-400/40 self-stretch"></div>${histCol}</div>${bottomRows}`;
        hintEl.classList.remove('hidden');

        // Wire up "Use" button — must happen after innerHTML is set
        const useBtn = hintEl.querySelector('#modal-use-suggested-price-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                if (priceInput && suggestion?.suggestedPerStack !== null) {
                    priceInput.value = suggestion.suggestedPerStack;
                    priceInput.focus();
                }
            });
        }
    }

    // Re-render hint when count, stacks, or price changes
    document.getElementById('modal-item-count-per-stack')?.addEventListener('input', renderAddListingHint);
    document.getElementById('modal-item-stacks')?.addEventListener('input', renderAddListingHint);
    document.getElementById('modal-item-price-per-stack')?.addEventListener('input', renderAddListingHint);

    const setupInputAutocomplete = (inputNameId, suggestionsId, categorySelectId, priceHintId = null) => {
        const inputElement = document.getElementById(inputNameId);
        const suggestionsElement = document.getElementById(suggestionsId);
        if (inputElement && suggestionsElement) {
            setupCustomAutocomplete(inputElement, suggestionsElement, allItems, (selectedItem) => {
                inputElement.value = selectedItem.item_name;
                const categorySelect = document.getElementById(categorySelectId);
                if (categorySelect) {
                    categorySelect.value = String(selectedItem.category_id);
                }
                inputElement.dataset.selectedItemId = selectedItem.item_id;
                inputElement.dataset.selectedPaxDeiSlug = selectedItem.pax_dei_slug;
                inputElement.dataset.selectedItemCategory = selectedItem.category_id;

                // Market price hint + sales history (add-listing modal only)
                if (priceHintId === 'modal-market-price-hint') {
                    // Look up by slug first, but validate the slug actually maps to this item's
                    // name — a mismatched pax_dei_slug in the DB (e.g. Charcoal pointing to
                    // Charcoal Kiln Plans' item_id) would otherwise return the wrong prices.
                    let marketData = null;
                    if (selectedItem.pax_dei_slug) {
                        const slugData = getMarketDataForSlug(selectedItem.pax_dei_slug);
                        if (slugData) {
                            const slugName = getItemNameForSlug(selectedItem.pax_dei_slug);
                            const nameMatches = slugName &&
                                slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                            if (nameMatches) {
                                marketData = slugData;
                            } else {
                                console.warn(
                                    `[Trader] pax_dei_slug mismatch for "${selectedItem.item_name}": ` +
                                    `slug "${selectedItem.pax_dei_slug}" resolves to "${slugName}" — falling back to name lookup.`
                                );
                            }
                        }
                    }
                    if (!marketData) {
                        marketData = getMarketDataByItemName(selectedItem.item_name);
                    }
                    _addListingMarketData = marketData || null;

                    // Check how many zone listings for this item belong to the user.
                    // We need the correct gaming.tools item_id, which may differ from
                    // pax_dei_slug if the slug is mismatched or missing in the DB.
                    const savedHash = getSavedAvatarHash();
                    if (savedHash) {
                        // Prefer validated slug; fall back to name-map lookup.
                        let gtItemId = null;
                        if (selectedItem.pax_dei_slug) {
                            const slugName = getItemNameForSlug(selectedItem.pax_dei_slug);
                            const slugValid = slugName &&
                                slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                            if (slugValid) gtItemId = selectedItem.pax_dei_slug;
                        }
                        if (!gtItemId) {
                            gtItemId = getItemIdByName(selectedItem.item_name);
                        }
                        _addListingOwnCount = gtItemId
                            ? getOwnListingCountForSlug(savedHash, gtItemId).ownCount
                            : 0;
                    } else {
                        _addListingOwnCount = 0;
                    }

                    if (!marketData) {
                        const hintEl = document.getElementById(priceHintId);
                        if (hintEl) {
                            hintEl.innerHTML = '<span class="text-gray-400 text-sm"><i class="fas fa-globe text-sm mr-1 text-gray-500"></i>No market data for this item in your zone.</span>';
                            hintEl.classList.remove('hidden');
                        }
                    }

                    // Fetch sales history async (non-blocking)
                    if (currentCharacterId && selectedItem.item_id) {
                        _addListingHistoryData = null;
                        _addListingHistoryLoading = true;
                        if (marketData) renderAddListingHint(); // show market + spinner
                        fetchItemSalesHistory(selectedItem.item_id).then((hist) => {
                            _addListingHistoryData = hist;
                            _addListingHistoryLoading = false;
                            renderAddListingHint();
                        });
                    } else {
                        _addListingHistoryData = null;
                        _addListingHistoryLoading = false;
                        if (marketData) renderAddListingHint();
                    }
                }
            });
        }
    };

    setupInputAutocomplete('modal-item-name', 'modal-item-name-suggestions', 'modal-item-category', 'modal-market-price-hint');
    setupInputAutocomplete('modal-purchase-item-name', 'modal-purchase-item-name-suggestions', 'modal-purchase-item-category');

    const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
    const filterListingItemNameSuggestions = document.getElementById('filter-listing-item-name-suggestions');

    if (filterListingItemNameInput && filterListingItemNameSuggestions) {
        setupCustomAutocomplete(filterListingItemNameInput, filterListingItemNameSuggestions, allItems, (selectedItem) => {
            filterListingItemNameInput.value = selectedItem.item_name;
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Only run trader initialization on the ledger/market page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const traderPages = ['ledger.html', 'trader.html'];
    if (!traderPages.includes(currentPage)) return;

    window.customModalElements = initCustomModal();

    // Show loading overlay immediately so it's visible before auth resolves
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    await checkUser();
    await populateItemData();
    addPageEventListeners();
});