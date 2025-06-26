import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData, get_from_quart_cache, set_in_quart_cache, invalidate_quart_cache, invalidateTransactionHistoryCache, invalidateDashboardStatsCache } from '../trader.js';

const CHARACTER_CACHE_KEY_PREFIX = 'paxDeiCharacters_';
const CHARACTER_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

let currentUserId = null;
export let currentCharacterId = null;

export const setCurrentCharacterContext = (userId, characterId) => {
    currentUserId = userId;
    currentCharacterId = characterId;
};

const characterSelect = document.getElementById('character-select');
let createCharacterModal = null;
let createCharacterForm = null;

export const initializeCharacters = async (userId, onCharacterSelectedCallback) => {
    currentUserId = userId;
    insertCharacterModalHtml();
    await loadCharacters(onCharacterSelectedCallback);

    if (characterSelect) {
        characterSelect.addEventListener('change', async (event) => {
            const selectedCharacterId = event.target.value;
            if (selectedCharacterId) {
                currentCharacterId = selectedCharacterId;
                localStorage.setItem('selectedCharacterId', selectedCharacterId);
                localStorage.setItem('selectedUserId', currentUserId);
                if (onCharacterSelectedCallback) {
                    await onCharacterSelectedCallback();
                }
            }
        });
    }

    const storedSelectedCharacterId = localStorage.getItem('selectedCharacterId');
    const storedSelectedUserId = localStorage.getItem('selectedUserId');

    if (storedSelectedCharacterId && storedSelectedUserId === currentUserId) {
        const optionExists = Array.from(characterSelect.options).some(option => option.value === storedSelectedCharacterId);
        if (optionExists) {
            characterSelect.value = storedSelectedCharacterId;
            currentCharacterId = storedSelectedCharacterId;
            if (onCharacterSelectedCallback) {
                await onCharacterSelectedCallback();
            }
        } else {
            localStorage.removeItem('selectedCharacterId');
            localStorage.removeItem('selectedUserId');
            await showCustomModal('Welcome', 'Please create or select a character.', [{ text: 'OK', value: true }]);
            if (characterSelect && characterSelect.options.length <= 1) {
                const createCharacterModalEl = document.getElementById('createCharacterModal');
                if (createCharacterModalEl) createCharacterModalEl.classList.remove('hidden');
            }
        }
    } else {
        localStorage.removeItem('selectedCharacterId');
        localStorage.removeItem('selectedUserId');
        if (characterSelect && characterSelect.options.length <= 1) {
            await showCustomModal('Welcome', 'Please create or select a character.', [{ text: 'OK', value: true }]);
            const createCharacterModalEl = document.getElementById('createCharacterModal');
            if (createCharacterModalEl) createCharacterModalEl.classList.remove('hidden');
        } else if (characterSelect && characterSelect.options.length > 1) {
             characterSelect.selectedIndex = 1;
             currentCharacterId = characterSelect.value;
             localStorage.setItem('selectedCharacterId', currentCharacterId);
             localStorage.setItem('selectedUserId', currentUserId);
             if (onCharacterSelectedCallback) {
                 await onCharacterSelectedCallback();
             }
        }
    }
};

const loadCharacters = async (onCharacterSelectedCallback) => {
    const cacheKey = CHARACTER_CACHE_KEY_PREFIX + currentUserId;
    let characters = [];

    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CHARACTER_CACHE_EXPIRY_MS) {
            characters = data;
        } else {
            localStorage.removeItem(cacheKey);
        }
    }

    if (characters.length === 0) { 
        const { data, error } = await supabase
            .from('characters')
            .select('character_id, character_name, gold')
            .eq('user_id', currentUserId);

        if (error) {
            await showCustomModal('Error', 'Failed to load characters: ' + error.message, [{ text: 'OK', value: true }]);
            return;
        }

        characters = data || [];
        localStorage.setItem(cacheKey, JSON.stringify({ data: characters, timestamp: Date.now() }));
    }
    
    characterSelect.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a character...';
    characterSelect.appendChild(defaultOption);

    if (characters.length === 0) {
        await showCustomModal('Welcome', 'No characters found. Please create one!', [{ text: 'OK', value: true }]);
        if (createCharacterModal) createCharacterModal.classList.remove('hidden');
    } else {
        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.character_id;
            option.textContent = char.character_name;
            characterSelect.appendChild(option);
        });
    }

    const storedSelectedCharacterId = localStorage.getItem('selectedCharacterId');
    if (storedSelectedCharacterId && Array.from(characterSelect.options).some(option => option.value === storedSelectedCharacterId)) {
        characterSelect.value = storedSelectedCharacterId;
        currentCharacterId = storedSelectedCharacterId;
    } else {
        if (characters.length > 0) {
            characterSelect.selectedIndex = 1;
            currentCharacterId = characterSelect.value;
            localStorage.setItem('selectedCharacterId', currentCharacterId);
            localStorage.setItem('selectedUserId', currentUserId);
        } else {
            currentCharacterId = null;
        }
    }

    if (onCharacterSelectedCallback && currentCharacterId) {
        await onCharacterSelectedCallback();
    }
};

