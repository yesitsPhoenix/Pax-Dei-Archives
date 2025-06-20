import { state, markChanges } from './state.js';
import { showFeedback, updatePartyMembersList, updateCurrentLootList, updateDistributionResults, showReserveModal, hideReserveModal, updateReservePlayerSelection, updateConfirmButtonState } from './ui_updates.js';
import { fetchAllItemsForDropdown, updateDungeonRunInSupabase } from './data_management.js';

export function addPartyMember(memberName) {
    if (!memberName || memberName.trim() === "") {
        showFeedback("Party member name cannot be empty.", "error");
        return;
    }
    const nameToAdd = memberName.trim();
    if (state.partyMembers.some(member => member.name.toLowerCase() === nameToAdd.toLowerCase())) {
        showFeedback(`Party member "${nameToAdd}" already exists.`, "info");
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
        showFeedback("Invalid party member selected for removal.", "error");
        return;
    }

    const removedMember = state.partyMembers.splice(index, 1)[0];
    const removedMemberName = removedMember.name;

    if (state.reservedItems[removedMemberName]) {
        delete state.reservedItems[removedMemberName];
    }
    
    if (state.nextLootRecipientIndex >= state.partyMembers.length && state.partyMembers.length > 0) {
        state.nextLootRecipientIndex = 0;
    } else if (state.partyMembers.length === 0) {
        state.nextLootRecipientIndex = 0;
    }

    updatePartyMembersList();
    updateCurrentLootList();
    updateReservePlayerSelection();
    updateDistributionResults();
    markChanges();
    showFeedback(`Removed party member: ${removedMemberName}`, 'info');
}


export function addLootItem(itemName, itemQuantity) {
    if (!itemName || itemName.trim() === "") {
        showFeedback("Loot item name cannot be empty.", "error");
        return;
    }

    if (isNaN(itemQuantity) || itemQuantity <= 0) {
        itemQuantity = 1;
        if (state.lootItemQuantityInput) {
            state.lootItemQuantityInput.value = '1';
        }
    }

    const trimmedItemName = itemName.trim();
    const selectedSearchResult = state.lootSearchResults.querySelector(`div[data-item-name="${trimmedItemName}"]`);
    const itemSlug = selectedSearchResult ? selectedSearchResult.dataset.slug : trimmedItemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');

    const existingItemIndex = state.lootItems.findIndex(item => item.name.toLowerCase() === trimmedItemName.toLowerCase());
    
    if (existingItemIndex > -1) {
        state.lootItems[existingItemIndex].quantity += itemQuantity;
        showFeedback(`Added ${itemQuantity} to existing "${trimmedItemName}". Total: ${state.lootItems[existingItemIndex].quantity}`, 'info');
    } else {
        state.lootItems.push({ name: trimmedItemName, slug: itemSlug, quantity: itemQuantity });
        showFeedback(`Added ${itemQuantity} x "${trimmedItemName}".`, 'success');
    }
    
    if (state.lootItemNameInput) state.lootItemNameInput.value = '';
    if (state.lootItemQuantityInput) state.lootItemQuantityInput.value = '1';
    if (state.lootSearchResults) state.lootSearchResults.classList.add('hidden');

    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
}

export function removeLootItem(index) {
    if (index < 0 || index >= state.lootItems.length) {
        showFeedback("Invalid loot item selected for removal.", "error");
        return;
    }
    const removedItem = state.lootItems.splice(index, 1)[0];
    
    for (const player in state.reservedItems) {
        state.reservedItems[player] = state.reservedItems[player].filter(reserved => 
            !(reserved.item.name === removedItem.name && reserved.item.slug === removedItem.slug)
        );
        if (state.reservedItems[player].length === 0) {
            delete state.reservedItems[player];
        }
    }
    updateCurrentLootList();
    updateDistributionResults();
    markChanges();
    showFeedback(`Removed "${removedItem.name}".`, 'info');
}

export function addGold(goldAmount) {
    const amount = parseInt(goldAmount);
    if (!isNaN(amount) && amount > 0) {
        state.totalGold += amount;
        if (state.totalGoldDisplay) {
            state.totalGoldDisplay.textContent = state.totalGold.toLocaleString();
        }
        if (state.addGoldAmountInput) {
            state.addGoldAmountInput.value = '';
        }
        updateDistributionResults();
        markChanges();
        showFeedback(`Added ${amount.toLocaleString()} gold. Total: ${state.totalGold.toLocaleString()}`, 'success');
    } else {
        showFeedback('Please enter a valid positive gold amount to add.', 'error');
    }
}

export function setGold(goldAmount) {
    const amount = parseInt(goldAmount);
    if (!isNaN(amount) && amount >= 0) {
        state.totalGold = amount;
        if (state.totalGoldDisplay) {
            state.totalGoldDisplay.textContent = state.totalGold.toLocaleString();
        }
        if (state.setGoldAmountInput) {
            state.setGoldAmountInput.value = '';
        }
        updateDistributionResults();
        markChanges(); 
        showFeedback(`Set total gold to ${amount.toLocaleString()}.`, 'success');
    } else {
        showFeedback('Please enter a valid non-negative gold amount to set.', 'error');
    }
}

