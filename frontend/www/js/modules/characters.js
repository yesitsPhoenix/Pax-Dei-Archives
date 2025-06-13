import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';

const characterSelect = document.getElementById('character-select');

let createCharacterModal = null;
let createCharacterForm = null;
let closeCreateCharacterModalBtn = null;
let newCharacterNameInput = null;
let deleteCharacterBtn = null;

let currentUserId = null;
export let currentCharacterId = null;

export const insertCharacterModalHtml = () => {
    const createCharacterModalHtml = `
        <div id="createCharacterModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto font-inter">
                <h3 class="text-2xl font-bold mb-6 text-gray-800">Create New Character</h3>
                <form id="createCharacterForm">
                    <div class="mb-4">
                        <label for="new-character-name" class="block text-gray-700 text-sm font-bold mb-2">Character Name:</label>
                        <input type="text" id="new-character-name" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                    </div>
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Create Character</button>
                        <button type="button" id="closeCreateCharacterModal" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', createCharacterModalHtml);
};

export const initializeCharacters = async (userId, onCharacterChangeCallback) => {
    currentUserId = userId;
    addCharacterEventListeners(onCharacterChangeCallback);
    await fetchAndPopulateCharacters();
};

const addCharacterEventListeners = (onCharacterChangeCallback) => {
    createCharacterModal = document.getElementById('createCharacterModal');
    createCharacterForm = document.getElementById('createCharacterForm');
    closeCreateCharacterModalBtn = document.getElementById('closeCreateCharacterModal');
    newCharacterNameInput = document.getElementById('new-character-name');
    deleteCharacterBtn = document.getElementById('deleteCharacterBtn');

    if (characterSelect) {
        characterSelect.addEventListener('change', async (e) => {
            currentCharacterId = e.target.value;
            if (onCharacterChangeCallback) {
                await onCharacterChangeCallback();
            }
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
            if (!characterSelect.value) {
                showCustomModal('Info', 'Please create a character to proceed.', [{ text: 'OK', value: true }]);
            }
        });
    }
    if (deleteCharacterBtn) {
        deleteCharacterBtn.addEventListener('click', handleDeleteCharacter);
    }
};

export const fetchAndPopulateCharacters = async () => {
    if (!currentUserId || !characterSelect) return;

    try {
        const { data: characters, error } = await supabase
            .from('characters')
            .select('character_id, character_name')
            .eq('user_id', currentUserId)
            .order('character_name', { ascending: true });

        if (error) throw error;

        characterSelect.innerHTML = '';
        if (characters.length === 0) {
            characterSelect.innerHTML = '<option value="">No characters found</option>';
            currentCharacterId = null;
            if (createCharacterModal) {
                createCharacterModal.classList.remove('hidden');
            }
            const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
            if (traderDashboardAndForms) {
                traderDashboardAndForms.style.display = 'none';
            }
            if (deleteCharacterBtn) {
                deleteCharacterBtn.style.display = 'none';
            }
            showCustomModal('Info', 'Please create a character to proceed.', [{ text: 'OK', value: true }]);
            return;
        } else {
            if (createCharacterModal) {
                createCharacterModal.classList.add('hidden');
            }
            const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
            if (traderDashboardAndForms) {
                traderDashboardAndForms.style.display = 'block';
            }
            if (deleteCharacterBtn) {
                deleteCharacterBtn.style.display = 'inline-block';
            }
        }

        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.character_id;
            option.textContent = char.character_name;
            characterSelect.appendChild(option);
        });

        if (currentCharacterId === null || !characters.some(char => char.character_id === currentCharacterId)) {
            currentCharacterId = characters[0].character_id;
            characterSelect.value = currentCharacterId;
        }
    } catch (e) {
        console.error("Error fetching characters:", e);
        await showCustomModal('Error', 'An unexpected error occurred while loading characters.', [{ text: 'OK', value: true }]);
    }
};

const handleCreateCharacter = async (e) => {
    e.preventDefault();
    const newCharacterName = newCharacterNameInput ? newCharacterNameInput.value.trim() : '';

    if (!newCharacterName) {
        await showCustomModal('Validation Error', 'Character name cannot be empty.', [{ text: 'OK', value: true }]);
        return;
    }

    if (!currentUserId) {
        await showCustomModal('Error', 'User not authenticated. Cannot create character.', [{ text: 'OK', value: true }]);
        return;
    }

    try {
        const { data, error } = await supabase
            .from('characters')
            .insert({ character_name: newCharacterName, user_id: currentUserId })
            .select('character_id')
            .single();

        if (error) {
            if (error.code === '23505') {
                await showCustomModal('Error', 'A character with this name already exists for your account. Please choose a different name.', [{ text: 'OK', value: true }]);
            } else {
                await showCustomModal('Error', 'Failed to create character: ' + error.message, [{ text: 'OK', value: true }]);
            }
            return;
        }

        await showCustomModal('Success', `Character "${newCharacterName}" created successfully!`, [{ text: 'OK', value: true }]);
        if (createCharacterModal) {
            createCharacterModal.classList.add('hidden');
        }
        if (newCharacterNameInput) {
            newCharacterNameInput.value = '';
        }

        await fetchAndPopulateCharacters();
        if (data && data.character_id) {
            currentCharacterId = data.character_id;
            characterSelect.value = currentCharacterId;
        }
        await loadTraderPageData();
    } catch (e) {
        console.error("Error creating character:", e);
        await showCustomModal('Error', 'An unexpected error occurred while creating the character.', [{ text: 'OK', value: true }]);
    }
};

const handleDeleteCharacter = async () => {
    if (!currentCharacterId) {
        await showCustomModal('Info', 'No character selected to delete.', [{ text: 'OK', value: true }]);
        return;
    }

    const characterName = characterSelect.options[characterSelect.selectedIndex].text;

    const confirmed = await showCustomModal(
        'Confirm Deletion',
        `Are you sure you want to delete the character "${characterName}" and all its associated listings and sales history? This action cannot be undone.`,
        [{ text: 'Yes, Delete', value: true, type: 'confirm' }, { text: 'No, Cancel', value: false, type: 'cancel' }]
    );

    if (confirmed) {
        try {
            const { error } = await supabase
                .from('characters')
                .delete()
                .eq('character_id', currentCharacterId)
                .eq('user_id', currentUserId);

            if (error) {
                console.error('Error deleting character:', error.message);
                if (error.code === '23503') {
                    await showCustomModal('Error', 'Cannot delete character. There are active listings or sales history linked to this character. Please delete or mark all listings as sold first.', [{ text: 'OK', value: true }]);
                } else {
                    await showCustomModal('Error', 'Failed to delete character: ' + error.message, [{ text: 'OK', value: true }]);
                }
                return;
            }

            await showCustomModal('Success', `Character "${characterName}" deleted successfully!`, [{ text: 'OK', value: true }]);
            currentCharacterId = null;
            await fetchAndPopulateCharacters(); 
            await loadTraderPageData();

        } catch (e) {
            console.error("Unexpected error deleting character:", e);
            await showCustomModal('Error', 'An unexpected error occurred while deleting the character.', [{ text: 'OK', value: true }]);
        }
    }
};