export const insertCharacterModalHtml = () => {
    if (!document.getElementById('createCharacterModal')) {
        const modalHtml = `
            <div id="createCharacterModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">Create New Character</h3>
                    <form id="createCharacterForm">
                        <div class="mb-4">
                            <label for="new-character-name" class="block text-gray-700 text-sm font-bold mb-2">Character Name:</label>
                            <input type="text" id="new-character-name" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        </div>
                        <div class="mb-6">
                            <label for="new-character-gold" class="block text-gray-700 text-sm font-bold mb-2">Starting Gold:</label>
                            <input type="number" id="new-character-gold" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value="0" required>
                        </div>
                        <div class="flex items-center justify-between">
                            <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
                                Create Character
                            </button>
                            <button type="button" id="cancelCreateCharacter" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <div id="setGoldModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">Set Gold Amount</h3>
                    <form id="setGoldForm">
                        <div class="mb-4">
                            <label for="gold-amount-input" class="block text-gray-700 text-sm font-bold mb-2">New Gold Amount:</label>
                            <input type="number" id="gold-amount-input" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        </div>
                        <div class="flex items-center justify-between">
                            <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
                                Set Gold
                            </button>
                            <button type="button" id="cancelSetGold" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <div id="pveGoldInputModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4 sm:mx-auto font-inter">
                    <h3 class="text-xl font-bold mb-4 text-gray-800">Enter Manual PVE Gold</h3>
                    <form id="pveGoldInputForm">
                        <div class="mb-4">
                            <label for="pve-gold-amount" class="block text-gray-700 text-sm font-bold mb-2">New Total Gold Amount:</label>
                            <input type="number" id="pve-gold-amount" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                        </div>
                        <div class="mb-6">
                            <label for="pve-description" class="block text-gray-700 text-sm font-bold mb-2">Description (optional):</label>
                            <input type="text" id="pve-description" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                        </div>
                        <div class="flex items-center justify-between">
                            <button type="submit" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full">
                                Record PVE Gold
                            </button>
                            <button type="button" id="cancelPveGoldInput" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        createCharacterModal = document.getElementById('createCharacterModal');
        createCharacterForm = document.getElementById('createCharacterForm');
        
        const setGoldModal = document.getElementById('setGoldModal');
        const setGoldForm = document.getElementById('setGoldForm');
        const cancelSetGoldBtn = document.getElementById('cancelSetGold');

        const pveGoldInputModal = document.getElementById('pveGoldInputModal');
        const pveGoldInputForm = document.getElementById('pveGoldInputForm');
        const cancelPveGoldInputBtn = document.getElementById('cancelPveGoldInput');

        if (createCharacterForm) {
            createCharacterForm.addEventListener('submit', handleCreateCharacter);
            document.getElementById('cancelCreateCharacter').addEventListener('click', () => {
                if (createCharacterModal) createCharacterModal.classList.add('hidden');
            });
        }
        if (setGoldForm) {
            setGoldForm.addEventListener('submit', handleSetGold);
            cancelSetGoldBtn.addEventListener('click', () => {
                if (setGoldModal) setGoldModal.classList.add('hidden');
            });
        }
        if (pveGoldInputForm) {
            pveGoldInputForm.addEventListener('submit', handlePveGoldInput);
            cancelPveGoldInputBtn.addEventListener('click', () => {
                if (pveGoldInputModal) pveGoldInputModal.classList.add('hidden');
            });
        }
    }
};

const handleCreateCharacter = async (e) => {
    e.preventDefault();
    const newCharacterNameInput = document.getElementById('new-character-name');
    const newCharacterGoldInput = document.getElementById('new-character-gold');
    const characterName = newCharacterNameInput.value;
    const initialGold = parseInt(newCharacterGoldInput.value, 10);

    if (!characterName) {
        await showCustomModal('Error', 'Character name cannot be empty.', [{ text: 'OK', value: true }]);
        return;
    }

    const { data, error } = await supabase
        .from('characters')
        .insert([{ user_id: currentUserId, character_name: characterName, gold: initialGold }])
        .select();

    if (error) {
        await showCustomModal('Error', 'Failed to create character: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    await showCustomModal('Success', `${characterName} created successfully with ${initialGold.toLocaleString()} gold!`, [{ text: 'OK', value: true }]);
    if (createCharacterModal) createCharacterModal.classList.add('hidden');
    newCharacterNameInput.value = '';
    newCharacterGoldInput.value = '0';
    localStorage.removeItem(CHARACTER_CACHE_KEY_PREFIX + currentUserId);
    await invalidate_quart_cache(`pax_character:${data[0].character_id}`); 
    await invalidateDashboardStatsCache(data[0].character_id);
    await invalidateTransactionHistoryCache(data[0].character_id);
    await loadCharacters(loadTraderPageData);
};

const handleDeleteCharacter = async () => {
    if (!currentCharacterId) {
        await showCustomModal('Error', 'No character selected to delete.', [{ text: 'OK', value: true }]);
        return;
    }

    const confirmDelete = await showCustomModal('Confirm Delete', 'Are you sure you want to delete this character and all its data? This cannot be undone.', [
        { text: 'Cancel', value: false, type: 'cancel' },
        { text: 'Delete', value: true, type: 'confirm' }
    ]);

    if (confirmDelete) {
        const { error } = await supabase
            .from('characters')
            .delete()
            .eq('character_id', currentCharacterId);

        if (error) {
            await showCustomModal('Error', 'Failed to delete character: ' + error.message, [{ text: 'OK', value: true }]);
            return;
        }

        await showCustomModal('Success', 'Character deleted successfully!', [{ text: 'OK', value: true }]);
        localStorage.removeItem(CHARACTER_CACHE_KEY_PREFIX + currentUserId);
        await invalidate_quart_cache(`pax_character:${currentCharacterId}`);
        await invalidateDashboardStatsCache(currentCharacterId);
        await invalidateTransactionHistoryCache(currentCharacterId);
        localStorage.removeItem('selectedCharacterId');
        localStorage.removeItem('selectedUserId');
        await loadCharacters(loadTraderPageData);
    }
};

const handleSetGold = async (e) => {
    e.preventDefault();
    const goldAmountInput = document.getElementById('gold-amount-input');
    const newGoldAmount = parseInt(goldAmountInput.value, 10);

    if (isNaN(newGoldAmount)) {
        await showCustomModal('Error', 'Please enter a valid number for gold.', [{ text: 'OK', value: true }]);
        return;
    }

    await updateCharacterGold(newGoldAmount);
    document.getElementById('setGoldModal').classList.add('hidden');
};

const handlePveGoldInput = async (e) => {
    e.preventDefault();
    const pveGoldAmountInput = document.getElementById('pve-gold-amount');
    const pveDescriptionInput = document.getElementById('pve-description');
    const newTotalGoldEntered = parseInt(pveGoldAmountInput.value, 10);
    const description = pveDescriptionInput.value;

    if (isNaN(newTotalGoldEntered)) {
        await showCustomModal('Error', 'Please enter a valid number for gold.', [{ text: 'OK', value: true }]);
        return;
    }

    if (!currentCharacterId) {
        await showCustomModal('Error', 'Please select a character first.', [{ text: 'OK', value: true }]);
        return;
    }
    
    if (!currentUserId) {
        await showCustomModal('Error', 'User not logged in. Please log in to record PVE gold.', [{ text: 'OK', value: true }]);
        return;
    }

    const currentCharacter = await getCurrentCharacter(true); 
    if (!currentCharacter) {
        await showCustomModal('Error', 'Could not retrieve current character gold. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }
    
    // Calculate the difference for the PVE transaction
    const goldAmountDifference = newTotalGoldEntered - currentCharacter.gold;

    const { error: transactionError } = await supabase
        .from('pve_transactions')
        .insert([{ character_id: currentCharacterId, gold_amount: goldAmountDifference, description: description, user_id: currentUserId }]);

    if (transactionError) {
        await showCustomModal('Error', 'Failed to record PVE transaction: ' + transactionError.message, [{ text: 'OK', value: true }]);
        return;
    }

    // Update the character's total gold to the new value entered by the user
    await updateCharacterGoldByPveTransaction(newTotalGoldEntered, goldAmountDifference);
    document.getElementById('pveGoldInputModal').classList.add('hidden');
    pveGoldAmountInput.value = '';
    pveDescriptionInput.value = '';
    
    await invalidateTransactionHistoryCache(currentCharacterId);
    await invalidateDashboardStatsCache(currentCharacterId);
};


const updateCharacterGold = async (newGoldAmount) => {
    const { data, error } = await supabase
        .from('characters')
        .update({ gold: newGoldAmount })
        .eq('character_id', currentCharacterId)
        .select();

    if (error) {
        await showCustomModal('Error', 'Failed to update gold: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    await showCustomModal('Success', `Gold updated to ${newGoldAmount.toLocaleString()}.`, [{ text: 'OK', value: true }]);
    localStorage.removeItem(CHARACTER_CACHE_KEY_PREFIX + currentUserId);
    await invalidate_quart_cache(`pax_character:${currentCharacterId}`);
    await invalidateDashboardStatsCache(currentCharacterId);
    await invalidateTransactionHistoryCache(currentCharacterId);
    await loadTraderPageData();
};

const updateCharacterGoldByPveTransaction = async (newTotalGold, goldChange) => {
    const { data, error } = await supabase
        .from('characters')
        .update({ gold: newTotalGold })
        .eq('character_id', currentCharacterId)
        .select();

    if (error) {
        await showCustomModal('Error', 'Failed to update PVE gold: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    const message = `Character gold set to ${newTotalGold.toLocaleString()}. Recorded change: ${goldChange >= 0 ? '+' : ''}${goldChange.toLocaleString()} gold from PVE.`;

    await showCustomModal('Success', message, [{ text: 'OK', value: true }]);
    localStorage.removeItem(CHARACTER_CACHE_KEY_PREFIX + currentUserId); 
    await invalidate_quart_cache(`pax_character:${currentCharacterId}`);
    await invalidateDashboardStatsCache(currentCharacterId);
    await invalidateTransactionHistoryCache(currentCharacterId);
    await loadTraderPageData();
};


export const getCurrentCharacter = async (forceRefresh = false) => {
    if (!currentCharacterId) {
        return null;
    }

    const characterCacheKey = `pax_character:${currentCharacterId}`;
    
    if (!forceRefresh) {
        const cachedCharacter = await get_from_quart_cache(characterCacheKey);
        if (cachedCharacter) {
            return cachedCharacter;
        }
    }
    
    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name, gold')
        .eq('character_id', currentCharacterId)
        .single();

    if (error) {
        console.error('Error fetching current character from Supabase:', error.message);
        return null;
    }
    
    if (data) {
        await set_in_quart_cache(characterCacheKey, data, 60);
    }
    return data;
};

export const showSetGoldInputModal = async (onConfirm, onCancel) => {
    const setGoldModal = document.getElementById('setGoldModal');
    const goldAmountInput = document.getElementById('gold-amount-input');
    if (setGoldModal) {
        const currentCharacter = await getCurrentCharacter(true);
        if (currentCharacter && typeof currentCharacter.gold === 'number') {
            goldAmountInput.value = currentCharacter.gold;
        } else {
            goldAmountInput.value = '';
        }
        setGoldModal.classList.remove('hidden');
    }
};

export const showPveGoldInputModal = async (onConfirm, onCancel) => {
    const pveGoldInputModal = document.getElementById('pveGoldInputModal');
    const pveGoldAmountInput = document.getElementById('pve-gold-amount');
    if (pveGoldInputModal) {
        const currentCharacter = await getCurrentCharacter(true); // Fetch current gold to pre-fill
        if (currentCharacter && typeof currentCharacter.gold === 'number') {
            pveGoldAmountInput.value = currentCharacter.gold;
        } else {
            pveGoldAmountInput.value = '';
        }
        document.getElementById('pve-description').value = '';
        pveGoldInputModal.classList.remove('hidden');
    }
};

const addCharacterEventListeners = () => {
    const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
    if (deleteCharacterBtn) {
        deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    }
    const setGoldBtn = document.getElementById('setGoldBtn');
    if (setGoldBtn) {
        setGoldBtn.addEventListener('click', showSetGoldInputModal);
    }
    const pveBtn = document.getElementById('pveBtn');
    if (pveBtn) {
        pveBtn.addEventListener('click', showPveGoldInputModal);
    }
};

document.addEventListener('DOMContentLoaded', addCharacterEventListeners);
