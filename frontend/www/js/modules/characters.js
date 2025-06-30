// characters.js
import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';
import { loadTransactionHistory } from './sales.js';
import { renderSalesChart } from './salesChart.js';
import { populateMarketStallDropdown, setupMarketStallTabs } from './init.js';
import { getOrCreateDefaultMarketStall } from './actions.js';

const characterSelect = document.getElementById('character-select');
let createCharacterModal = null;
let createCharacterForm = null;
let closeCreateCharacterModalBtn = null;
let newCharacterNameInput = null;
let newCharacterGoldInput = null;
let newCharacterRegionSelect = null;
let deleteCharacterBtn = null;
const setGoldBtn = document.getElementById('setGoldBtn');
const pveBtn = document.getElementById('pveBtn');

let currentUserId = null;
export let currentCharacterId = null;

export const setCurrentUserId = (userId) => {
    currentUserId = userId;
};

export const insertCharacterModalHtml = () => {
    const createCharacterModalHtml = `
        <div id="createCharacterModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto font-inter">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Create New Character</h3>
                <form id="createCharacterForm">
                    <div class="mb-4">
                        <label for="newCharacterNameInput" class="block text-gray-700 text-sm font-bold mb-2">Character Name:</label>
                        <input type="text" id="newCharacterNameInput" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Enter character name" required>
                    </div>
                    <div class="mb-4">
                        <label for="newCharacterGoldInput" class="block text-gray-700 text-sm font-bold mb-2">Starting Gold:</label>
                        <input type="number" id="newCharacterGoldInput" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="0" min="0" required>
                    </div>
                    <div class="mb-6">
                        <label for="newCharacterRegionSelect" class="block text-gray-700 text-sm font-bold mb-2">Region:</label>
                        <select id="newCharacterRegionSelect" class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                            <option value="">Select Region</option>
                            <option value="US">US</option>
                            <option value="EU">EU</option>
                            <option value="SAE">SAE</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                        <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                            Create Character
                        </button>
                        <button type="button" id="closeCreateCharacterModalBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', createCharacterModalHtml);
    createCharacterModal = document.getElementById('createCharacterModal');
    createCharacterForm = document.getElementById('createCharacterForm');
    closeCreateCharacterModalBtn = document.getElementById('closeCreateCharacterModalBtn');
    newCharacterNameInput = document.getElementById('newCharacterNameInput');
    newCharacterGoldInput = document.getElementById('newCharacterGoldInput');
    newCharacterRegionSelect = document.getElementById('newCharacterRegionSelect');
};

export const fetchCharacters = async () => {
    if (!currentUserId) {
        console.warn('No user ID available. Skipping character fetch.');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('user_id', currentUserId);

        if (error) throw error;

        return data;
    } catch (e) {
        console.error('Error fetching characters:', e);
        await showCustomModal('Error', 'Failed to load characters.', [{ text: 'OK', value: true }]);
        return [];
    }
};

export const populateCharacterDropdown = async () => {
    if (!characterSelect) return;

    const characters = await fetchCharacters();
    characterSelect.innerHTML = '<option value="">Select Character</option>';
    
    if (characters.length > 0) {
        characters.forEach(character => {
            const option = document.createElement('option');
            option.value = character.character_id;
            option.textContent = character.character_name;
            characterSelect.appendChild(option);
        });

        const lastSelectedCharId = localStorage.getItem('lastSelectedCharacterId');
        if (lastSelectedCharId && characters.some(char => char.character_id === lastSelectedCharId)) {
            characterSelect.value = lastSelectedCharId;
            currentCharacterId = lastSelectedCharId;
        } else {
            characterSelect.value = characters[0].character_id;
            currentCharacterId = characters[0].character_id;
        }
        await loadTraderPageData();
    } else {
        currentCharacterId = null;
        localStorage.removeItem('lastSelectedCharacterId');
        await loadTraderPageData();
    }
};

export const updateCharacterGold = async (newGoldAmount) => {
    try {
        const { error } = await supabase
            .from('characters')
            .update({ gold: newGoldAmount })
            .eq('character_id', currentCharacterId);

        if (error) throw error;

        await showCustomModal('Success', 'Gold updated successfully!', [{ text: 'OK', value: true }]);
        await populateCharacterDropdown();
        await loadTraderPageData();
    } catch (e) {
        console.error('Error updating gold:', e);
        await showCustomModal('Error', 'Failed to update gold: ' + e.message, [{ text: 'OK', value: true }]);
    }
};

export const updateCharacterGoldByPveTransaction = async (newTotalGold) => {
    try {
        const { error } = await supabase
            .from('characters')
            .update({ gold: newTotalGold })
            .eq('character_id', currentCharacterId);

        if (error) throw error;

        await showCustomModal('Success', 'PVE gold recorded and total gold updated successfully!', [{ text: 'OK', value: true }]);
        await populateCharacterDropdown();
        await loadTraderPageData();
    } catch (e) {
        console.error('Error updating PVE gold:', e);
        await showCustomModal('Error', 'Failed to update PVE gold: ' + e.message, [{ text: 'OK', value: true }]);
    }
};


export const handleCharacterSelection = async () => {
    const selectedCharId = characterSelect.value;
    if (selectedCharId) {
        currentCharacterId = selectedCharId;
        localStorage.setItem('lastSelectedCharacterId', selectedCharId);
        await getOrCreateDefaultMarketStall(currentCharacterId);
        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await loadTraderPageData();
    } else {
        currentCharacterId = null;
        localStorage.removeItem('lastSelectedCharacterId');
        await loadTraderPageData();
    }
};

const handleCreateCharacter = async (event) => {
    event.preventDefault();
    if (!createCharacterForm || !newCharacterNameInput || !newCharacterGoldInput || !newCharacterRegionSelect) {
        console.error("Character creation form elements not found.");
        return;
    }

    const name = newCharacterNameInput.value.trim();
    const gold = parseInt(newCharacterGoldInput.value);
    const region = newCharacterRegionSelect.value;

    if (!currentUserId) {
        await showCustomModal('Error', 'No user logged in. Please log in to create a character.', [{ text: 'OK', value: true }]);
        return;
    }

    if (!name || isNaN(gold) || gold < 0 || !region) {
        await showCustomModal('Error', 'Please fill in all character creation fields correctly.', [{ text: 'OK', value: true }]);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('characters')
            .insert({
                user_id: currentUserId,
                character_name: name,
                gold: gold,
                region: region
            })
            .select('character_id')
            .single();

        if (error) {
            if (error.code === '23505') {
                await showCustomModal('Error', 'A character with this name already exists.', [{ text: 'OK', value: true }]);
            } else {
                throw error;
            }
        } else {
            const newCharacterId = data.character_id;
            await getOrCreateDefaultMarketStall(newCharacterId);
            await showCustomModal('Success', 'Character created successfully!', [{ text: 'OK', value: true }]);
            createCharacterForm.reset();
            createCharacterModal.classList.add('hidden');
            await populateCharacterDropdown();
            characterSelect.value = newCharacterId;
            currentCharacterId = newCharacterId;
            await populateMarketStallDropdown();
            await setupMarketStallTabs();
            await loadTraderPageData();
        }
    } catch (e) {
        console.error('Error creating character:', e);
        await showCustomModal('Error', 'Failed to create character: ' + e.message, [{ text: 'OK', value: true }]);
    }
};

export const handleDeleteCharacter = async () => {
    if (!currentCharacterId) {
        await showCustomModal("Error", "No character selected to delete.", [{ text: 'OK', value: true }]);
        return;
    }

    const confirmDelete = await showCustomModal(
        "Confirm Delete",
        "Are you sure you want to delete this character and all associated data (listings, purchases, sales)? This action cannot be undone.",
        [
            { text: 'Cancel', value: false },
            { text: 'Delete', value: true, class: 'bg-red-500 hover:bg-red-700' }
        ]
    );

    if (!confirmDelete) {
        return;
    }

    try {
        const { error: listingsError } = await supabase
            .from('market_listings')
            .delete()
            .eq('character_id', currentCharacterId);

        if (listingsError) throw listingsError;

        const { error: stallsError } = await supabase
            .from('market_stalls')
            .delete()
            .eq('character_id', currentCharacterId);

        if (stallsError) throw stallsError;

        const { error: purchasesError } = await supabase
            .from('purchases')
            .delete()
            .eq('character_id', currentCharacterId);

        if (purchasesError) throw purchasesError;

        const { error: salesError } = await supabase
            .from('sales')
            .delete()
            .eq('character_id', currentCharacterId);

        if (salesError) throw salesError;

        const { error: characterError } = await supabase
            .from('characters')
            .delete()
            .eq('character_id', currentCharacterId);

        if (characterError) throw characterError;

        await showCustomModal('Success', 'Character and all associated data deleted successfully!', [{ text: 'OK', value: true }]);
        await populateCharacterDropdown();
        await loadTraderPageData();
    } catch (e) {
        console.error('Error deleting character:', e);
        await showCustomModal('Error', 'Failed to delete character: ' + e.message, [{ text: 'OK', value: true }]);
    }
};

const showSetGoldInputModal = async (onConfirm, onCancel) => {
    const customModalHtml = `
        <div id="setGoldInputModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                <h3 class="text-xl font-bold mb-4 text-gray-800">Set Current Gold Holdings</h3>
                <div class="mb-4">
                    <label for="goldAmountInput" class="block text-gray-700 text-sm font-bold mb-2">New Gold Amount:</label>
                    <input type="number" id="goldAmountInput" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Enter new gold amount" value="0" min="0">
                </div>
                <div class="flex justify-end gap-3">
                    <button id="cancelSetGoldBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                    <button id="confirmSetGoldBtn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Set Gold</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', customModalHtml);
    const modal = document.getElementById('setGoldInputModal');
    const goldInput = document.getElementById('goldAmountInput');
    const confirmBtn = document.getElementById('confirmSetGoldBtn');
    const cancelBtn = document.getElementById('cancelSetGoldBtn');

    goldInput.focus();

    confirmBtn.onclick = () => {
        const amount = parseInt(goldInput.value);
        if (!isNaN(amount) && amount >= 0) {
            onConfirm(amount);
            modal.remove();
        } else {
            showCustomModal('Error', 'Please enter a valid positive number for gold.', [{ text: 'OK', value: true }]);
        }
    };

    cancelBtn.onclick = () => {
        onCancel();
        modal.remove();
    };
};

