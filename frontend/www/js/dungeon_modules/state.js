import { supabase } from '../supabaseClient.js';
import { updateDungeonRun } from '../utils.js';

export const state = {
    userId: null, 
    dungeonNameInput: null,
    partyMemberNameInput: null,
    addMemberBtn: null,
    partyMembersList: null,
    memberCountSpan: null,
    lootItemNameInput: null,
    lootItemQuantityInput: null,
    addLootBtn: null,
    lootSearchResults: null,
    addGoldAmountInput: null,
    addGoldBtn: null,
    setGoldAmountInput: null,
    setGoldBtn: null,
    currentLootList: null,
    totalGoldDisplay: null,
    distributeLootBtn: null,
    distributeGoldBtn: null,
    distributionResults: null,
    shareCodeDisplay: null,
    newCodeBtn: null,
    copyCodeBtn: null,
    loadCodeInput: null,
    loadRunBtn: null,
    feedbackMessage: null,
    reservePlayerModal: null,
    closeReserveModalBtn: null,
    closeReserveModalBtnBottom: null,
    itemToReserveNameSpan: null,
    reservePlayerSelectionDiv: null,
    confirmAllReservesBtn: null,
    partyMembers: [],
    lootItems: [],
    totalGold: 0,
    nextLootRecipientIndex: 0,
    currentShareableCode: '',
    hasUnsavedChanges: false,
    autoSaveInterval: null,
    currentItemToReserve: null,
    reservedItems: {},
    allItemsForDropdown: [],
    lastLootDistributionLog: [],
    lastGoldDistributionLog: [],
    distribution_results_html: '',

    _debounceTimer: null,
    _debounceDelay: 500
};

export function markChanges(doNotDebounce = false) {
    state.hasUnsavedChanges = true;

    if (state.currentShareableCode && !doNotDebounce) {
        clearTimeout(state._debounceTimer);
        state._debounceTimer = setTimeout(async () => {
            const runData = { 
                user_id: state.userId,
                dungeon_name: state.dungeonNameInput ? state.dungeonNameInput.value : 'Unnamed Run',
                party_members: state.partyMembers,
                current_loot_items: state.lootItems,
                current_total_gold: state.totalGold,
                next_loot_recipient_index: state.nextLootRecipientIndex,
                reserved_items: state.reservedItems
            };
            const updated = await updateDungeonRun(state.currentShareableCode, runData);
            if (updated) {
                state.hasUnsavedChanges = false;
                console.log('Auto-saved changes to shared run.');

            } else {
                console.error('Auto-save failed for shared run.');
            }
        }, state._debounceDelay);
    } else if (!state.currentShareableCode && !doNotDebounce) {
    }
}