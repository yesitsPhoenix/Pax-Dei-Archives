import { state, markChanges } from './state.js';
import { showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults, initializeUI } from './ui_updates.js';
import { supabase } from '../supabaseClient.js';
import { updateDungeonRun } from '../utils.js'; 

let allPaxDeiItems = [];

const CODE_LIMIT_PER_HOUR = 10;
const HOUR_IN_MS = 60 * 60 * 1000;
const LOCAL_STORAGE_KEY_PREFIX = 'run_creation_history_';

export async function fetchAllItemsForDropdown() {
    if (allPaxDeiItems.length > 0) {
        return allPaxDeiItems;
    }
    try {
        const { data, error } = await supabase
            .from('items')
            .select('item_name, pax_dei_slug');

        if (error) {
            throw new Error(error.message);
        }

        if (!data) {
            allPaxDeiItems = [];
            return [];
        }

        allPaxDeiItems = data.map(item => ({
            name: item.item_name,
            slug: item.pax_dei_slug
        }));
        return allPaxDeiItems;
    } catch (error) {
        console.error("Could not fetch items from Supabase:", error);
        showFeedback("Failed to load item list for autocomplete. Please check your database connection and RLS policies.", "error");
        return [];
    }
}

export function saveDungeonRun() {
    if (!document.getElementById('dungeonName')) {
        showFeedback("Save functionality is only available on the main dungeon page.", "error");
        return;
    }

    const runData = { 
        user_id: state.userId,
        dungeon_name: state.dungeonNameInput ? state.dungeonNameInput.value : 'Unnamed Run',
        party_members: state.partyMembers,
        current_loot_items: state.lootItems,
        current_total_gold: state.totalGold,
        next_loot_recipient_index: state.nextLootRecipientIndex,
        reserved_items: state.reservedItems
    };

    if (state.currentShareableCode) {
        updateDungeonRun(state.currentShareableCode, runData)
            .then(updatedData => {
                if (updatedData) {
                    showFeedback(`Dungeon run "${runData.dungeon_name}" updated remotely!`, 'success');
                    markChanges(true);
                } else {
                    showFeedback(`Failed to update run remotely: ${runData.dungeon_name}`, 'error');
                }
            })
            .catch(error => {
                console.error('Error updating run remotely:', error);
                showFeedback(`Error updating run remotely: ${error.message}`, 'error');
            });
        return; 
    }

    const runName = runData.dungeon_name; 
    const savedRuns = JSON.parse(localStorage.getItem('dungeonRuns') || '{}');

    savedRuns[runName] = runData; 

    localStorage.setItem('dungeonRuns', JSON.stringify(savedRuns));
    showFeedback(`Dungeon run "${runName}" saved locally!`, 'success');
    markChanges(true); 
}

export async function generateShareCode() {
    if (state.currentShareableCode) {
        showFeedback("This run already has a share code.", "info");
        return state.currentShareableCode;
    }

    const newShareCode = crypto.randomUUID();
    const runDataToSave = {
        id: newShareCode,
        user_id: state.userId,
        dungeon_name: state.dungeonNameInput.value || 'Unnamed Run',
        party_members: state.partyMembers,
        current_loot_items: state.lootItems,
        current_total_gold: state.totalGold,
        next_loot_recipient_index: state.nextLootRecipientIndex,
        reserved_items: state.reservedItems
    };

    const { data, error } = await supabase
        .from('dungeon_runs')
        .insert([runDataToSave])
        .select();

    if (error) {
        console.error('Error generating share code and saving run:', error);
        showFeedback(`Error generating share code: ${error.message}`, "error");
        return null;
    } else {
        state.currentShareableCode = newShareCode;
        
        if (state.shareCodeDisplay) {
            state.shareCodeDisplay.value = newShareCode;
            state.shareCodeDisplay.classList.remove('hidden');
        }
        if (state.copyCodeBtn) {
            state.copyCodeBtn.classList.remove('hidden');
        }

        showFeedback(`Share code generated! Share this link: <a href="loot.html#code-${newShareCode}" target="_blank" class="text-blue-400 hover:text-blue-300">${newShareCode}</a>`, "success");
        markChanges(true);
        return newShareCode;
    }
}