const showPveGoldInputModal = async (onConfirm, onCancel) => {
    const customModalHtml = `
        <div id="pveGoldInputModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                <h3 class="text-xl font-bold mb-4 text-gray-800">Record PVE Gold Gain</h3>
                <div class="mb-4">
                    <label for="pveGoldAmountInput" class="block text-gray-700 text-sm font-bold mb-2">Gold Gained:</label>
                    <input type="number" id="pveGoldAmountInput" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Enter gold gained" value="0" min="0">
                </div>
                <div class="flex justify-end gap-3">
                    <button id="cancelPveGoldBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                    <button id="confirmPveGoldBtn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Record PVE Gold</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', customModalHtml);
    const modal = document.getElementById('pveGoldInputModal');
    const pveGoldInput = document.getElementById('pveGoldAmountInput');
    const confirmBtn = document.getElementById('confirmPveGoldBtn');
    const cancelBtn = document.getElementById('cancelPveGoldBtn');

    pveGoldInput.focus();

    confirmBtn.onclick = async () => {
        const amountGained = parseInt(pveGoldInput.value);
        if (!isNaN(amountGained) && amountGained >= 0) {
            try {
                const { data: characterData, error: fetchError } = await supabase
                    .from('characters')
                    .select('gold')
                    .eq('character_id', currentCharacterId)
                    .single();

                if (fetchError) throw fetchError;

                const currentGold = characterData.gold;
                const newTotalGold = currentGold + amountGained;

                const { error: insertError } = await supabase
                    .from('sales')
                    .insert({
                        character_id: currentCharacterId,
                        item_id: null,
                        type: 'PVE Gold',
                        quantity: 1,
                        total_amount: amountGained,
                        fee: 0,
                        is_manual: true,
                        transaction_date: new Date().toISOString()
                    });

                if (insertError) throw insertError;

                await onConfirm(newTotalGold);
                modal.remove();
            } catch (e) {
                console.error('Error recording PVE gold:', e);
                await showCustomModal('Error', 'Failed to record PVE gold: ' + e.message, [{ text: 'OK', value: true }]);
            }
        } else {
            await showCustomModal('Error', 'Please enter a valid positive number for gold gained.', [{ text: 'OK', value: true }]);
        }
    };

    cancelBtn.onclick = () => {
        onCancel();
        modal.remove();
    };
};

export const getCurrentCharacter = async () => {
    if (!currentCharacterId) {
        await showCustomModal('Error', 'No character selected.', [{ text: 'OK', value: true }]);
        return null;
    }
    const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('character_id', currentCharacterId)
        .single();

    if (error) {
        await showCustomModal('Error', 'Failed to retrieve character data: ' + error.message, [{ text: 'OK', value: true }]);
        return null;
    }
    return data;
};

const addCharacterEventListeners = () => {
    if (characterSelect) {
        characterSelect.addEventListener('change', handleCharacterSelection);
    }
    deleteCharacterBtn = deleteCharacterBtn || document.getElementById('deleteCharacterBtn');
    if (deleteCharacterBtn) {
        deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    }
    if (setGoldBtn) {
        setGoldBtn.addEventListener('click', () => {
            if (!currentCharacterId) {
                showCustomModal("Error", "Please select a character first to set gold.", [{ text: 'OK', value: true }]);
                return;
            }
            showSetGoldInputModal(
                async (amount) => {
                    await updateCharacterGold(amount);
                },
                () => {
                    console.log("Set Gold operation cancelled.");
                }
            );
        });
    }

    if (pveBtn) {
        pveBtn.addEventListener('click', async () => {
            if (!currentCharacterId) {
                showCustomModal("Error", "Please select a character first to record PVE gold.", [{ text: 'OK', value: true }]);
                return;
            }
            
            await showPveGoldInputModal(
                async (newTotalGold) => {
                    await updateCharacterGoldByPveTransaction(newTotalGold);
                },
                () => {
                    console.log("PVE Gold transaction cancelled.");
                }
            );
        });
    }

    if (createCharacterForm) {
        createCharacterForm.addEventListener('submit', handleCreateCharacter);
    }
    if (closeCreateCharacterModalBtn) {
        closeCreateCharacterModalBtn.addEventListener('click', () => {
            if (createCharacterModal) {
                createCharacterModal.classList.add('hidden');
            }
        });
    }
};

export const initializeCharacters = async () => {
    insertCharacterModalHtml();
    addCharacterEventListeners();
    await populateCharacterDropdown();
    deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
};