import { updateDungeonRunInSupabase } from './data_management.js';

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
            const success = await updateDungeonRunInSupabase(state.currentShareableCode);
            if (success) {
                state.hasUnsavedChanges = false;
            }
        }, state._debounceDelay);
    }
}