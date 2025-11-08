import { supabase } from './supabaseClient.js';
import { state, markChanges } from './dungeon_modules/state.js';
import { initializeUI, showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults, updateReservePlayerSelection, updateConfirmButtonState } from './dungeon_modules/ui_updates.js';
import { setupEventListeners } from './dungeon_modules/event_listeners.js';
import { generateShareCode, loadDungeonRunFromShareCode, saveDungeonRun, loadDungeonRun, listSavedDungeonRuns, deleteDungeonRun, fetchAllItemsForDropdown, checkRateLimitAndRecordAttempt } from './dungeon_modules/data_management.js';
import { addPartyMember, removePartyMember, addLootItem, removeLootItem, addGold, setGold, distributeLoot, distributeGold, handleReserveLoot, confirmReservations } from './dungeon_modules/loot_logic.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    state.userId = user?.id || crypto.randomUUID();

    initializeUI();

    async function resetDungeonRunAndSaveNew() {
        if (!checkRateLimitAndRecordAttempt()) {
            return;
        }
        state.dungeonNameInput.value = '';
        state.partyMembers = [];
        state.lootItems = [];
        state.totalGold = 0;
        state.nextLootRecipientIndex = 0;
        state.distributionResults.innerHTML = '';
        state.totalGoldDisplay.textContent = '0';
        state.addGoldAmountInput.value = '';
        state.setGoldAmountInput.value = '';
        state.lootItemNameInput.value = '';
        state.lootItemQuantityInput.value = '1';
        state.currentShareableCode = ''; 
        for (const player in state.reservedItems) {
            delete state.reservedItems[player];
        }

        updatePartyMembersList();
        updateCurrentLootList();
        updateReservePlayerSelection();
        updateDistributionResults();

        await generateShareCode();
    }

    setupEventListeners({
        addPartyMember, removePartyMember, addLootItem, removeLootItem,
        addGold, setGold, distributeLoot, distributeGold, handleReserveLoot,
        confirmReservations, resetDungeonRunAndSaveNew, loadDungeonRunFromShareCode,
        showFeedback, markChanges, generateShareCode, saveDungeonRun, loadDungeonRun,
        listSavedDungeonRuns, deleteDungeonRun, fetchAllItemsForDropdown,
        updatePartyMembersList, updateCurrentLootList, updateDistributionResults,
        updateReservePlayerSelection, updateConfirmButtonState, handleShareRun
    });

    const urlHash = window.location.hash;
    const codeMatch = urlHash.match(/^#code-(.+)$/);

    if (codeMatch && codeMatch[1]) {
        const shareCodeFromUrl = codeMatch[1];
        state.loadCodeInput.value = shareCodeFromUrl;
        await loadDungeonRunFromShareCode(shareCodeFromUrl);
    } else {
        state.dungeonNameInput.value = '';
        state.partyMembers = [];
        state.lootItems = [];
        state.totalGold = 0;
        state.nextLootRecipientIndex = 0;
        state.distributionResults.innerHTML = '';
        state.totalGoldDisplay.textContent = '0';
        state.currentShareableCode = '';
        state.shareCodeDisplay.value = '';
        state.shareCodeDisplay.classList.add('hidden');
        state.copyCodeBtn.classList.add('hidden');
        state.addGoldAmountInput.value = '';
        state.setGoldAmountInput.value = '';
        state.lootItemNameInput.value = '';
        state.lootItemQuantityInput.value = '1';
        for (const player in state.reservedItems) {
            delete state.reservedItems[player];
        }

        updatePartyMembersList();
        updateCurrentLootList();
        updateReservePlayerSelection();
        updateDistributionResults();
    }

    state.autoSaveInterval = setInterval(() => {
        if (state.hasUnsavedChanges) saveDungeonRun();
    }, 60 * 1000);

    function handleShareRun() {
        if (!state.currentShareableCode) {
            showFeedback("Please generate a share code first by clicking 'New Code' or 'Save'.", "info");
            return;
        }

        const viewUrl = `view_loot.html#code-${state.currentShareableCode}`;
        
        window.open(viewUrl, '_blank');
        
        showFeedback("View-only link opened in a new tab.", "success");
    }
});