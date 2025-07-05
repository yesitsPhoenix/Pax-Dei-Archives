import { state } from './state.js';
import { initializeUI, showFeedback } from './ui_updates.js';
import { loadDungeonRunFromShareCode, saveDungeonRun, generateShareCode, loadDungeonRun, listSavedDungeonRuns, deleteDungeonRun, fetchAllItemsForDropdown } from './data_management.js';
import { addPartyMember, removePartyMember, addLootItem, removeLootItem, addGold, setGold, distributeGold, distributeLoot, handleReserveLoot, confirmReservations, resetDungeonRunAndSaveNew } from './loot_logic.js';
import { setupEventListeners } from './event_listeners.js';

document.addEventListener('DOMContentLoaded', async () => {
    initializeUI(); 

    const hash = window.location.hash;
    let shareCodeFromUrl = null;

    if (hash.startsWith('#code-')) {
        shareCodeFromUrl = hash.substring('#code-'.length);
    }

    if (shareCodeFromUrl) {
        const loaded = await loadDungeonRunFromShareCode(shareCodeFromUrl);
        if (loaded) {
            showFeedback(`Loaded shared run: ${state.dungeonNameInput ? state.dungeonNameInput.value : 'Unnamed Run'}`, 'success');
        } else {
            window.location.hash = '';
            showFeedback('Failed to load shared run. Starting a new run.', 'error');
            resetDungeonRunAndSaveNew();
        }
    } else {

        resetDungeonRunAndSaveNew(); 
    }

    setupEventListeners({
        addPartyMember, removePartyMember, addLootItem, removeLootItem,
        addGold, setGold, distributeGold, distributeLoot, handleReserveLoot,
        confirmReservations, resetDungeonRunAndSaveNew, loadDungeonRunFromShareCode,
        generateShareCode, saveDungeonRun, loadDungeonRun, listSavedDungeonRuns, deleteDungeonRun,
        fetchAllItemsForDropdown
    });

    await fetchAllItemsForDropdown();
});