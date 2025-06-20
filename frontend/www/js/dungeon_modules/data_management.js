import { state, markChanges } from './state.js';
import { showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults, initializeUI } from './ui_updates.js';
import { supabase } from '../supabaseClient.js';

let allPaxDeiItems = [];

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

    const dungeonName = state.dungeonNameInput.value.trim();
    if (!dungeonName) {
        showFeedback("Please enter a name for your dungeon run before saving.", "error");
        return;
    }

    const runData = {
        dungeonName: dungeonName,
        partyMembers: state.partyMembers,
        lootItems: state.lootItems,
        totalGold: state.totalGold,
        nextLootRecipientIndex: state.nextLootRecipientIndex,
        reservedItems: state.reservedItems,
        userId: state.userId
    };

    try {
        localStorage.setItem(`dungeonRun_${dungeonName}`, JSON.stringify(runData));
        showFeedback(`Dungeon run "${dungeonName}" saved successfully!`, "success");
        markChanges(true);
    } catch (e) {
        console.error("Error saving dungeon run to local storage:", e);
        showFeedback("Failed to save dungeon run. Local storage might be full or unavailable.", "error");
    }
}

export function loadDungeonRun(dungeonName) {
    try {
        const runDataString = localStorage.getItem(`dungeonRun_${dungeonName}`);
        if (runDataString) {
            const runData = JSON.parse(runDataString);
            state.dungeonNameInput.value = runData.dungeonName;
            state.partyMembers = runData.partyMembers || [];
            state.lootItems = runData.lootItems || [];
            state.totalGold = runData.totalGold || 0;
            state.nextLootRecipientIndex = runData.nextLootRecipientIndex || 0;
            state.reservedItems = runData.reservedItems || {};
            state.userId = runData.userId || crypto.randomUUID();

            initializeUI();
            updatePartyMembersList();
            updateCurrentLootList();
            updateDistributionResults();

            showFeedback(`Dungeon run "${dungeonName}" loaded from local storage.`, "success");
            state.hasUnsavedChanges = false;
            return true;
        } else {
            showFeedback(`No saved run found with the name "${dungeonName}".`, "error");
            return false;
        }
    } catch (e) {
        console.error("Error loading dungeon run from local storage:", e);
        showFeedback("Failed to load dungeon run. Data might be corrupted.", "error");
        return false;
    }
}

export function listSavedDungeonRuns() {
    const runs = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('dungeonRun_')) {
            runs.push(key.substring('dungeonRun_'.length));
        }
    }
    return runs;
}

export function deleteDungeonRun(dungeonName) {
    if (confirm(`Are you sure you want to delete the run "${dungeonName}"?`)) {
        localStorage.removeItem(`dungeonRun_${dungeonName}`);
        showFeedback(`Dungeon run "${dungeonName}" deleted.`, "success");
        return true;
    }
    return false;
}

export async function generateShareCode() {
    let newCode;
    let isUnique = false;
    while (!isUnique) {
        newCode = Math.random().toString(36).substring(2, 9);
        const { data, error } = await supabase
            .from('dungeon_runs')
            .select('id')
            .eq('id', newCode)
            .single();

        if (error && error.code === 'PGRST116') {
            isUnique = true;
        } else if (data) {
            isUnique = false;
        } else {
            console.error('Error checking share code uniqueness:', error);
            showFeedback('Error generating share code. Please try again.', 'error');
            return null;
        }
    }

    const runDataToSave = {
        id: newCode,
        owner_id: state.userId,
        dungeon_name: state.dungeonNameInput ? state.dungeonNameInput.value : 'Unnamed Run',
        party_members: state.partyMembers,
        current_loot_items: state.lootItems,
        current_total_gold: state.totalGold,
        next_loot_recipient_index: state.nextLootRecipientIndex,
        reserved_items: state.reservedItems
    };

    const { error } = await supabase
        .from('dungeon_runs')
        .upsert(runDataToSave, { onConflict: 'id' });

    if (error) {
        console.error('Error saving new share code to Supabase:', error);
        showFeedback('Failed to generate and save unique share code.', 'error');
        return null;
    } else {
        state.currentShareableCode = newCode;
        if (state.shareCodeDisplay) state.shareCodeDisplay.value = newCode;
        if (state.shareCodeDisplay) state.shareCodeDisplay.classList.remove('hidden');
        if (state.copyCodeBtn) state.copyCodeBtn.classList.remove('hidden');
        showFeedback('New share code generated and saved!', 'success');

        const newUrl = window.location.origin + window.location.pathname + '#code-' + newCode;
        window.history.pushState({ path: newUrl }, '', newUrl);

        state.hasUnsavedChanges = false;
        return newCode;
    }
}

