import { state, markChanges } from './state.js';
import { supabase } from '../supabaseClient.js';

export function initializeUI() {
    state.partyMembersList = document.getElementById('partyMembersList');
    state.currentLootList = document.getElementById('currentLootList');
    state.totalGoldDisplay = document.getElementById('totalGoldDisplay');
    state.distributionResults = document.getElementById('distributionResults');
    state.shareRunBtn = document.getElementById('shareRunBtn');
    state.feedbackMessage = document.getElementById('feedbackMessage');
    state.memberCount = document.getElementById('memberCount');

    if (document.getElementById('dungeonName')) {
        state.dungeonNameInput = document.getElementById('dungeonName');
        state.partyMemberNameInput = document.getElementById('partyMemberName');
        state.addMemberBtn = document.getElementById('addMemberBtn');
        state.lootItemNameInput = document.getElementById('lootItemName');
        state.lootSearchResults = document.getElementById('lootSearchResults');
        state.lootItemQuantityInput = document.getElementById('lootItemQuantity');
        state.addLootBtn = document.getElementById('addLootBtn');
        state.addGoldAmountInput = document.getElementById('addGoldAmount');
        state.addGoldBtn = document.getElementById('addGoldBtn');
        state.setGoldAmountInput = document.getElementById('setGoldAmount');
        state.setGoldBtn = document.getElementById('setGoldBtn');
        state.distributeLootBtn = document.getElementById('distributeLootBtn');
        state.distributeGoldBtn = document.getElementById('distributeGoldBtn');
        state.shareCodeDisplay = document.getElementById('shareCodeDisplay');
        state.newCodeBtn = document.getElementById('newCodeBtn');
        state.copyCodeBtn = document.getElementById('copyCodeBtn');
        state.loadCodeInput = document.getElementById('loadCodeInput');
        state.loadRunBtn = document.getElementById('loadRunBtn');
        state.reservePlayerModal = document.getElementById('reservePlayerModal');
        state.itemToReserveNameSpan = document.getElementById('itemToReserveName');
        state.reservePlayerSelectionDiv = document.getElementById('reservePlayerSelection');
        state.reserveQuantityInput = document.getElementById('reserveQuantity');
        state.confirmAllReservesBtn = document.getElementById('confirmAllReservesBtn');
        state.closeReserveModalBtn = document.getElementById('closeReserveModalBtn');
        state.closeReserveModalBtnBottom = document.getElementById('closeReserveModalBtnBottom');
    }
    else if (document.getElementById('dungeonNameDisplay')) {
        state.dungeonNameDisplay = document.getElementById('dungeonNameDisplay');
    }
}

export function showFeedback(message, type) {
    state.feedbackMessage.innerHTML = message;
    state.feedbackMessage.className = 'text-center text-sm mt-2';
    if (type === 'success') {
        state.feedbackMessage.classList.add('text-green-400');
    } else if (type === 'error') {
        state.feedbackMessage.classList.add('text-red-400');
    } else if (type === 'info') {
        state.feedbackMessage.classList.add('text-blue-400');
    }
    setTimeout(() => {
        state.feedbackMessage.innerHTML = '';
        state.feedbackMessage.className = 'text-center text-sm mt-2';
    }, 5000);
}

export function updatePartyMembersList() {
    state.partyMembersList.innerHTML = '';
    if (state.partyMembers.length === 0) {
        state.partyMembersList.innerHTML = '<li class="text-gray-400 italic">No party members added yet.</li>';
    } else {
        state.partyMembers.forEach((member, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center py-1 px-2 border-b border-gray-500 last:border-b-0 text-gray-200';
            const removeButtonHtml = document.getElementById('dungeonName') ? 
                `<button data-index="${index}" class="remove-member-btn text-red-400 hover:text-red-500 text-sm ml-2 transition duration-150 ease-in-out">Remove</button>` : '';

            listItem.innerHTML = `
                <span>${member.name}</span>
                ${removeButtonHtml}
            `;
            state.partyMembersList.appendChild(listItem);
        });
    }
    if (state.memberCount) {
        state.memberCount.textContent = state.partyMembers.length;
    }

    if (state.addMemberBtn) {
        state.addMemberBtn.disabled = state.partyMembers.length >= state.MAX_PARTY_MEMBERS;
    }
    if (state.partyMemberNameInput) {
        state.partyMemberNameInput.disabled = state.partyMembers.length >= state.MAX_PARTY_MEMBERS;
        if (state.partyMembers.length >= state.MAX_PARTY_MEMBERS) {
            state.partyMemberNameInput.placeholder = 'Party is full!';
        } else {
            state.partyMemberNameInput.placeholder = 'e.g., Sir Roland';
        }
    }
    
    if (document.getElementById('dungeonName')) {
        markChanges();
    }
}

export function refreshPaxDeiTooltips() {
    if (window.gtTooltip && typeof window.gtTooltip.refresh === 'function') {
        window.gtTooltip.refresh();
    } else if (window.gtTooltip && typeof window.gtTooltip.init === 'function') {
        window.gtTooltip.init();
    }
}

