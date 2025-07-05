import { state, markChanges } from './state.js';
import { showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults, showReserveModal, hideReserveModal, updateReservePlayerSelection, updateConfirmButtonState } from './ui_updates.js';
// Remove updateDungeonRunInSupabase from this import.
// If loot_logic.js needed to call it directly, it would now import it from utils.js
import { fetchAllItemsForDropdown } from './data_management.js'; 

export function addPartyMember(memberName) {
    if (!memberName || memberName.trim() === "") {
        showFeedback("Party member name cannot be empty.", "error");
        return;
    }
    const nameToAdd = memberName.trim();
    if (state.partyMembers.some(member => member.name.toLowerCase() === nameToAdd.toLowerCase())) {
        showFeedback(`Party member \"${nameToAdd}\" already exists.`, "info");
        return;
    }
    if (state.partyMembers.length >= state.MAX_PARTY_MEMBERS) {
        showFeedback('Maximum party members reached (6).', 'info');
        return;
    }

    state.partyMembers.push({ name: nameToAdd, items: [], goldShare: 0, reservedItems: [] }); 

    state.partyMemberNameInput.value = '';
    updatePartyMembersList();
    updateReservePlayerSelection();
    updateDistributionResults();
    markChanges();
    showFeedback(`Added party member: ${nameToAdd}`, 'success');
}

export function removePartyMember(index) {
    if (index < 0 || index >= state.partyMembers.length) {
        showFeedback("Invalid party member index.", "error");
        return;
    }

    const memberName = state.partyMembers[index].name;

    // Check for any reserved items by this player and return them to main loot if confirmed
    if (state.reservedItems[memberName] && state.reservedItems[memberName].length > 0) {
        const confirmReturn = confirm(`"${memberName}" has reserved items. Do you want to return them to the general loot pool before removing the player?`);
        if (confirmReturn) {
            state.reservedItems[memberName].forEach(reserved => {
                const existingLootItem = state.lootItems.find(item => item.name === reserved.item.name && item.slug === reserved.item.slug);
                if (existingLootItem) {
                    existingLootItem.quantity += reserved.quantity;
                } else {
                    state.lootItems.push({ ...reserved.item, quantity: reserved.quantity });
                }
            });
        }
        delete state.reservedItems[memberName]; // Remove player's reservations regardless of return decision
    }

    state.partyMembers.splice(index, 1);
    updatePartyMembersList();
    updateReservePlayerSelection();
    updateCurrentLootList(); // Update loot list in case items were returned
    updateDistributionResults();
    markChanges();
    showFeedback(`Removed party member: ${memberName}`, 'success');
}

export function addLootItem(itemName, quantity = 1, slug = '') {
    if (!itemName || itemName.trim() === "") {
        showFeedback("Item name cannot be empty.", "error");
        return;
    }
    const nameToAdd = itemName.trim();
    const quantityToAdd = parseInt(quantity);

    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
        showFeedback("Quantity must be a positive number.", "error");
        return;
    }

    const existingItem = state.lootItems.find(item => item.name.toLowerCase() === nameToAdd.toLowerCase() && item.slug === slug);

    if (existingItem) {
        existingItem.quantity += quantityToAdd;
    } else {
        state.lootItems.push({ name: nameToAdd, quantity: quantityToAdd, slug: slug });
    }

    state.lootItemNameInput.value = '';
    state.lootItemQuantityInput.value = '1';
    state.lootSearchResults.innerHTML = '';
    updateCurrentLootList();
    markChanges();
    showFeedback(`Added ${quantityToAdd}x ${nameToAdd} to loot!`, 'success');
}

export function removeLootItem(index) {
    if (index < 0 || index >= state.lootItems.length) {
        showFeedback("Invalid loot item index.", "error");
        return;
    }
    const removedItem = state.lootItems.splice(index, 1);
    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
    showFeedback(`Removed item: ${removedItem[0].name}`, 'success');
}

export function addGold(amount) {
    const goldToAdd = parseInt(amount);
    if (isNaN(goldToAdd) || goldToAdd <= 0) {
        showFeedback("Amount must be a positive number.", "error");
        return;
    }
    state.totalGold += goldToAdd;
    state.addGoldAmountInput.value = '';
    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
    showFeedback(`Added ${goldToAdd} gold!`, 'success');
}