export async function loadDungeonRunFromShareCode(shareCode) {
    showFeedback(`Attempting to load run with code: ${shareCode}...`, 'info');
    try {
        const { data: supabaseData, error } = await supabase
            .from('dungeon_runs')
            .select('dungeon_name, party_members, current_loot_items, current_total_gold, next_loot_recipient_index, reserved_items, owner_id')
            .eq('id', shareCode)
            .single();

        if (error) {
            console.error('Supabase query error:', error);
            showFeedback(`Error loading run: ${error.message || 'Please try again.'}`, 'error');
            return false;
        }

        if (!supabaseData) {
            showFeedback(`No saved run found with code: ${shareCode}.`, "error");
            return false;
        }

        if (state.dungeonNameInput) {
            state.dungeonNameInput.value = supabaseData.dungeon_name || '';
        } else if (state.dungeonNameDisplay) {
            state.dungeonNameDisplay.textContent = supabaseData.dungeon_name || 'Shared Dungeon Run';
            document.title = `Dungeon Master - ${supabaseData.dungeon_name || 'Shared Run'}`;
        }

        state.partyMembers = (supabaseData.party_members || []).map(memberData => ({
            name: memberData.name || String(memberData),
            items: memberData.items || [],
            goldShare: memberData.goldShare || 0,
            reservedItems: memberData.reservedItems || []
        }));

        state.lootItems = (supabaseData.current_loot_items || []).map(itemData => ({
            name: itemData.name || String(itemData),
            slug: itemData.slug || '',
            quantity: itemData.quantity || 0
        }));

        state.totalGold = supabaseData.current_total_gold || 0;
        state.nextLootRecipientIndex = supabaseData.next_loot_recipient_index || 0;
        state.reservedItems = supabaseData.reserved_items || {};
        state.userId = supabaseData.owner_id || crypto.randomUUID();
        state.currentShareableCode = shareCode;

        initializeUI();
        updatePartyMembersList();
        updateCurrentLootList();
        updateDistributionResults();

        if (state.totalGoldDisplay) {
            state.totalGoldDisplay.textContent = state.totalGold.toLocaleString();
        }

        showFeedback(`Dungeon run "${supabaseData.dungeon_name || 'shared run'}" loaded from share code.`, "success");
        state.hasUnsavedChanges = false;
        return true;

    } catch (e) {
        console.error('Unexpected error loading run from share code:', e);
        showFeedback(`Error loading run: ${e.message || 'Please try again.'}`, 'error');
        return false;
    }
}

export async function updateDungeonRunInSupabase(shareCode) {
    if (!shareCode) {
        console.warn("No share code provided for Supabase update. Skipping.");
        return false;
    }

    const runDataToUpdate = {
        owner_id: state.userId,
        dungeon_name: state.dungeonNameInput ? state.dungeonNameInput.value : 'Unnamed Run',
        party_members: state.partyMembers,
        current_loot_items: state.lootItems,
        current_total_gold: state.totalGold,
        next_loot_recipient_index: state.nextLootRecipientIndex,
        reserved_items: state.reservedItems
    };

    const { error } = await supabase
        .from('dungeon_runs')
        .update(runDataToUpdate)
        .eq('id', shareCode);

    if (error) {
        console.error('Error updating run in Supabase:', error);
        showFeedback('Failed to update run in real-time.', 'error');
        return false;
    } else {
        console.log('Run updated in Supabase:', shareCode);
        return true;
    }
}