export function waitForGtTooltipAndRefresh() {
    let attempts = 0;
    const maxAttempts = 50;
    const intervalTime = 100; 

    const intervalId = setInterval(() => {
        if (window.gtTooltip && (typeof window.gtTooltip.refresh === 'function' || typeof window.gtTooltip.init === 'function')) {
            clearInterval(intervalId); 
            refreshPaxDeiTooltips(); 
            console.log('Pax Dei Tooltip script detected and refreshed!');
        } else if (attempts >= maxAttempts) {
            clearInterval(intervalId); 
            console.warn('Pax Dei Tooltip script not detected after multiple attempts.');
        }
        attempts++;
    }, intervalTime);
}

export function updateCurrentLootList() {
    state.currentLootList.innerHTML = '';
    if (state.lootItems.length === 0) {
        state.currentLootList.innerHTML = '<li class="text-gray-400 italic">No loot items added yet.</li>';
    } else {
        state.lootItems.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center py-1 px-2 border-b border-gray-500 last:border-b-0 text-gray-200';
            const paxDeiSlug = item.pax_dei_slug || item.slug;
            const quantityDisplay = item.quantity > 1 ? ` (x${item.quantity})` : '';

            const paxDeiItemUrl = paxDeiSlug ? `https://paxdei.gaming.tools/${paxDeiSlug}` : '#';

            let totalReservedForItem = 0;
            for (const player in state.reservedItems) {
                const playerReserves = state.reservedItems[player] || [];
                const reservation = playerReserves.find(res => res.item.name === item.name && res.item.slug === item.slug);
                if (reservation) {
                    totalReservedForItem += reservation.quantity;
                }
            }
            const reservedDisplay = totalReservedForItem > 0 ? ` (<span class="text-purple-400">Reserved: ${totalReservedForItem}</span>)` : '';

            const buttonsHtml = document.getElementById('dungeonName') ? `
                <div>
                    <button data-index="${index}" class="reserve-loot-btn bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs mr-2 transition duration-150 ease-in-out">Reserve</button>
                    <button data-index="${index}" class="remove-loot-btn text-red-400 hover:text-red-500 text-sm transition duration-150 ease-in-out">Remove</button>
                </div>
            ` : '';

            listItem.innerHTML = `
                <a href="${paxDeiItemUrl}" class="gt-tooltip cursor-help" target="_blank" rel="noopener noreferrer">${item.name}${quantityDisplay}${reservedDisplay}</a>
                ${buttonsHtml}
            `;
            state.currentLootList.appendChild(listItem);
        });
    }
    if (document.getElementById('dungeonName')) {
        markChanges();
    }
}