export function setGold(amount) {
    const goldToSet = parseInt(amount);
    if (isNaN(goldToSet) || goldToSet < 0) {
        showFeedback("Amount must be a non-negative number.", "error");
        return;
    }
    state.totalGold = goldToSet;
    state.setGoldAmountInput.value = '';
    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
    showFeedback(`Total gold set to ${goldToSet}!`, 'success');
}

export function distributeGold() {
    if (state.partyMembers.length === 0) {
        showFeedback("No party members to distribute gold to.", "error");
        return;
    }

    const goldPerMember = state.totalGold / state.partyMembers.length;
    state.partyMembers.forEach(member => {
        member.goldShare = goldPerMember;
    });

    state.lastGoldDistributionLog = state.partyMembers.map(member => ({
        name: member.name,
        share: goldPerMember.toFixed(2)
    }));

    updateDistributionResults();
    markChanges();
    showFeedback("Gold distributed!", 'success');
}

export function distributeLoot() {
    if (state.partyMembers.length === 0) {
        showFeedback("No party members to distribute loot to.", "error");
        return;
    }

    if (state.lootItems.length === 0) {
        showFeedback("No loot to distribute.", "error");
        return;
    }

    // Initialize item distribution for each member for this round
    state.partyMembers.forEach(member => member.items = []);

    let currentLootIndex = 0;
    while (state.lootItems.length > 0) {
        const currentItem = state.lootItems[currentLootIndex];

        // Find the next recipient, skipping those with reservations for this item if quantity is met
        let nextRecipientIndex = state.nextLootRecipientIndex;
        let recipientFound = false;
        for (let i = 0; i < state.partyMembers.length; i++) {
            const memberIndex = (state.nextLootRecipientIndex + i) % state.partyMembers.length;
            const currentMember = state.partyMembers[memberIndex];
            
            // Check if this member has a reservation for the current item
            const reservedQuantity = (state.reservedItems[currentMember.name] || [])
                                        .filter(r => r.item.name === currentItem.name && r.item.slug === currentItem.slug)
                                        .reduce((sum, r) => sum + r.quantity, 0);

            // Check if member already received enough of this item from current distribution
            const receivedQuantity = (currentMember.items || [])
                                        .filter(i => i.name === currentItem.name && i.slug === currentItem.slug)
                                        .reduce((sum, i) => sum + i.quantity, 0);

            // If the member has a reservation and has not yet received their reserved quantity, prioritize them
            if (reservedQuantity > 0 && receivedQuantity < reservedQuantity) {
                nextRecipientIndex = memberIndex;
                recipientFound = true;
                break; // Found a prioritized recipient
            }
        }

        // If no prioritized recipient found, just use the regular round-robin
        if (!recipientFound) {
            nextRecipientIndex = state.nextLootRecipientIndex;
        }

        const recipient = state.partyMembers[nextRecipientIndex];

        // Add item to recipient
        const existingItemInRecipient = recipient.items.find(item => item.name === currentItem.name && item.slug === currentItem.slug);
        if (existingItemInRecipient) {
            existingItemInRecipient.quantity++;
        } else {
            recipient.items.push({ name: currentItem.name, quantity: 1, slug: currentItem.slug });
        }

        // Decrease item quantity in loot pool
        currentItem.quantity--;

        // If item quantity drops to 0, remove it from loot pool and reset index if necessary
        if (currentItem.quantity <= 0) {
            state.lootItems.splice(currentLootIndex, 1);
            // No need to increment currentLootIndex as splice shifts elements
        } else {
            currentLootIndex++; // Move to the next item if current one still has quantity
        }

        // Move to the next recipient in the general round-robin for the next distribution turn
        state.nextLootRecipientIndex = (nextRecipientIndex + 1) % state.partyMembers.length;

        // Reset currentLootIndex if we've gone through all items
        if (currentLootIndex >= state.lootItems.length && state.lootItems.length > 0) {
            currentLootIndex = 0;
        } else if (state.lootItems.length === 0) {
            currentLootIndex = 0; // All items distributed
        }
    }

    state.lastLootDistributionLog = state.partyMembers.map(member => ({
        name: member.name,
        items: member.items.map(item => `${item.quantity}x ${item.name}`)
    }));

    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
    showFeedback("Loot distributed!", 'success');
}