export function loadDungeonRun(runName) {
    const savedRuns = JSON.parse(localStorage.getItem('dungeonRuns') || '{}');
    const runToLoad = savedRuns[runName];

    if (runToLoad) {
        state.currentShareableCode = ''; 

        if (state.dungeonNameInput) {
            state.dungeonNameInput.value = runToLoad.dungeon_name || 'Unnamed Run';
        }

        state.partyMembers = runToLoad.party_members || [];
        state.lootItems = runToLoad.current_loot_items || [];
        state.totalGold = runToLoad.current_total_gold || 0;
        state.nextLootRecipientIndex = runToLoad.next_loot_recipient_index || 0;
        state.reservedItems = runToLoad.reserved_items || {};

        updatePartyMembersList();
        updateCurrentLootList();
        updateDistributionResults();
        markChanges(true);
        showFeedback(`Dungeon run "${runName}" loaded from local storage!`, 'success');
        return true;
    } else {
        showFeedback(`No locally saved run found with name: ${runName}.`, 'error');
        return false;
    }
}

export function listSavedDungeonRuns() {
    const savedRuns = JSON.parse(localStorage.getItem('dungeonRuns') || '{}');
    return Object.keys(savedRuns);
}

export function deleteDungeonRun(runName) {
    if (confirm(`Are you sure you want to delete the dungeon run "${runName}"? This action cannot be undone.`)) {
        const savedRuns = JSON.parse(localStorage.getItem('dungeonRuns') || '{}');
        if (savedRuns[runName]) {
            delete savedRuns[runName];
            localStorage.setItem('dungeonRuns', JSON.stringify(savedRuns));
            showFeedback(`Dungeon run "${runName}" deleted locally.`, 'success');
            return true;
        } else {
            showFeedback(`No locally saved run found with name: ${runName}.`, 'error');
            return false;
        }
    }
    return false;
}

export async function loadDungeonRunFromShareCode(shareCode) {
    if (!shareCode) {
        showFeedback('No share code provided.', 'error');
        return false;
    }

    try {
        const { data: supabaseData, error } = await supabase
            .from('dungeon_runs')
            .select('*')
            .eq('id', shareCode)
            .single();

        if (error && error.code === 'PGRST116') { 
            showFeedback(`No saved run found with code: ${shareCode}.`, "error");
            state.currentShareableCode = ''; 
            return false;
        } else if (error) {
            console.error('Error loading run from Supabase:', error);
            showFeedback(`Error loading run: ${error.message || 'Please try again.'}`, 'error');
            return false;
        }

        if (!supabaseData) {
            showFeedback(`No saved run found with code: ${shareCode}.`, "error");
            state.currentShareableCode = ''; 
            return false;
        }

        if (state.dungeonNameInput) {
            state.dungeonNameInput.value = supabaseData.dungeon_name || 'Unnamed Run'; 
        }
        state.partyMembers = supabaseData.party_members || [];
        state.lootItems = supabaseData.current_loot_items || [];
        state.totalGold = supabaseData.current_total_gold || 0;
        state.nextLootRecipientIndex = supabaseData.next_loot_recipient_index || 0;
        state.reservedItems = supabaseData.reserved_items || {};
        state.currentShareableCode = shareCode; 

        updatePartyMembersList();
        updateCurrentLootList();
        updateDistributionResults();
        markChanges(true); 
        return true;

    } catch (e) {
        console.error('Unexpected error loading run from share code:', e);
        showFeedback(`Error loading run: ${e.message || 'Please try again.'}`, 'error');
        state.currentShareableCode = ''; 
        return false;
    }
}

export function checkRateLimitAndRecordAttempt() {
    const storageKey = LOCAL_STORAGE_KEY_PREFIX + state.userId;
    const now = Date.now();
    
    const historyJson = localStorage.getItem(storageKey);
    let history = historyJson ? JSON.parse(historyJson) : [];

    history = history.filter(timestamp => now - timestamp < HOUR_IN_MS);

    if (history.length >= CODE_LIMIT_PER_HOUR) {
        showFeedback(`Rate limit exceeded: You can only create ${CODE_LIMIT_PER_HOUR} new share codes per hour. Please wait.`, 'error');
        return false;
    }

    history.push(now);
    localStorage.setItem(storageKey, JSON.stringify(history));

    return true;
}