export async function distributeGold() {
    if (state.partyMembers.length === 0) {
        showFeedback('Please add party members first to distribute gold!', 'error');
        return;
    }
    if (state.totalGold === 0) {
        showFeedback('No gold to distribute!', 'info');
        return;
    }

    const goldPerMember = Math.floor(state.totalGold / state.partyMembers.length);
    let remainingGold = state.totalGold % state.partyMembers.length;
    const totalGoldForLog = state.totalGold;

    let distributionHtmlLog = '';
    state.lastGoldDistributionLog = [];

    const timestamp = new Date().toLocaleString();
    const headerHtml = `<p class="py-1 border-b border-gray-500 text-yellow-400 font-bold mt-2">--- Gold Distribution Event (${timestamp}) ---</p>`;
    distributionHtmlLog += headerHtml;
    state.lastGoldDistributionLog.push({ type: 'header', text: headerHtml, timestamp: timestamp });

    const totalGoldEntryHtml = `<p class="py-1 border-b border-gray-500 text-gray-200">Total Gold Distributed: <span class="text-yellow-400">${totalGoldForLog.toLocaleString()}</span></p>`;
    distributionHtmlLog += totalGoldEntryHtml;
    state.lastGoldDistributionLog.push({ type: 'total_gold', amount: totalGoldForLog, timestamp: new Date().toLocaleString() });

    const basePerMemberHtml = `<p class="py-1 border-b border-gray-500 text-gray-200">Each member received a base of: <span class="text-yellow-400">${goldPerMember.toLocaleString()}</span> gold.</p>`;
    distributionHtmlLog += basePerMemberHtml;
    state.lastGoldDistributionLog.push({ type: 'base_gold_per_member', amount: goldPerMember, timestamp: new Date().toLocaleString() });


    state.partyMembers.forEach((member) => { 
        let memberGold = goldPerMember;
        if (remainingGold > 0) {
            memberGold += 1;
            remainingGold--;
        }
        member.goldShare += memberGold;
        const memberLogHtml = `<strong>${member.name}</strong> received: <span class="text-yellow-400">${memberGold.toLocaleString()}</span> gold. (Total: ${member.goldShare.toLocaleString()})`;
        distributionHtmlLog += `<p>${memberLogHtml}</p>`;
        state.lastGoldDistributionLog.push({
            type: 'member_gold',
            memberName: member.name,
            amount: memberGold,
            totalMemberGold: member.goldShare,
            timestamp: new Date().toLocaleString()
        });
    });

    state.totalGold = 0;
    if (state.totalGoldDisplay) {
        state.totalGoldDisplay.textContent = state.totalGold.toLocaleString(); 
    }
    state.distribution_results_html = (state.distribution_results_html || '') + distributionHtmlLog;

    showFeedback('Gold distributed successfully!', 'success');
    updateDistributionResults();
    markChanges();

    if (state.currentShareableCode) {
        await updateDungeonRunInSupabase(state.currentShareableCode);
    } else {
        showFeedback("Gold distributed locally, but not saved to shared run (no share code).", "info");
    }
}

