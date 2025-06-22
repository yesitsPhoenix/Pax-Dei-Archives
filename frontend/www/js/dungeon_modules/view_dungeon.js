import { supabase } from '../supabaseClient.js';
import { state } from './state.js';
import { initializeUI, showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults } from './ui_updates.js';

let realtimeChannel = null;

async function subscribeToDungeonRun(shareCode) {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    if (!shareCode) {
        return;
    }

    realtimeChannel = supabase
        .channel(`dungeon_run_${shareCode}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'dungeon_runs',
            filter: `id=eq.${shareCode}`
        }, (payload) => {
            const updatedRun = payload.new;

            if (state.dungeonNameDisplay) {
                state.dungeonNameDisplay.textContent = updatedRun.dungeon_name || 'Shared Dungeon Run';
                document.title = `Loot Tracker - ${updatedRun.dungeon_name || 'Shared Run'}`;
            }

            state.partyMembers = (updatedRun.party_members || []).map(memberData => ({
                name: memberData.name || String(memberData),
                items: memberData.items || [],
                goldShare: memberData.goldShare || 0,
                reservedItems: memberData.reservedItems || []
            }));

            state.lootItems = (updatedRun.current_loot_items || []).map(itemData => ({
                name: itemData.name || String(itemData),
                slug: itemData.slug || '',
                quantity: itemData.quantity || 0
            }));

            state.totalGold = updatedRun.current_total_gold || 0;
            state.nextLootRecipientIndex = updatedRun.next_loot_recipient_index || 0;
            state.reservedItems = updatedRun.reserved_items || {};

            updatePartyMembersList();
            updateCurrentLootList();
            updateDistributionResults();

            if (state.totalGoldDisplay) {
                state.totalGoldDisplay.textContent = state.totalGold.toLocaleString();
            }
        })
        .subscribe();
}

async function fetchAndDisplayDungeonRun(shareCode) {
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

        if (state.dungeonNameDisplay) {
            state.dungeonNameDisplay.textContent = supabaseData.dungeon_name || 'Shared Dungeon Run';
            document.title = `Loot Tracker - ${supabaseData.dungeon_name || 'Shared Run'}`;
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

        updatePartyMembersList();
        updateCurrentLootList();
        updateDistributionResults();

        if (state.totalGoldDisplay) {
            state.totalGoldDisplay.textContent = state.totalGold.toLocaleString();
        }

        showFeedback(`Dungeon run "${supabaseData.dungeon_name || 'shared run'}" loaded from share code.`, "success");
        return true;

    } catch (e) {
        console.error('Unexpected error loading run from share code:', e);
        showFeedback(`Error loading run: ${e.message || 'Please try again.'}`, 'error');
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    state.userId = crypto.randomUUID();

    initializeUI();

    const urlParams = new URLSearchParams(window.location.search);
    const shareCodeFromUrl = urlParams.get('code');

    if (shareCodeFromUrl) {
        await fetchAndDisplayDungeonRun(shareCodeFromUrl);
        subscribeToDungeonRun(shareCodeFromUrl);
    } else {
        showFeedback('No run code found in URL. Please use a shared link.', 'error');
        if (state.dungeonNameDisplay) state.dungeonNameDisplay.textContent = 'No Run Loaded';
        if (state.partyMembersList) state.partyMembersList.innerHTML = '<li class="text-gray-400 italic">No party members to display.</li>';
        if (state.currentLootList) state.currentLootList.innerHTML = '<li class="text-gray-400 italic">No loot to display.</li>';
        if (state.totalGoldDisplay) state.totalGoldDisplay.textContent = '0';
        if (state.distributionResults) state.distributionResults.innerHTML = '<p class="text-gray-400 italic p-2">No distribution data to display.</p>';
    }
});

window.addEventListener('beforeunload', () => {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
});