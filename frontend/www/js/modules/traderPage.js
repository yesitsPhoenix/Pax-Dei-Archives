export function createTraderPageController({
    supabase,
    getCurrentCharacterId,
    getCurrentCharacter,
    fetchCharacterActivity,
    processCharacterActivityData,
    renderDashboard,
    renderMarketPulse,
    renderSalesChart,
    renderPVEChart,
    loadTransactionHistory,
    loadActiveListings,
    populateMarketStallDropdown,
    setupMarketStallTabs,
    clearMarketStallsCache,
    modalMarketStallLocationSelect,
    getActiveStallId,
    clearZoneData,
    loadZoneDataForCharacter,
    hashAvatarId,
    getSavedAvatarHash,
    saveAvatarHash,
    clearAvatarHash,
    findOwnListings,
    summarizeOwnListings,
    showCustomModal,
    fetchAllItemsForDropdown,
    initializeAutocomplete,
    initializeCustomModal,
    checkUser,
    getAllCharacterActivityData,
    setAllCharacterActivityData,
    initializeTraderModals
}) {
    async function populateItemData() {
        try {
            const allItems = await fetchAllItemsForDropdown();
            initializeAutocomplete(allItems);
        } catch (err) {
            console.error('An unexpected error occurred while fetching item data:', err);
        }
    }

    function updateAllCharts(timeframe) {
        const allCharacterActivityData = getAllCharacterActivityData();
        if (allCharacterActivityData) {
            renderSalesChart(allCharacterActivityData, timeframe);
            renderPVEChart(allCharacterActivityData, timeframe);
        } else {
            renderSalesChart([], timeframe);
            renderPVEChart([], timeframe);
        }
    }

    function clearTraderPageUI() {
        renderDashboard({}, null, []);
        loadTransactionHistory([]);
        if (document.querySelector('.market-stall-tabs')) {
            document.querySelector('.market-stall-tabs').innerHTML = '<p class="text-gray-600 text-center py-4">Select a character to manage market stalls.</p>';
        }
        if (document.querySelector('.tab-content-container')) {
            document.querySelector('.tab-content-container').innerHTML = '';
        }
    }

    async function loadTraderPageData(reloadActiveListings = true) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const currentCharacterId = getCurrentCharacterId();

        if (!currentCharacterId) {
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

            const allCharacterActivityData = processCharacterActivityData(rawActivityData);
            setAllCharacterActivityData(allCharacterActivityData);

            await renderDashboard(dashboardStatsResult.data ? dashboardStatsResult.data[0] : {}, currentCharacterData, allCharacterActivityData);
            loadTransactionHistory(allCharacterActivityData);
            updateAllCharts('daily');
            if (modalMarketStallLocationSelect) {
                await populateMarketStallDropdown(modalMarketStallLocationSelect);
            }
            await setupMarketStallTabs();

            clearZoneData();
            if (currentCharacterData?.shard && currentCharacterData?.province && currentCharacterData?.home_valley) {
                renderMarketPulse(null, null, currentCharacterData, true);
                loadZoneDataForCharacter(currentCharacterData).then(async (result) => {
                    if (!result) {
                        renderMarketPulse(null, null, currentCharacterData, false,
                            'Market data unavailable for this zone. The zone may not be tracked yet.');
                        return;
                    }

                    const activeStallId = getActiveStallId();
                    await loadActiveListings(activeStallId);
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
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    async function handleDiscordLogin() {
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
            const traderLoginError = document.getElementById('traderLoginError');
            if (traderLoginError) {
                traderLoginError.textContent = 'Login failed: ' + error.message;
                traderLoginError.style.display = 'block';
            }
        }
    }

    function setupChartTimeframeListeners() {
        document.getElementById('viewDaily')?.addEventListener('click', () => updateAllCharts('daily'));
        document.getElementById('viewWeekly')?.addEventListener('click', () => updateAllCharts('weekly'));
        document.getElementById('viewMonthly')?.addEventListener('click', () => updateAllCharts('monthly'));
    }

    function setupAvatarIdListeners() {
        const input = document.getElementById('avatar-id-input');
        const hashBtn = document.getElementById('avatar-id-hash-btn');
        const clearBtn = document.getElementById('avatar-id-clear-btn');
        const statusEl = document.getElementById('avatar-id-status');

        if (!input || !hashBtn || !clearBtn) return;

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
                const character = await getCurrentCharacter();
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
            const section = document.getElementById('market-pulse-section');
            if (section) {
                const ownRow = section.querySelector('.market-pulse-own-row');
                if (ownRow) ownRow.classList.add('hidden');
            }
        });
    }

    function initializePageListeners() {
        const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
        const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');

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
        initializeTraderModals();
        setupAvatarIdListeners();
    }

    async function initializePage() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const traderPages = ['ledger.html', 'trader.html'];
        if (!traderPages.includes(currentPage)) return;

        window.customModalElements = initializeCustomModal();

        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        await checkUser();
        await populateItemData();
        initializePageListeners();
    }

    return {
        initializePage,
        loadTraderPageData,
        updateAllCharts
    };
}