export function handleReserveLoot(itemName, itemSlug, itemQuantity) {
    if (!state.partyMembers || state.partyMembers.length === 0) {
        showFeedback("Add party members before reserving loot.", "error");
        return;
    }
    state.currentItemToReserve = { name: itemName, slug: itemSlug, quantity: itemQuantity };
    showReserveModal();
}

export function confirmReservations(newPlayerReservations) {
    // Collect all current reservations for the item being modified
    const currentReservationsForThisItem = {};
    for (const player in state.reservedItems) {
        const reservation = (state.reservedItems[player] || []).find(res => 
            res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug
        );
        if (reservation) {
            currentReservationsForThisItem[player] = reservation.quantity;
        }
    }

    // Calculate total reserved quantity for this item *before* changes from the modal
    const currentTotalReservedForItemBeforeChanges = Object.values(currentReservationsForThisItem).reduce((sum, q) => sum + q, 0);

    // Update state.reservedItems based on newPlayerReservations
    // First, remove existing reservations for the current item across all players
    for (const player in state.reservedItems) {
        state.reservedItems[player] = (state.reservedItems[player] || []).filter(res => 
            !(res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug)
        );
        // Clean up empty player arrays
        if (state.reservedItems[player].length === 0) {
            delete state.reservedItems[player];
        }
    }

    let totalQuantityRequestedAcrossPlayersInModal = 0;
    newPlayerReservations.forEach(({ playerName, quantityToReserve }) => {
        if (quantityToReserve > 0) {
            totalQuantityRequestedAcrossPlayersInModal += quantityToReserve;
            if (!state.reservedItems[playerName]) {
                state.reservedItems[playerName] = [];
            }
            state.reservedItems[playerName].push({ 
                item: { name: state.currentItemToReserve.name, slug: state.currentItemToReserve.slug }, 
                quantity: quantityToReserve 
            });
        }
    });

    const finalTotalReservedForThisItem = totalQuantityRequestedAcrossPlayersInModal;
    const netChangeFromLoot = finalTotalReservedForThisItem - currentTotalReservedForItemBeforeChanges;

    const originalItemIndex = state.lootItems.findIndex(item => item.name === state.currentItemToReserve.name && item.slug === state.currentItemToReserve.slug);

    if (originalItemIndex > -1) {
        state.lootItems[originalItemIndex].quantity -= netChangeFromLoot;
        if (state.lootItems[originalItemIndex].quantity <= 0) {
            state.lootItems.splice(originalItemIndex, 1);
        }
    } else {
        // This case should ideally only happen if netChangeFromLoot is negative (i.e., items were unreserved and returned to loot)
        if (netChangeFromLoot < 0) {
            state.lootItems.push({
                name: state.currentItemToReserve.name,
                slug: state.currentItemToReserve.slug,
                quantity: -netChangeFromLoot
            });
        }
    }
    
    showFeedback(`Reservations for \"${state.currentItemToReserve.name}\" updated.`, 'success');
    updateCurrentLootList();
    updateDistributionResults();
    hideReserveModal();
    markChanges();
}

export function resetDungeonRunAndSaveNew() {
    // Reset all relevant state variables to their initial empty values
    state.dungeonNameInput.value = '';
    state.partyMembers = [];
    state.lootItems = [];
    state.totalGold = 0;
    state.nextLootRecipientIndex = 0;
    state.reservedItems = {};

    // Clear any active share code
    state.currentShareableCode = '';
    if (state.shareCodeDisplay) {
        state.shareCodeDisplay.value = '';
        state.shareCodeDisplay.classList.add('hidden');
        if (state.copyCodeBtn) state.copyCodeBtn.classList.add('hidden');
    }
    
    // Clear UI elements
    updatePartyMembersList();
    updateCurrentLootList();
    updateDistributionResults();
    if (state.addGoldAmountInput) state.addGoldAmountInput.value = '';
    if (state.setGoldAmountInput) state.setGoldAmountInput.value = '';
    if (state.lootItemNameInput) state.lootItemNameInput.value = '';
    if (state.lootItemQuantityInput) state.lootItemQuantityInput.value = '1';

    // Mark changes as saved because it's a new, clean run, effectively 'saved' in its initial state
    markChanges(true); 

    // Provide feedback
    showFeedback("Started a new dungeon run!", 'info');
}