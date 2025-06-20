import { state, markChanges } from './state.js';
import { hideReserveModal, updatePartyMembersList, updateCurrentLootList, updateReservePlayerSelection, updateConfirmButtonState, updateDistributionResults, showFeedback } from './ui_updates.js';

export function setupEventListeners({
    addPartyMember, removePartyMember, addLootItem, removeLootItem,
    addGold, setGold, distributeGold, distributeLoot, handleReserveLoot,
    confirmReservations, resetDungeonRunAndSaveNew, loadDungeonRunFromShareCode,
    generateShareCode, saveDungeonRun, loadDungeonRun, listSavedDungeonRuns, deleteDungeonRun,
    fetchAllItemsForDropdown
}) {
    if (document.getElementById('dungeonName')) {
        if (state.dungeonNameInput) {
            state.dungeonNameInput.addEventListener('input', () => markChanges());
        }

        if (state.partyMemberNameInput) {
            state.partyMemberNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (state.addMemberBtn) state.addMemberBtn.click();
                }
            });
        }

        if (state.addMemberBtn) {
            state.addMemberBtn.addEventListener('click', () => {
                addPartyMember(state.partyMemberNameInput.value);
            });
        }

        if (state.partyMembersList) {
            state.partyMembersList.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-member-btn')) {
                    const index = parseInt(e.target.dataset.index);
                    removePartyMember(index);
                }
            });
        }

        if (state.lootItemNameInput) {
            state.lootItemNameInput.addEventListener('input', async () => {
                const query = state.lootItemNameInput.value.toLowerCase();
                const searchResults = state.lootSearchResults;
                if (searchResults) searchResults.innerHTML = '';

                if (query.length > 0) {
                    const items = await fetchAllItemsForDropdown();
                    const filteredItems = items.filter(item => item.name.toLowerCase().includes(query));

                    filteredItems.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'p-2 cursor-pointer hover:bg-gray-700 text-gray-200';
                        div.textContent = item.name;
                        div.dataset.itemName = item.name;
                        div.dataset.slug = item.slug;
                        div.addEventListener('click', () => {
                            state.lootItemNameInput.value = item.name;
                            if (searchResults) searchResults.classList.add('hidden');
                            if (state.lootItemQuantityInput) state.lootItemQuantityInput.focus();
                        });
                        if (searchResults) searchResults.appendChild(div);
                    });

                    if (searchResults) {
                        if (filteredItems.length > 0) {
                            searchResults.classList.remove('hidden');
                        } else {
                            searchResults.classList.add('hidden');
                        }
                    }
                } else {
                    if (searchResults) searchResults.classList.add('hidden');
                }
                markChanges();
            });
        }

        if (state.lootItemNameInput) {
            state.lootItemNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (state.lootSearchResults && !state.lootSearchResults.classList.contains('hidden')) {
                        const firstResult = state.lootSearchResults.querySelector('div');
                        if (firstResult) {
                            state.lootItemNameInput.value = firstResult.dataset.itemName;
                            state.lootSearchResults.classList.add('hidden');
                            if (state.lootItemQuantityInput) state.lootItemQuantityInput.focus();
                            return;
                        }
                    }
                    if (state.addLootBtn) state.addLootBtn.click();
                }
            });
        }
        
        if (state.lootItemQuantityInput) {
            state.lootItemQuantityInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (state.addLootBtn) state.addLootBtn.click();
                }
            });
        }

        if (state.addLootBtn) {
            state.addLootBtn.addEventListener('click', () => {
                addLootItem(state.lootItemNameInput.value, parseInt(state.lootItemQuantityInput.value));
            });
        }

        if (state.currentLootList) {
            state.currentLootList.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-loot-btn')) {
                    const index = parseInt(e.target.dataset.index);
                    removeLootItem(index);
                } else if (e.target.classList.contains('reserve-loot-btn')) {
                    const index = parseInt(e.target.dataset.index);
                    handleReserveLoot(state.lootItems[index]);
                }
            });
        }

        if (state.addGoldBtn) {
            state.addGoldBtn.addEventListener('click', () => {
                addGold(state.addGoldAmountInput.value);
            });
        }

        if (state.addGoldAmountInput) {
            state.addGoldAmountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (state.addGoldBtn) state.addGoldBtn.click();
                }
            });
        }

        if (state.setGoldBtn) {
            state.setGoldBtn.addEventListener('click', () => {
                setGold(state.setGoldAmountInput.value);
            });
        }

        if (state.setGoldAmountInput) {
            state.setGoldAmountInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (state.setGoldBtn) state.setGoldBtn.click();
                }
            });
        }

        if (state.distributeLootBtn) {
            state.distributeLootBtn.addEventListener('click', distributeLoot);
        }
        if (state.distributeGoldBtn) {
            state.distributeGoldBtn.addEventListener('click', distributeGold);
        }

        if (state.newCodeBtn) {
            state.newCodeBtn.addEventListener('click', generateShareCode);
        }

        if (state.copyCodeBtn) {
            state.copyCodeBtn.addEventListener('click', () => {
                if (state.shareCodeDisplay) state.shareCodeDisplay.select();
                navigator.clipboard.writeText(state.shareCodeDisplay ? state.shareCodeDisplay.value : '')
                    .then(() => showFeedback('Share code copied to clipboard!', 'success'))
                    .catch(err => console.error('Failed to copy text: ', err));
            });
        }

        if (state.loadRunBtn) {
            state.loadRunBtn.addEventListener('click', async () => {
                const code = state.loadCodeInput ? state.loadCodeInput.value : '';
                if (code) {
                    await loadDungeonRunFromShareCode(code);
                } else {
                    showFeedback("Please enter a share code to load.", "error");
                }
            });
        }

        if (state.loadCodeInput) {
            state.loadCodeInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (state.loadRunBtn) state.loadRunBtn.click();
                }
            });
        }

        if (state.confirmAllReservesBtn) {
            state.confirmAllReservesBtn.addEventListener('click', () => {
                confirmReservations();
                markChanges();
            });
        }

        if (state.closeReserveModalBtn) {
            state.closeReserveModalBtn.addEventListener('click', hideReserveModal);
        }
        if (state.closeReserveModalBtnBottom) {
            state.closeReserveModalBtnBottom.addEventListener('click', hideReserveModal);
        }

        if (state.reservePlayerSelectionDiv) {
            state.reservePlayerSelectionDiv.addEventListener('input', (e) => {
                if (e.target.classList.contains('player-reserve-quantity')) {
                    updateConfirmButtonState();
                }
            });
        }

        state.saveRunBtn = document.getElementById('saveRunBtn');
        if (state.saveRunBtn) {
            state.saveRunBtn.addEventListener('click', saveDungeonRun);
        }

        const savedRunsList = document.getElementById('savedRunsList');
        if (savedRunsList) {
            function renderSavedRuns() {
                savedRunsList.innerHTML = '';
                const runs = listSavedDungeonRuns();
                if (runs.length === 0) {
                    savedRunsList.innerHTML = '<p class="text-gray-400 italic">No saved runs.</p>';
                } else {
                    runs.forEach(runName => {
                        const li = document.createElement('li');
                        li.className = 'flex justify-between items-center py-1 px-2 border-b border-gray-500 last:border-b-0 text-gray-200';
                        li.innerHTML = `
                            <span>${runName}</span>
                            <div>
                                <button data-run-name="${runName}" class="load-saved-run-btn bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs mr-2 transition duration-150 ease-in-out">Load</button>
                                <button data-run-name="${runName}" class="delete-saved-run-btn text-red-400 hover:text-red-500 text-sm transition duration-150 ease-in-out">Delete</button>
                            </div>
                        `;
                        savedRunsList.appendChild(li);
                    });
                }
            }
            renderSavedRuns();

            savedRunsList.addEventListener('click', (e) => {
                const runName = e.target.dataset.runName;
                if (e.target.classList.contains('load-saved-run-btn')) {
                    if (runName) {
                        loadDungeonRun(runName);
                    }
                } else if (e.target.classList.contains('delete-saved-run-btn')) {
                    if (runName) {
                        if (deleteDungeonRun(runName)) {
                            renderSavedRuns();
                        }
                    }
                }
            });
        }
    }
}