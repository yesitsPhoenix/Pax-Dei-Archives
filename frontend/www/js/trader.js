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
    getMarketDataForSlugByQuality,
    getMarketDataByItemNameAndQuality,
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
import { getCompetitiveThresholds, classifyCompetitiveGap } from './modules/pricingBands.js';

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
    } else {
        // No session — hide loading overlay so the login button is accessible
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
};

export async function fetchAllItemsForDropdown() {
    // Supabase server-side Max Rows cap (default 1000) overrides any .limit() call.
    // Paginate in chunks of 1000 until we have everything.
    const PAGE_SIZE = 1000;
    let allItems = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('items')
            .select('item_id, item_name, category_id, pax_dei_slug')
            .order('item_name', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('[Items] fetchAllItemsForDropdown error:', error);
            throw error;
        }

        allItems = allItems.concat(data || []);

        if (!data || data.length < PAGE_SIZE) break; // last page
        from += PAGE_SIZE;
    }

    console.log(`[Items] Loaded ${allItems.length} items total`);
    return allItems;
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
            .select('quantity_sold, sale_price_per_unit, total_sale_price, sale_date, market_listings!inner(item_id, is_mastercrafted, enchantment_tier)')
            .eq('market_listings.item_id', itemId)
            .eq('character_id', currentCharacterId)
            .order('sale_date', { ascending: false })
            .limit(100);

        if (error || !data || data.length === 0) return null;

        const totalUnits  = data.reduce((s, r) => s + (r.quantity_sold || 0), 0);
        const avgPerUnit  = data.reduce((s, r) => s + (r.sale_price_per_unit || 0), 0) / data.length;
        const avgPerStack = data.reduce((s, r) => s + (r.total_sale_price || 0), 0) / data.length;
        const maxPerUnit  = Math.max(...data.map(r => r.sale_price_per_unit || 0));
        const lastSold    = data[0].sale_date;
        const saleCount   = data.length;

        // Build quality-keyed breakdown
        const grouped = {};
        for (const row of data) {
            const ml  = row.market_listings;
            const mc  = ml?.is_mastercrafted ? 1 : 0;
            const enc = ml?.enchantment_tier  || 0;
            const key = `mc${mc}enc${enc}`;
            if (!grouped[key]) grouped[key] = { rows: [], lastSold: null };
            grouped[key].rows.push(row);
            if (!grouped[key].lastSold || row.sale_date > grouped[key].lastSold) {
                grouped[key].lastSold = row.sale_date;
            }
        }
        const byQuality = {};
        for (const [key, group] of Object.entries(grouped)) {
            const rows = group.rows;
            byQuality[key] = {
                avgPerUnit:  rows.reduce((s, r) => s + (r.sale_price_per_unit || 0), 0) / rows.length,
                avgPerStack: rows.reduce((s, r) => s + (r.total_sale_price    || 0), 0) / rows.length,
                maxPerUnit:  Math.max(...rows.map(r => r.sale_price_per_unit || 0)),
                saleCount:   rows.length,
                lastSold:    group.lastSold
            };
        }

        return { avgPerUnit, avgPerStack, maxPerUnit, totalUnits, saleCount, lastSold, byQuality };
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
    let _addListingSelectedItem = null;  // the currently selected item (for quality-specific lookups)

    function getRelativeTime(isoDate) {
        const diff = Date.now() - new Date(isoDate).getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    function buildSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier) {
        const ENCHANT_PREMIUMS = [0, 0.10, 0.20, 0.30];
        const mcPremium   = isMastercrafted ? 0.15 : 0;
        const encPremium  = ENCHANT_PREMIUMS[enchantmentTier || 0] || 0;
        const qualityMult = (1 + mcPremium) * (1 + encPremium);
        const isQuality   = isMastercrafted || ((enchantmentTier || 0) > 0);

        // Effective market data: quality-specific if available, otherwise all-quality × premium
        const effectiveMd = qualityMd || (md && isQuality ? {
            marketLow:     parseFloat((md.marketLow  * qualityMult).toFixed(2)),
            marketAvg:     parseFloat((md.marketAvg  * qualityMult).toFixed(2)),
            totalListings: null,  // estimated — not a real listing count
            isEstimated:   true
        } : md);

        // Effective history: quality-specific if available, otherwise all-quality × premium
        const qHistKey    = `mc${isMastercrafted ? 1 : 0}enc${enchantmentTier || 0}`;
        const qualityHist = hist?.byQuality?.[qHistKey] || null;
        const effectiveHist = qualityHist || (hist && isQuality ? {
            avgPerUnit:  parseFloat((hist.avgPerUnit  * qualityMult).toFixed(2)),
            avgPerStack: parseFloat((hist.avgPerStack * qualityMult).toFixed(2)),
            maxPerUnit:  parseFloat((hist.maxPerUnit  * qualityMult).toFixed(2)),
            saleCount:   hist.saleCount,
            lastSold:    hist.lastSold,
            isEstimated: true
        } : hist);

        const hasMarket = !!effectiveMd;
        const hasHist   = !!effectiveHist;
        const hasCount  = count > 0;
        const hasStacks = stacks > 0;
        const lowSupply = hasMarket && effectiveMd.totalListings !== null && effectiveMd.totalListings <= 3;

        if (!hasMarket && !hasHist) return null;

        let suggestedPerStack = null;
        let insight      = '';
        let insightClass = 'text-gray-400';

        // Quality note for display
        let qualityNote = null;
        if (isQuality) {
            if (qualityMd && qualityHist) {
                qualityNote = { type: 'exact',    text: 'Using quality-specific market and sales data.' };
            } else if (qualityMd) {
                qualityNote = { type: 'partial',  text: 'Quality-specific market data found; sales history is blended across all quality.' };
            } else if (qualityHist) {
                qualityNote = { type: 'partial',  text: 'Quality-specific sales history found; market data is estimated.' };
            } else {
                const parts = [];
                if (isMastercrafted) parts.push('Mastercrafted +15%');
                if ((enchantmentTier || 0) > 0) {
                    const labels = ['', 'I', 'II', 'III'];
                    parts.push(`Enchant ${labels[enchantmentTier]} +${[0,10,20,30][enchantmentTier]}%`);
                }
                qualityNote = { type: 'estimated', text: `No quality-specific data found — estimated from base prices (${parts.join(', ')}).` };
            }
        }

        if (hasMarket && hasHist && hasCount) {
            const marketFloor = Math.round(effectiveMd.marketLow * count);
            const ratio       = effectiveMd.marketLow / effectiveHist.avgPerUnit;

            if (lowSupply) {
                const histBased   = Math.round(effectiveHist.avgPerUnit * count * 1.05);
                suggestedPerStack = Math.max(histBased, marketFloor);
                insight           = `Only ${effectiveMd.totalListings} listing${effectiveMd.totalListings !== 1 ? 's' : ''} in your zone — low competition, you have pricing power.`;
                insightClass      = 'text-emerald-400';
            } else if (ratio < 0.75) {
                suggestedPerStack = marketFloor;
                insight           = 'Market has dropped well below your historical avg — competitive pricing recommended.';
                insightClass      = 'text-rose-400';
            } else if (ratio < 0.95) {
                suggestedPerStack = marketFloor;
                insight           = 'Market is slightly below your avg — pricing near market low will move faster.';
                insightClass      = 'text-amber-400';
            } else if (ratio <= 1.1) {
                suggestedPerStack = Math.max(Math.round(effectiveHist.avgPerUnit * count), marketFloor);
                insight           = 'Market aligns with your historical avg — your usual price looks good.';
                insightClass      = 'text-emerald-400';
            } else {
                // Market has risen above history — price 5% above floor
                suggestedPerStack = Math.round(effectiveMd.marketLow * count * 1.05);
                insight           = 'Market low is above your historical avg — priced 5% above market floor.';
                insightClass      = 'text-emerald-400';
            }
        } else if (hasMarket && hasCount) {
            if (lowSupply) {
                suggestedPerStack = Math.round(effectiveMd.marketLow * count * 1.1);
                insight           = `Only ${effectiveMd.totalListings} listing${effectiveMd.totalListings !== 1 ? 's' : ''} — no competition, priced 10% above market low.`;
                insightClass      = 'text-emerald-400';
            } else {
                suggestedPerStack = Math.round(effectiveMd.marketLow * count);
                insight           = 'No sales history yet — market low used as baseline.';
                insightClass      = 'text-gray-400';
            }
        } else if (hasHist && hasCount) {
            // No live market — player can capture the market
            const bestHistPerUnit = Math.max(effectiveHist.maxPerUnit || 0, effectiveHist.avgPerUnit || 0);
            suggestedPerStack = Math.round(bestHistPerUnit * count * 1.10);
            insight           = 'No live market listings — you can set the price. Priced 10% above your best historical sale.';
            insightClass      = 'text-emerald-400';
        }

        const totalRevenue = (suggestedPerStack !== null && hasStacks) ? suggestedPerStack * stacks : null;

        // Market impact note (only when we have a real listing count)
        let impactNote = null;
        if (hasMarket && hasStacks && effectiveMd.totalListings !== null && effectiveMd.totalListings > 0) {
            const pct = Math.round((stacks / effectiveMd.totalListings) * 100);
            if (stacks >= effectiveMd.totalListings) {
                impactNote = { text: `You'd be adding ${stacks} stacks to ${effectiveMd.totalListings} existing — this doubles+ the supply in your zone.`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
            } else if (pct >= 50) {
                impactNote = { text: `You'd be adding ${stacks} stacks to ${effectiveMd.totalListings} existing (~${pct}% of current supply).`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
            } else if (pct >= 20) {
                impactNote = { text: `Adding ${stacks} stacks alongside ${effectiveMd.totalListings} existing (~${pct}% of supply).`, cls: 'text-gray-300', bubble: 'bg-gray-400' };
            }
        }

        return { suggestedPerStack, totalRevenue, insight, insightClass, impactNote, qualityNote };
    }

    function renderAddListingHint() {
        const hintEl      = document.getElementById('modal-market-price-hint');
        const placeholder = document.getElementById('modal-market-hint-placeholder');
        if (!hintEl) return;

        const md      = _addListingMarketData;
        const hist    = _addListingHistoryData;
        const loading = _addListingHistoryLoading;

        if (!md && !hist && !loading) {
            if (!_addListingSelectedItem) {
                // No item selected yet — show placeholder
                hintEl.innerHTML = '';
                hintEl.classList.add('hidden');
                if (placeholder) placeholder.classList.remove('hidden');
            } else {
                // Item selected but no data exists
                if (placeholder) placeholder.classList.add('hidden');
                hintEl.innerHTML = `<div class="flex items-center gap-2 p-2">
                    <i class="fas fa-info-circle text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm italic">No market or sales data found for this item yet.</span>
                </div>`;
                hintEl.classList.remove('hidden');
            }
            return;
        }
        if (placeholder) placeholder.classList.add('hidden');

        // Read quality toggles from the form
        const isMastercrafted = document.getElementById('modal-is-mastercrafted')?.value === 'true';
        const enchantmentTier = parseInt(document.getElementById('modal-enchantment-tier')?.value || '0', 10) || 0;
        const isQuality       = isMastercrafted || enchantmentTier > 0;

        // Quality-specific market data lookup
        let qualityMd = null;
        if (isQuality && _addListingSelectedItem) {
            if (_addListingSelectedItem.pax_dei_slug) {
                const slugName  = getItemNameForSlug(_addListingSelectedItem.pax_dei_slug);
                const slugValid = slugName && slugName.toLowerCase().trim() === _addListingSelectedItem.item_name.toLowerCase().trim();
                if (slugValid) qualityMd = getMarketDataForSlugByQuality(_addListingSelectedItem.pax_dei_slug, isMastercrafted, enchantmentTier);
            }
            if (!qualityMd) qualityMd = getMarketDataByItemNameAndQuality(_addListingSelectedItem.item_name, isMastercrafted, enchantmentTier);
        }

        const count  = parseInt(document.getElementById('modal-item-count-per-stack')?.value, 10);
        const stacks = parseInt(document.getElementById('modal-item-stacks')?.value, 10);
        const price  = parseFloat(document.getElementById('modal-item-price-per-stack')?.value);
        const hasCount  = count > 0;
        const hasStacks = stacks > 0;
        const hasPrice  = price > 0;
        const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

        // ── Market column ─────────────────────────────────────────────────────
        const displayMd   = qualityMd || md;
        const supplyCount = displayMd?.totalListings ?? 0;
        const supplyTag   = displayMd
            ? supplyCount <= 3
                ? `<span class="ml-1 text-xs font-semibold text-emerald-300 bg-emerald-900/50 border border-emerald-500/40 rounded px-1.5 py-0.5">Low supply</span>`
                : supplyCount > 20
                    ? `<span class="ml-1 text-xs font-semibold text-rose-300 bg-rose-900/50 border border-rose-500/40 rounded px-1.5 py-0.5">High supply</span>`
                    : ''
            : '';
        const qBadge = isQuality && qualityMd
            ? `<span class="ml-1 text-xs font-semibold text-purple-300 bg-purple-900/40 border border-purple-500/40 rounded px-1.5 py-0.5">Quality match</span>`
            : isQuality && md
                ? `<span class="ml-1 text-xs font-semibold text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded px-1.5 py-0.5">Est. ×quality</span>`
                : '';

        let marketCol;
        if (displayMd) {
            marketCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 mb-2 flex-wrap">
                    <i class="fas fa-globe text-blue-400 text-sm"></i>
                    <span class="text-blue-300 text-sm font-semibold uppercase tracking-wide">Live Market</span>
                    ${supplyTag}${qBadge}
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Low/unit</span>
                        <span class="text-amber-400 font-bold text-sm">${fmt(displayMd.marketLow)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/unit</span>
                        <span class="text-white text-sm">${fmt(displayMd.marketAvg)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-500/40 pt-1 mt-1">
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Low/stack <span class="text-gray-500 text-xs">(${count})</span></span>
                            <span class="text-amber-400 font-bold text-sm">${fmt(displayMd.marketLow * count)}g</span>
                        </div>
                        <div class="flex justify-between gap-2 mt-0.5">
                            <span class="text-gray-300 text-sm">Avg/stack</span>
                            <span class="text-white text-sm">${fmt(displayMd.marketAvg * count)}g</span>
                        </div>
                    </div>` : `<div class="text-gray-500 text-xs italic mt-1">Enter count for stack prices</div>`}
                    ${qualityMd && md ? `
                    <div class="mt-1 pt-1 border-t border-slate-500/30 text-gray-500 text-sm">
                        All quality: ${md.totalListings} listing${md.totalListings !== 1 ? 's' : ''} &middot; Low ${fmt(md.marketLow)}g
                    </div>` : ''}
                    <div class="text-gray-500 text-sm mt-0.5">
                        ${displayMd.totalListings !== null
                            ? `${displayMd.totalListings} listing${displayMd.totalListings !== 1 ? 's' : ''} in your zone`
                            : 'Estimated from all-quality listings'}${_addListingOwnCount > 0 ? ` <span class="text-emerald-400">(${_addListingOwnCount} yours)</span>` : ''}
                    </div>
                </div>
            </div>`;
        } else {
            marketCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-globe text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm font-semibold uppercase tracking-wide">Live Market</span>
                </div>
                <div class="text-gray-500 text-sm italic">No market data in your zone</div>
            </div>`;
        }

        // ── History column ────────────────────────────────────────────────────
        let histCol;
        if (loading) {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-chart-bar text-purple-400 text-sm"></i>
                    <span class="text-purple-300 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-400 text-sm italic"><i class="fas fa-spinner fa-spin mr-1"></i>Loading&hellip;</div>
            </div>`;
        } else if (hist) {
            const qHistKey    = `mc${isMastercrafted ? 1 : 0}enc${enchantmentTier}`;
            const qualityHist = hist.byQuality?.[qHistKey] || null;
            const hasQBreakdown = isQuality && qualityHist && qualityHist.saleCount < hist.saleCount;
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 mb-2 flex-wrap">
                    <i class="fas fa-chart-bar text-purple-400 text-sm"></i>
                    <span class="text-purple-300 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                    ${hasQBreakdown ? `<span class="text-xs font-semibold text-gray-400 bg-slate-700 border border-slate-500 rounded px-1.5 py-0.5">All quality</span>` : ''}
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/unit</span>
                        <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/stack</span>
                        <span class="text-white text-sm">${fmt(hist.avgPerStack)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-500/40 pt-1 mt-1">
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Hist/stack <span class="text-gray-500 text-xs">(${count})</span></span>
                            <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit * count)}g</span>
                        </div>
                    </div>` : ''}
                    ${hasQBreakdown ? `
                    <div class="mt-1.5 pt-1.5 border-t border-purple-500/30 bg-purple-900/10 rounded p-1.5">
                        <div class="text-purple-300 text-sm font-semibold mb-1 flex items-center gap-1">
                            <i class="fas fa-filter text-xs"></i> Same quality (${qualityHist.saleCount} sale${qualityHist.saleCount !== 1 ? 's' : ''})
                        </div>
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Avg/unit</span>
                            <span class="text-purple-200 font-semibold text-sm">${fmt(qualityHist.avgPerUnit)}g</span>
                        </div>
                        ${hasCount ? `<div class="flex justify-between gap-2 mt-0.5">
                            <span class="text-gray-300 text-sm">Avg/stack (${count})</span>
                            <span class="text-purple-200 font-semibold text-sm">${fmt(qualityHist.avgPerUnit * count)}g</span>
                        </div>` : ''}
                        <div class="text-gray-500 text-sm mt-0.5">Last sold ${getRelativeTime(qualityHist.lastSold)}</div>
                    </div>` : ''}
                    <div class="text-gray-500 text-sm mt-1">${hist.saleCount} sale${hist.saleCount !== 1 ? 's' : ''} &middot; last ${getRelativeTime(hist.lastSold)}</div>
                </div>
            </div>`;
        } else {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-chart-bar text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-500 text-sm italic">No sales recorded for this item</div>
            </div>`;
        }

        // ── Build suggestion ─────────────────────────────────────────────────
        const suggestion = buildSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier);

        // ── Competitive range card ───────────────────────────────────────────
        let competitiveCard = '';
        const stackMarketLow = (displayMd && hasCount) ? (displayMd.marketLow * count) : null;
        if (stackMarketLow !== null) {
            const thresholds = getCompetitiveThresholds(stackMarketLow);
            const enteredGap = hasPrice ? price - stackMarketLow : null;
            const enteredGapPct = (hasPrice && stackMarketLow > 0)
                ? Math.round((enteredGap / stackMarketLow) * 100)
                : null;
            const enteredStatus = hasPrice
                ? classifyCompetitiveGap(enteredGap, enteredGapPct, stackMarketLow).status
                : null;
            const suggestionGap = suggestion?.suggestedPerStack !== null
                ? suggestion.suggestedPerStack - stackMarketLow
                : null;
            const suggestionGapPct = (suggestion?.suggestedPerStack !== null && stackMarketLow > 0)
                ? Math.round((suggestionGap / stackMarketLow) * 100)
                : null;
            const suggestionStatus = suggestion?.suggestedPerStack !== null
                ? classifyCompetitiveGap(suggestionGap, suggestionGapPct, stackMarketLow).status
                : null;

            const statusPill = !hasPrice
                ? `<span class="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-700/40 px-2 py-0.5 text-xs text-gray-300">Enter a price to compare</span>`
                : enteredStatus === 'leading'
                    ? `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300"><i class="fas fa-trophy text-[10px]"></i> Leading</span>`
                    : enteredStatus === 'competitive'
                        ? `<span class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300"><i class="fas fa-handshake text-[10px]"></i> Competitive</span>`
                        : `<span class="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-900/30 px-2 py-0.5 text-xs text-rose-300"><i class="fas fa-triangle-exclamation text-[10px]"></i> Undercut</span>`;

            const suggestionLine = suggestion?.suggestedPerStack !== null
                ? `<div class="flex justify-between gap-2 text-xs">
                        <span class="text-gray-300">Suggested status</span>
                        <span class="${suggestionStatus === 'leading' ? 'text-emerald-300' : suggestionStatus === 'competitive' ? 'text-amber-300' : 'text-rose-300'} font-semibold">${suggestionStatus === 'leading' ? 'Leading' : suggestionStatus === 'competitive' ? 'Competitive' : 'Undercut'}</span>
                   </div>`
                : '';

            competitiveCard = `
            <div class="mt-2 p-3 bg-cyan-900/15 border border-cyan-500/30 rounded-xl">
                <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-ruler-combined text-cyan-400 text-sm"></i>
                        <span class="text-cyan-300 font-semibold text-sm uppercase tracking-widest">Competitive Range</span>
                    </div>
                    <span class="text-gray-400 text-sm">${thresholds.label}</span>
                </div>
                <div class="grid md:grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Market low/stack</span>
                            <span class="text-amber-300 font-bold">${fmt(stackMarketLow)}g</span>
                        </div>
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Competitive cap</span>
                            <span class="text-white">${fmt(stackMarketLow + thresholds.maxGapGold)}g <span class="text-gray-500">(+${fmt(thresholds.maxGapGold)}g)</span></span>
                        </div>
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Percent limit</span>
                            <span class="text-white">+${thresholds.maxGapPct}%</span>
                        </div>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-gray-300 text-sm">Your entered price</span>
                            ${statusPill}
                        </div>
                        ${hasPrice ? `<div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Gap vs low</span>
                            <span class="${enteredStatus === 'leading' ? 'text-emerald-300' : enteredStatus === 'competitive' ? 'text-amber-300' : 'text-rose-300'} font-semibold whitespace-nowrap">${enteredGap > 0 ? '+' : ''}${fmt(enteredGap)}g (${enteredGapPct > 0 ? '+' : ''}${enteredGapPct}%)</span>
                        </div>` : ''}
                        ${suggestionLine}
                    </div>
                </div>
            </div>`;
        }

        // ── Quality note banner ──────────────────────────────────────────────
        let qualityBanner = '';
        if (suggestion?.qualityNote) {
            const q = suggestion.qualityNote;
            const bannerCls = q.type === 'exact'
                ? 'bg-purple-900/20 border-purple-500/40 text-purple-300'
                : q.type === 'partial'
                    ? 'bg-blue-900/20 border-blue-500/40 text-blue-300'
                    : 'bg-amber-900/20 border-amber-500/40 text-amber-300';
            const icon = q.type === 'exact' ? 'fa-check-circle' : q.type === 'partial' ? 'fa-info-circle' : 'fa-triangle-exclamation';
            qualityBanner = `<div class="mb-2 px-2.5 py-1.5 border rounded-lg ${bannerCls} text-xs flex items-center gap-2">
                <i class="fas ${icon} flex-shrink-0"></i><span>${q.text}</span></div>`;
        }

        // ── Suggested price card (prominent) ─────────────────────────────────
        let suggestionCard = '';
        if (suggestion) {
            const bubbleCls = suggestion.insightClass === 'text-rose-400'    ? 'bg-rose-400'
                            : suggestion.insightClass === 'text-amber-400'   ? 'bg-amber-400'
                            : suggestion.insightClass === 'text-emerald-400' ? 'bg-emerald-400'
                            : 'bg-gray-400';
            suggestionCard = `
            <div class="mt-2 p-3 bg-yellow-900/20 border border-yellow-500/40 rounded-xl">
                <div class="flex items-center gap-2 mb-1.5">
                    <i class="fas fa-lightbulb text-yellow-400 text-sm"></i>
                    <span class="text-yellow-300 font-semibold text-sm uppercase tracking-widest">Suggested Price</span>
                </div>
                ${suggestion.suggestedPerStack !== null && hasCount
                    ? `<div class="flex flex-wrap items-baseline gap-2 mb-1">
                           <span class="text-yellow-300 font-bold text-2xl">${fmt(suggestion.suggestedPerStack)}g</span>
                           <span class="text-gray-400 text-sm">/ stack of ${count}</span>
                           <button id="modal-use-suggested-price-btn" type="button"
                               class="px-2.5 py-1 text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/40 rounded-lg transition-colors">
                               Use this price
                           </button>
                       </div>
                       ${hasStacks ? `<div class="text-gray-300 text-sm mb-1">${stacks} stack${stacks !== 1 ? 's' : ''} &times; ${fmt(suggestion.suggestedPerStack)}g = <span class="text-yellow-200 font-bold">${fmt(suggestion.suggestedPerStack * stacks)}g</span> total</div>` : ''}
                       <div class="flex items-center gap-1.5">
                           <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${bubbleCls}"></span>
                           <span class="${suggestion.insightClass} text-sm">${suggestion.insight}</span>
                       </div>`
                    : `<span class="text-gray-400 text-sm italic">Enter stack count to see suggestion</span>`
                }
            </div>`;
        }

        // ── Impact note ──────────────────────────────────────────────────────
        let impactRow = '';
        if (suggestion?.impactNote) {
            impactRow = `
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${suggestion.impactNote.bubble}"></span>
                <span class="${suggestion.impactNote.cls} text-sm">${suggestion.impactNote.text}</span>
            </div>`;
        }

        // ── High price option (history-only, no live market data at all) ─────
        let highPriceRow = '';
        if (!md && hist?.maxPerUnit && hasCount) {
            const highPerStack = Math.round(hist.maxPerUnit * count);
            const highTotal    = hasStacks ? highPerStack * stacks : null;
            highPriceRow = `
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 pt-1.5 border-t border-slate-500/30">
                <span class="text-white text-sm font-semibold flex items-center gap-1">
                    <i class="fas fa-arrow-trend-up text-emerald-400"></i> High price option:
                </span>
                <span class="text-emerald-300 font-bold text-sm">${fmt(highPerStack)}g</span>
                <span class="text-gray-400 text-sm">/stack (${count})</span>
                <button id="modal-use-high-price-btn" type="button"
                    class="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 rounded transition-colors">Use</button>
                ${highTotal !== null ? `<span class="text-gray-400 text-sm">&rarr; <span class="text-emerald-200 font-bold">${fmt(highTotal)}g</span> total</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
                <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400"></span>
                <span class="text-emerald-400 text-sm">Your highest ever sale — no live market to undercut.</span>
            </div>`;
        }

        // ── Live price total ─────────────────────────────────────────────────
        let livePriceRow = '';
        if (hasPrice && hasStacks) {
            const liveTotal = price * stacks;
            livePriceRow = `
            <div class="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-500/30">
                <i class="fas fa-calculator text-gray-500 text-xs"></i>
                <span class="text-gray-300 text-sm">At <span class="text-white font-semibold">${fmt(price)}g</span>/stack × ${stacks} = <span class="text-cyan-300 font-bold">${fmt(liveTotal)}g</span> total</span>
            </div>`;
        }

        hintEl.innerHTML = `
            ${qualityBanner}
            <div class="flex gap-3">${marketCol}<div class="w-px bg-slate-500/40 self-stretch flex-shrink-0"></div>${histCol}</div>
            ${competitiveCard}
            ${suggestionCard}
            ${impactRow}
            ${highPriceRow}
            ${livePriceRow}`;
        hintEl.classList.remove('hidden');

        // Wire up "Use suggested price" button
        const useBtn = hintEl.querySelector('#modal-use-suggested-price-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                if (priceInput && suggestion?.suggestedPerStack !== null) {
                    priceInput.value = suggestion.suggestedPerStack;
                    priceInput.dispatchEvent(new Event('input'));
                }
            });
        }
        // Wire up "Use high price" button
        const useHighBtn = hintEl.querySelector('#modal-use-high-price-btn');
        if (useHighBtn) {
            useHighBtn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                const cnt = parseInt(document.getElementById('modal-item-count-per-stack')?.value, 10);
                if (priceInput && _addListingHistoryData?.maxPerUnit && cnt > 0) {
                    priceInput.value = Math.round(_addListingHistoryData.maxPerUnit * cnt);
                    priceInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }

    // Re-render hint when count, stacks, or price changes
    document.getElementById('modal-item-count-per-stack')?.addEventListener('input', renderAddListingHint);
    document.getElementById('modal-item-stacks')?.addEventListener('input', renderAddListingHint);
    document.getElementById('modal-item-price-per-stack')?.addEventListener('input', renderAddListingHint);
    // Re-render hint when quality toggles change (defer 10ms so hidden inputs update first)
    document.getElementById('modal-mastercrafted-btn')?.addEventListener('click', () => setTimeout(renderAddListingHint, 10));
    document.querySelectorAll('.modal-enchant-btn').forEach(b => b.addEventListener('click', () => setTimeout(renderAddListingHint, 10)));

    // Locked searchable select — replaces free-text autocomplete.
    // Users can only select from the existing item list; no free-text entry is possible.
    const setupLockedItemSelect = (inputId, suggestionsId, categorySelectId, onSelect) => {
        const searchInput = document.getElementById(inputId);
        const dropdown = document.getElementById(suggestionsId);
        if (!searchInput || !dropdown) return;

        let selectedItem = null;
        let filteredItems = allItems;
        let highlightIndex = -1;

        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '9999';
        dropdown.style.maxHeight = '220px';
        dropdown.style.overflowY = 'auto';

        const renderList = (items) => {
            dropdown.innerHTML = '';
            highlightIndex = -1;
            if (items.length === 0) {
                const noResult = document.createElement('div');
                noResult.className = 'autocomplete-no-results';
                noResult.textContent = 'No items found';
                dropdown.appendChild(noResult);
            } else {
                items.forEach((item) => {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-suggestion-item';
                    const query = searchInput.value.trim();
                    if (query) {
                        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp('(' + escaped + ')', 'gi');
                        div.innerHTML = item.item_name.replace(regex, '<strong>$1</strong>');
                    } else {
                        div.textContent = item.item_name;
                    }
                    div.addEventListener('mousedown', (e) => {
                        e.preventDefault(); // prevent blur firing before click
                        selectItem(item);
                    });
                    dropdown.appendChild(div);
                });
            }
        };

        const selectItem = (item) => {
            selectedItem = item;
            searchInput.value = item.item_name;
            searchInput.dataset.selectedItemId = item.item_id;
            searchInput.dataset.selectedPaxDeiSlug = item.pax_dei_slug || '';
            searchInput.dataset.selectedItemCategory = item.category_id || '';
            const catSelect = document.getElementById(categorySelectId);
            if (catSelect) catSelect.value = String(item.category_id);
            dropdown.style.display = 'none';
            if (onSelect) onSelect(item);
        };

        const clearSelection = () => {
            selectedItem = null;
            delete searchInput.dataset.selectedItemId;
            delete searchInput.dataset.selectedPaxDeiSlug;
            delete searchInput.dataset.selectedItemCategory;
        };

        const openDropdown = () => {
            const query = searchInput.value.trim().toLowerCase();
            filteredItems = query
                ? allItems.filter(i => i.item_name.toLowerCase().includes(query))
                : allItems;
            renderList(filteredItems);
            dropdown.style.display = 'block';
        };

        const setHighlight = (idx) => {
            const items = dropdown.querySelectorAll('.autocomplete-suggestion-item');
            items.forEach(el => el.classList.remove('highlighted'));
            if (idx >= 0 && idx < items.length) {
                items[idx].classList.add('highlighted');
                items[idx].scrollIntoView({ block: 'nearest' });
            }
            highlightIndex = idx;
        };

        searchInput.addEventListener('input', () => {
            clearSelection();
            if (searchInput.value.trim().length >= 3) {
                openDropdown();
            } else {
                dropdown.style.display = 'none';
            }
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 3) openDropdown();
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
                // Snap to exact match or revert to last confirmed selection
                if (!selectedItem || searchInput.value !== selectedItem.item_name) {
                    const exact = allItems.find(i => i.item_name.toLowerCase() === searchInput.value.toLowerCase());
                    if (exact) {
                        selectItem(exact);
                    } else {
                        searchInput.value = selectedItem ? selectedItem.item_name : '';
                    }
                }
            }, 150);
        });

        searchInput.addEventListener('keydown', (e) => {
            const visibleItems = dropdown.querySelectorAll('.autocomplete-suggestion-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight(Math.min(highlightIndex + 1, visibleItems.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight(Math.max(highlightIndex - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (highlightIndex >= 0 && filteredItems[highlightIndex]) {
                    selectItem(filteredItems[highlightIndex]);
                } else if (filteredItems.length === 1) {
                    selectItem(filteredItems[0]);
                }
            } else if (e.key === 'Escape') {
                dropdown.style.display = 'none';
                searchInput.value = selectedItem ? selectedItem.item_name : '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    };

    // ── Add Listing modal ────────────────────────────────────────────────────
    setupLockedItemSelect('modal-item-name', 'modal-item-name-suggestions', 'modal-item-category', (selectedItem) => {
        _addListingSelectedItem = selectedItem;

        let marketData = null;
        if (selectedItem.pax_dei_slug) {
            const slugData = getMarketDataForSlug(selectedItem.pax_dei_slug);
            if (slugData) {
                const slugName    = getItemNameForSlug(selectedItem.pax_dei_slug);
                const nameMatches = slugName && slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                if (nameMatches) {
                    marketData = slugData;
                } else {
                    console.warn(`[Trader] pax_dei_slug mismatch for "${selectedItem.item_name}": slug "${selectedItem.pax_dei_slug}" resolves to "${slugName}" — falling back to name lookup.`);
                }
            }
        }
        if (!marketData) marketData = getMarketDataByItemName(selectedItem.item_name);
        _addListingMarketData = marketData || null;

        const savedHash = getSavedAvatarHash();
        if (savedHash) {
            let gtItemId = null;
            if (selectedItem.pax_dei_slug) {
                const slugName  = getItemNameForSlug(selectedItem.pax_dei_slug);
                const slugValid = slugName && slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                if (slugValid) gtItemId = selectedItem.pax_dei_slug;
            }
            if (!gtItemId) gtItemId = getItemIdByName(selectedItem.item_name);
            _addListingOwnCount = gtItemId ? getOwnListingCountForSlug(savedHash, gtItemId).ownCount : 0;
        } else {
            _addListingOwnCount = 0;
        }

        if (currentCharacterId && selectedItem.item_id) {
            _addListingHistoryData   = null;
            _addListingHistoryLoading = true;
            renderAddListingHint();
            fetchItemSalesHistory(selectedItem.item_id).then((hist) => {
                _addListingHistoryData   = hist;
                _addListingHistoryLoading = false;
                renderAddListingHint();
            });
        } else {
            _addListingHistoryData   = null;
            _addListingHistoryLoading = false;
            renderAddListingHint();
        }
    });

    // ── Record Purchase modal ────────────────────────────────────────────────
    setupLockedItemSelect('modal-purchase-item-name', 'modal-purchase-item-name-suggestions', 'modal-purchase-item-category', null);

    // ── Listings filter ──────────────────────────────────────────────────────
    const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
    const filterListingItemNameSuggestions = document.getElementById('filter-listing-item-name-suggestions');
    if (filterListingItemNameInput && filterListingItemNameSuggestions) {
        setupLockedItemSelect('filter-listing-item-name', 'filter-listing-item-name-suggestions', null, (selectedItem) => {
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
