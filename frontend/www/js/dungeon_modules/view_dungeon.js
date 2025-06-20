import { supabase } from '../supabaseClient.js';
import { state } from './state.js';
import { initializeUI, showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults } from './ui_updates.js';
import { loadDungeonRunFromShareCode } from './data_management.js';

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
                document.title = `Dungeon Tracker - ${updatedRun.dungeon_name || 'Shared Run'}`;
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

            // showFeedback("Dungeon run updated in real-time!", "info");
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', async () => {
    state.userId = crypto.randomUUID();

    initializeUI();

    const urlHash = window.location.hash;
    const codeMatch = urlHash.match(/^#code-(.+)$/);
    let shareCodeFromUrl = null;

    if (codeMatch && codeMatch[1]) {
        shareCodeFromUrl = codeMatch[1];
        await loadDungeonRunFromShareCode(shareCodeFromUrl);
        subscribeToDungeonRun(shareCodeFromUrl);
    } else {
        showFeedback('No run code found in URL. Please use a shared link.', 'error');
        state.dungeonNameDisplay.textContent = 'No Run Loaded';
        state.partyMembersList.innerHTML = '<li class="text-gray-400 italic">No party members to display.</li>';
        state.currentLootList.innerHTML = '<li class="text-gray-400 italic">No loot to display.</li>';
        state.totalGoldDisplay.textContent = '0';
        state.distributionResults.innerHTML = '<p class="text-gray-400 italic p-2">No distribution data to display.</p>';
    }

    window.addEventListener('hashchange', async () => {
        const newUrlHash = window.location.hash;
        const newCodeMatch = newUrlHash.match(/^#code-(.+)$/);
        if (newCodeMatch && newCodeMatch[1]) {
            const newShareCode = newCodeMatch[1];
            await loadDungeonRunFromShareCode(newShareCode);
            subscribeToDungeonRun(newShareCode);
        } else {
            showFeedback('Run code removed from URL. Displaying empty state.', 'info');
            state.dungeonNameDisplay.textContent = 'No Run Loaded';
            state.partyMembers = [];
            state.lootItems = [];
            state.totalGold = 0;
            state.reservedItems = {};
            state.partyMembersList.innerHTML = '<li class="text-gray-400 italic">No party members to display.</li>';
            state.currentLootList.innerHTML = '<li class="text-gray-400 italic">No loot to display.</li>';
            state.totalGoldDisplay.textContent = '0';
            state.distributionResults.innerHTML = '<p class="text-gray-400 italic p-2">No distribution data to display.</p>';
            updatePartyMembersList();
            updateCurrentLootList();
            updateDistributionResults();
            subscribeToDungeonRun(null);
        }
    });
});

window.addEventListener('beforeunload', () => {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
});