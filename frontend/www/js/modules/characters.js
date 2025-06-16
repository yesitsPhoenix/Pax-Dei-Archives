import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';

const characterSelect = document.getElementById('character-select');
let createCharacterModal = null;
let createCharacterForm = null;
let closeCreateCharacterModalBtn = null;
let newCharacterNameInput = null;
let newCharacterGoldInput = null; // New input for initial gold
let deleteCharacterBtn = null;
const setGoldBtn = document.getElementById('setGoldBtn');

let currentUserId = null;
export let currentCharacterId = null;

export const insertCharacterModalHtml = () => {
    const createCharacterModalHtml = `
        <div id="createCharacterModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto font-inter">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Create New Character</h3>
                <form id="createCharacterForm">
                    <div class="mb-4">
                        <label for="newCharacterNameInput" class="block text-gray-700 text-sm font-bold mb-2">Character Name:</label>
                        <input type="text" id="newCharacterNameInput" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Enter character name" required>
                    </div>
                    <div class="mb-4">
                        <label for="newCharacterGoldInput" class="block text-gray-700 text-sm font-bold mb-2">Starting Gold:</label>
                        <input type="number" id="newCharacterGoldInput" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Enter starting gold (e.g., 100)" value="0" required min="0">
                    </div>
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Create Character</button>
                        <button type="button" id="closeCreateCharacterModalBtn" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
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
    newCharacterGoldInput = document.getElementById('newCharacterGoldInput'); // Get new input element

    if (closeCreateCharacterModalBtn) {
        closeCreateCharacterModalBtn.addEventListener('click', () => {
            if (createCharacterModal) {
                createCharacterModal.classList.add('hidden');
            }
        });
    }

    if (createCharacterForm) {
        createCharacterForm.addEventListener('submit', handleCreateCharacter);
    }
};

export const initializeCharacters = async (userId, onCharacterSelectedCallback) => {
    currentUserId = userId;
    deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
    
    addCharacterEventListeners();
    await loadCharacters(onCharacterSelectedCallback);
};

const loadCharacters = async (onCharacterSelectedCallback) => {
    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name, gold')
        .eq('user_id', currentUserId);

    if (error) {
        console.error('Error fetching characters:', error.message);
        await showCustomModal('Error', 'Failed to load characters: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    const characters = data || [];
    characterSelect.innerHTML = '';

    if (characters.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No characters available. Create one!';
        characterSelect.appendChild(option);
        characterSelect.disabled = true;
        currentCharacterId = null;
        if (deleteCharacterBtn) deleteCharacterBtn.style.display = 'none';
        if (setGoldBtn) setGoldBtn.style.display = 'none';
    } else {
        characterSelect.disabled = false;
        if (deleteCharacterBtn) deleteCharacterBtn.style.display = 'inline-block';
        if (setGoldBtn) setGoldBtn.style.display = 'inline-block';

        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.character_id;
            option.textContent = char.character_name;
            characterSelect.appendChild(option);
        });

        if (!currentCharacterId || !characters.some(char => char.character_id === currentCharacterId)) {
            currentCharacterId = characters[0].character_id;
        }
        characterSelect.value = currentCharacterId;
    }

    if (onCharacterSelectedCallback) {
        await onCharacterSelectedCallback();
    }
};

const handleCharacterSelection = async (event) => {
    currentCharacterId = event.target.value;
    await loadTraderPageData();
};

const handleCreateCharacter = async (e) => {
    e.preventDefault();
    const characterName = newCharacterNameInput.value.trim();
    const initialGold = parseInt(newCharacterGoldInput.value, 10); // Get initial gold value

    if (!characterName) {
        await showCustomModal('Validation Error', 'Character name cannot be empty.', [{ text: 'OK', value: true }]);
        return;
    }

    if (isNaN(initialGold) || initialGold < 0) {
        await showCustomModal('Validation Error', 'Starting gold must be a non-negative number.', [{ text: 'OK', value: true }]);
        return;
    }

    const { data, error } = await supabase
        .from('characters')
        .insert([{ user_id: currentUserId, character_name: characterName, gold: initialGold }]) // Include gold
        .select('character_id');

    if (error) {
        if (error.code === '23505') {
            await showCustomModal('Error', `A character with the name "${characterName}" already exists for your account.`, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Error', 'Error creating character: ' + error.message, [{ text: 'OK', value: true }]);
        }
        console.error('Error creating character:', error.message);
        return;
    }

    currentCharacterId = data[0].character_id;
    await showCustomModal('Success', `Character "${characterName}" created successfully with ${initialGold.toLocaleString()} gold!`, [{ text: 'OK', value: true }]);
    if (createCharacterModal) {
        createCharacterModal.classList.add('hidden');
    }
    newCharacterNameInput.value = '';
    newCharacterGoldInput.value = '0'; // Reset gold input
    await loadCharacters(loadTraderPageData);
};

const handleDeleteCharacter = async () => {
    if (!currentCharacterId) {
        await showCustomModal('Error', 'No character selected to delete.', [{ text: 'OK', value: true }]);
        return;
    }

    const confirmed = await showCustomModal(
        'Confirmation',
        'Are you sure you want to delete this character and all associated data? This action cannot be undone.',
        [{ text: 'Yes, Delete', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }]
    );

    if (confirmed) {
        const { error } = await supabase
            .from('characters')
            .delete()
            .eq('character_id', currentCharacterId)
            .eq('user_id', currentUserId);

        if (error) {
            await showCustomModal('Error', 'Failed to delete character: ' + error.message, [{ text: 'OK', value: true }]);
            console.error('Error deleting character:', error.message);
            return;
        }

        await showCustomModal('Success', 'Character deleted successfully!', [{ text: 'OK', value: true }]);
        await loadCharacters(loadTraderPageData);
    }
};

const updateCharacterGold = async (newGoldAmount) => {
    if (!currentCharacterId) {
        await showCustomModal("Error", "No character selected.", [{ text: 'OK', value: true }]);
        return;
    }

    const { error } = await supabase
        .from('characters')
        .update({ gold: newGoldAmount })
        .eq('character_id', currentCharacterId)
        .eq('user_id', currentUserId);

    if (error) {
        await showCustomModal('Error', `Error updating gold: ${error.message}`, [{ text: 'OK', value: true }]);
        console.error('Error updating character gold:', error.message);
        return;
    }

    await showCustomModal('Success', `Gold updated to ${newGoldAmount.toLocaleString()}.`, [{ text: 'OK', value: true }]);
    await loadTraderPageData();
};

const showSetGoldInputModal = (onConfirm, onCancel) => {
    const modalId = `setGoldInputModal-${Date.now()}`;
    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
                <h3 class="text-lg font-bold mb-4">Set Character Gold</h3>
                <input type="number" id="goldAmountInput" placeholder="Enter gold amount" class="w-full p-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                <div class="flex justify-end gap-2">
                    <button id="cancelSetGold" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-full">Cancel</button>
                    <button id="confirmSetGold" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Set</button>
                </div>
                <p id="goldInputError" class="text-red-500 text-sm mt-2" style="display:none;"></p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const goldAmountInput = document.getElementById('goldAmountInput');
    const confirmButton = document.getElementById('confirmSetGold');
    const cancelButton = document.getElementById('cancelSetGold');
    const errorEl = document.getElementById('goldInputError');

    confirmButton.onclick = null;
    cancelButton.onclick = null;

    confirmButton.addEventListener('click', () => {
        const amount = parseInt(goldAmountInput.value, 10);
        if (!isNaN(amount) && amount >= 0) {
            onConfirm(amount);
            document.getElementById(modalId).remove();
        } else {
            errorEl.textContent = 'Please enter a valid non-negative number for gold.';
            errorEl.style.display = 'block';
        }
    });

    cancelButton.addEventListener('click', () => {
        onCancel();
        document.getElementById(modalId).remove();
    });

    goldAmountInput.focus();
};

export const getCurrentCharacter = async () => {
    if (!currentCharacterId) return null;
    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name, gold')
        .eq('character_id', currentCharacterId)
        .single();

    if (error) {
        console.error('Error fetching current character:', error.message);
        await showCustomModal('Error', 'Failed to fetch current character data.', [{ text: 'OK', value: true }]);
        return null;
    }
    return data;
};

const addCharacterEventListeners = () => {
    if (characterSelect) {
        characterSelect.addEventListener('change', handleCharacterSelection);
    }
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
};