export function updateDistributionResults() {
    state.distributionResults.innerHTML = ''; 
    const logHtml = [];

    const reservedPlayers = Object.keys(state.reservedItems);
    
    // --- RESERVED ITEMS SECTION (Always show if present) ---
    if (reservedPlayers.length > 0) {
        logHtml.push(`<p class="py-1 border-b border-gray-500 text-purple-400 font-bold">--- Reserved Items ---</p>`);
        for (const member of state.partyMembers) {
            if (state.reservedItems[member.name] && state.reservedItems[member.name].length > 0) {
                state.reservedItems[member.name].forEach(res => {
                    logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-200"><strong>${member.name}</strong> has <span class="text-purple-400">"${res.item.name}" (x${res.quantity})</span></p>`);
                });
            }
        }
    }

    const nonReservedLoot = state.lootItems.filter(item => {
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
    
    // --- REMAINING UNRESERVED LOOT SECTION ---
    if (nonReservedLoot.length > 0) {
        logHtml.push(`<p class="py-1 border-b border-gray-500 text-yellow-400 font-bold mt-2">--- Remaining Unreserved Loot ---</p>`);
        nonReservedLoot.forEach(item => {
            let totalReserved = 0;
            for (const player in state.reservedItems) {
                const playerReserves = state.reservedItems[player] || [];
                const reservation = playerReserves.find(res => res.item.name === item.name && res.item.slug === item.slug);
                if (reservation) {
                    totalReserved += reservation.quantity;
                }
            }
            const remainingQty = item.quantity - totalReserved;
            if (remainingQty > 0) {
                        logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-200">"${item.name}" (x${remainingQty})</p>`);
            }
        });
    } else if (state.lootItems.length > 0 && nonReservedLoot.length === 0) {
        // All loot is either fully reserved or fully distributed/gone
        if (reservedPlayers.length > 0) {
             // Show all loot is reserved, if there were reservations
             logHtml.push(`<p class="py-1 border-b border-gray-500 text-green-400 font-bold mt-2">All current loot is reserved!</p>`);
        } else {
             // If there's loot but no nonReservedLoot and no reservations, something is already distributed/gone
             logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-400 italic mt-2">No unreserved loot remaining.</p>`);
        }
    } else {
        logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-400 italic mt-2">No loot items to track.</p>`);
    }

    // --- GOLD SECTION ---
    logHtml.push(`<p class="py-1 border-b border-gray-500 text-yellow-400 font-bold mt-2">--- Current Gold ---</p>`);
    logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-200">Total: <span class="text-yellow-400">${state.totalGold.toLocaleString()}</span></p>`);

    state.partyMembers.forEach(member => {
        logHtml.push(`<p class="py-1 border-b border-gray-500 text-gray-200"><strong>${member.name}:</strong> <span class="text-yellow-400">${(member.goldShare || 0).toLocaleString()}</span> gold</p>`);
    });

    state.distributionResults.innerHTML = logHtml.join('');
    
    if (document.getElementById('dungeonName')) {
        markChanges();
    }
}

export function showReserveModal() {
    if (!document.getElementById('dungeonName')) {
        return;
    }

    if (!state.currentItemToReserve) return;

    state.itemToReserveNameSpan.textContent = state.currentItemToReserve.name;

    const globalReserveQuantityInputDiv = document.getElementById('reserveQuantity')?.closest('div');
    if (globalReserveQuantityInputDiv) {
        globalReserveQuantityInputDiv.classList.add('hidden');
    }

    updateReservePlayerSelection();
    state.reservePlayerModal.classList.remove('hidden');
    updateConfirmButtonState();
}

export function hideReserveModal() {
    if (!document.getElementById('dungeonName')) {
        return;
    }
    
    state.reservePlayerModal.classList.add('hidden');
    state.currentItemToReserve = null;
    state.reservePlayerSelectionDiv.innerHTML = '';

    const globalReserveQuantityInputDiv = document.getElementById('reserveQuantity')?.closest('div');
    if (globalReserveQuantityInputDiv) {
        globalReserveQuantityInputDiv.classList.remove('hidden');
    }
}

export function updateReservePlayerSelection() {
    if (!document.getElementById('dungeonName')) {
        return;
    }

    state.reservePlayerSelectionDiv.innerHTML = '';
    
    if (!state.currentItemToReserve) {
        state.reservePlayerSelectionDiv.innerHTML = '<p class="text-gray-400 italic p-2">Select an item to reserve first.</p>';
        state.confirmAllReservesBtn.disabled = true;
        return;
    }

    if (state.partyMembers.length === 0) {
        state.reservePlayerSelectionDiv.innerHTML = '<p class="text-gray-400 italic p-2">Add party members to reserve items.</p>';
        state.confirmAllReservesBtn.disabled = true;
        return;
    }

    state.partyMembers.forEach(member => {
        const playerDiv = document.createElement('div');
        
        const existingReservation = (state.reservedItems[member.name] || []).find(res => 
            res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug
        );
        const initialQuantity = existingReservation ? existingReservation.quantity : 0;

        playerDiv.className = `flex items-center justify-between py-1 px-2 border-b border-gray-600 last:border-b-0 cursor-pointer hover:bg-gray-700 transition duration-150 ease-in-out ${initialQuantity > 0 ? 'bg-blue-800' : ''}`;
        playerDiv.dataset.player = member.name;

        playerDiv.innerHTML = `
            <span class="player-name-text text-gray-300 w-1/2">${member.name}</span>
            <input type="number" data-player-quantity="${member.name}" value="${initialQuantity}" min="0" max="${state.currentItemToReserve.quantity + (initialQuantity || 0)}"
                           class="player-reserve-quantity shadow appearance-none border rounded-lg py-1 px-2 bg-gray-600 text-white leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 w-1/4 text-right">
        `;
        state.reservePlayerSelectionDiv.appendChild(playerDiv);
    });
    updateConfirmButtonState();
}

export function updateConfirmButtonState() {
    if (!document.getElementById('dungeonName')) {
        return;
    }

    const playerQuantityInputs = state.reservePlayerSelectionDiv.querySelectorAll('.player-reserve-quantity');
    let totalQuantityRequested = 0;
    let anyQuantitySet = false;

    playerQuantityInputs.forEach(input => {
        const quantity = parseInt(input.value);
        if (!isNaN(quantity) && quantity > 0) {
            totalQuantityRequested += quantity;
            anyQuantitySet = true;
        }
    });

    let currentItemTotalAvailable = state.currentItemToReserve ? state.currentItemToReserve.quantity : 0;
    for (const player in state.reservedItems) {
        const reservation = (state.reservedItems[player] || []).find(res => 
            res.item.name === state.currentItemToReserve.name && res.item.slug === state.currentItemToReserve.slug
        );
        if (reservation) {
            currentItemTotalAvailable += reservation.quantity;
        }
    }

    if (!anyQuantitySet) {
        state.confirmAllReservesBtn.disabled = true;
    } else if (state.currentItemToReserve && totalQuantityRequested > currentItemTotalAvailable) {
        state.confirmAllReservesBtn.disabled = true;
        showFeedback(`Total requested (${totalQuantityRequested}) exceeds available (${currentItemTotalAvailable}).`, 'error');
    } else {
        state.confirmAllReservesBtn.disabled = false;
        if (state.feedbackMessage.textContent.includes('exceeds available')) {
             state.feedbackMessage.textContent = '';
             state.feedbackMessage.className = 'text-center text-sm mt-2';
        }
    }
}