export async function distributeLoot() {
    if (state.partyMembers.length === 0) {
        showFeedback('Please add party members first to distribute loot!', 'error');
        return;
    }
    const unreservedLootItems = state.lootItems.filter(item => {
        let totalReserved = 0;
        for (const player in state.reservedItems) {
            const playerReserves = state.reservedItems[player] || [];
            const reservation = playerReserves.find(res => res.item.name === item.name && res.item.slug === item.slug);
            if (reservation) {
                totalReserved += reservation.quantity;
            }
        }
        return item.quantity > totalReserved;
    });

    if (unreservedLootItems.length === 0) {
        showFeedback('No unreserved loot items to distribute!', 'info');
        return;
    }

    const itemsToDistributeIndividual = [];
    state.lootItems = state.lootItems.map(item => {
        let totalReserved = 0;
        for (const player in state.reservedItems) {
            const playerReserves = state.reservedItems[player] || [];
            const reservation = playerReserves.find(res => res.item.name === item.name && res.item.slug === item.slug);
            if (reservation) {
                totalReserved += reservation.quantity;
            }
        }
        const quantityToDistribute = item.quantity - totalReserved;
        for (let i = 0; i < quantityToDistribute; i++) {
            itemsToDistributeIndividual.push({ name: item.name, slug: item.slug });
        }
        return { ...item, quantity: totalReserved };
    }).filter(item => item.quantity > 0);

    for (let i = itemsToDistributeIndividual.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsToDistributeIndividual[i], itemsToDistributeIndividual[j]] = [itemsToDistributeIndividual[j], itemsToDistributeIndividual[i]];
    }

    let distributionHtmlLog = '';
    state.lastLootDistributionLog = [];

    if (itemsToDistributeIndividual.length > 0) {
        const timestamp = new Date().toLocaleString();
        const headerHtml = `<p class="py-1 border-b border-gray-500 text-yellow-400 font-bold mt-2">--- Loot Distribution Event (${timestamp}) ---</p>`;
        distributionHtmlLog += headerHtml;
        state.lastLootDistributionLog.push({ type: 'header', text: headerHtml, timestamp: timestamp });
    }

    let currentMemberIndex = state.nextLootRecipientIndex % state.partyMembers.length;
    while (itemsToDistributeIndividual.length > 0) {
        const item = itemsToDistributeIndividual.shift();
        const recipient = state.partyMembers[currentMemberIndex];
        if (!recipient.items) {
            recipient.items = [];
        }
        const existingRecipientItem = recipient.items.find(ri => ri.name === item.name && ri.slug === item.slug);
        if (existingRecipientItem) {
            existingRecipientItem.quantity = (existingRecipientItem.quantity || 1) + 1;
        } else {
            recipient.items.push({ name: item.name, slug: item.slug, quantity: 1 });
        }

        const logEntryHtml = `<strong>${recipient.name}</strong> receives <span class="text-green-300">"${item.name}"</span>`;
        distributionHtmlLog += `<p>${logEntryHtml}</p>`;
        state.lastLootDistributionLog.push({
            type: 'item_received',
            itemName: item.name,
            itemSlug: item.slug,
            recipient: recipient.name,
            timestamp: new Date().toLocaleString()
        });
        currentMemberIndex = (currentMemberIndex + 1) % state.partyMembers.length;
    }

    state.nextLootRecipientIndex = currentMemberIndex;
    state.distribution_results_html = (state.distribution_results_html || '') + distributionHtmlLog;

    showFeedback('Unreserved loot distributed successfully!', 'success');
    updateCurrentLootList();
    updateDistributionResults();
    markChanges();

    if (state.currentShareableCode) {
        await updateDungeonRunInSupabase(state.currentShareableCode);
    } else {
        showFeedback("Loot distributed locally, but not saved to shared run (no share code).", "info");
    }
}

export function handleReserveLoot(item) {
    state.currentItemToReserve = item;
    showReserveModal();
}

export function confirmReservations() {
    if (!state.currentItemToReserve) return;

    const playerQuantityInputs = state.reservePlayerSelectionDiv.querySelectorAll('.player-reserve-quantity');
    let totalQuantityRequestedAcrossPlayersInModal = 0;
    const newPlayerReservations = []; 

    playerQuantityInputs.forEach(input => {
        const playerName = input.dataset.playerQuantity;
        const quantityToReserve = parseInt(input.value);
        if (!isNaN(quantityToReserve) && quantityToReserve > 0) {
            totalQuantityRequestedAcrossPlayersInModal += quantityToReserve;
            newPlayerReservations.push({ playerName, quantityToReserve });
        }
    });

    let currentItemTotalAvailable = state.currentItemToReserve.quantity;
    let currentTotalReservedForItemBeforeChanges = 0;

    for (const player in state.reservedItems) {
        const reservation = (state.reservedItems[player] || []).find(res => 
            res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug
        );
        if (reservation) {
            currentTotalReservedForItemBeforeChanges += reservation.quantity;
        }
    }
    const overallTotalAvailable = currentItemTotalAvailable + currentTotalReservedForItemBeforeChanges;


    if (totalQuantityRequestedAcrossPlayersInModal > overallTotalAvailable) {
        showFeedback(`Cannot reserve ${totalQuantityRequestedAcrossPlayersInModal}. Only ${overallTotalAvailable} available.`, 'error');
        return;
    }

    for (const member of state.partyMembers) {
        const memberObj = state.partyMembers.find(pm => pm.name === member.name);
        if (memberObj && state.reservedItems[memberObj.name]) {
            state.reservedItems[memberObj.name] = state.reservedItems[memberObj.name].filter(res =>
                !(res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug)
            );
            if (state.reservedItems[memberObj.name].length === 0) {
                delete state.reservedItems[memberObj.name];
            }
        }
    }

    newPlayerReservations.forEach(({ playerName, quantityToReserve }) => {
        if (!state.reservedItems[playerName]) {
            state.reservedItems[playerName] = [];
        }
        state.reservedItems[playerName].push({ 
            item: { name: state.currentItemToReserve.name, slug: state.currentItemToReserve.slug }, 
            quantity: quantityToReserve 
        });
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
        if (netChangeFromLoot < 0) {
            state.lootItems.push({
                name: state.currentItemToReserve.name,
                slug: state.currentItemToReserve.slug,
                quantity: -netChangeFromLoot
            });
        }
    }
    
    showFeedback(`Reservations for "${state.currentItemToReserve.name}" updated.`, 'success');
    updateCurrentLootList();
    updateDistributionResults();
    hideReserveModal();
    markChanges();
}