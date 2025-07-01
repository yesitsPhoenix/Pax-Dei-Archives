import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';
import { loadTransactionHistory } from './sales.js';
import { renderSalesChart } from './salesChart.js';
import { createDefaultMarketStall } from './actions.js';

const characterSelect = document.getElementById('character-select');
let createCharacterModal = null;
let createCharacterForm = null;
let closeCreateCharacterModalBtn = null;
let newCharacterNameInput = null;
let newCharacterGoldInput = null;
let newCharacterRegionNameSelect = null;
let newCharacterShardSelect = null;
let newCharacterProvinceSelect = null;
let newCharacterHomeValleySelect = null;
let deleteCharacterBtn = null;
const setGoldBtn = document.getElementById('setGoldBtn');
const pveBtn = document.getElementById('pveBtn');


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

                    <div class="mb-4">
                        <label for="newCharacterRegionNameSelect" class="block text-gray-700 text-sm font-bold mb-2">Region Name:</label>
                        <select id="newCharacterRegionNameSelect" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                            <option value="" disabled selected>Select Region Name</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="newCharacterShardSelect" class="block text-gray-700 text-sm font-bold mb-2">Shard:</label>
                        <select id="newCharacterShardSelect" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required disabled>
                            <option value="" disabled selected>Select Shard</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="newCharacterProvinceSelect" class="block text-gray-700 text-sm font-bold mb-2">Province:</label>
                        <select id="newCharacterProvinceSelect" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required disabled>
                            <option value="" disabled selected>Select Province</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="newCharacterHomeValleySelect" class="block text-gray-700 text-sm font-bold mb-2">Home Valley:</label>
                        <select id="newCharacterHomeValleySelect" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required disabled>
                            <option value="" disabled selected>Select Home Valley</option>
                        </select>
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
    newCharacterGoldInput = document.getElementById('newCharacterGoldInput');
    newCharacterRegionNameSelect = document.getElementById('newCharacterRegionNameSelect');
    newCharacterShardSelect = document.getElementById('newCharacterShardSelect');
    newCharacterProvinceSelect = document.getElementById('newCharacterProvinceSelect');
    newCharacterHomeValleySelect = document.getElementById('newCharacterHomeValleySelect');

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

    populateRegionDropdowns();
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
        if (pveBtn) pveBtn.style.display = 'none';
    } else {
        characterSelect.disabled = false;
        if (deleteCharacterBtn) deleteCharacterBtn.style.display = 'inline-block';
        if (setGoldBtn) setGoldBtn.style.display = 'inline-block';
        if (pveBtn) pveBtn.style.display = 'inline-block';

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

const populateRegionDropdowns = async () => {
    const { data, error } = await supabase
        .from('regions')
        .select('region_name')
        .order('region_name', { ascending: true });

    if (error) {
        console.error('Error fetching distinct region names:', error);
        await showCustomModal('Error', 'Failed to load region names. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    const distinctRegionNames = [...new Set(data.map(item => item.region_name))];

    if (newCharacterRegionNameSelect) {
        newCharacterRegionNameSelect.innerHTML = '<option value="" disabled selected>Select Region Name</option>';
        distinctRegionNames.forEach(regionName => {
            const option = document.createElement('option');
            option.value = regionName;
            option.textContent = regionName;
            newCharacterRegionNameSelect.appendChild(option);
        });
        newCharacterRegionNameSelect.disabled = false;
    }

    if (newCharacterRegionNameSelect) {
        newCharacterRegionNameSelect.addEventListener('change', async () => {
            newCharacterShardSelect.innerHTML = '<option value="" disabled selected>Select Shard</option>';
            newCharacterShardSelect.disabled = true;
            newCharacterProvinceSelect.innerHTML = '<option value="" disabled selected>Select Province</option>';
            newCharacterProvinceSelect.disabled = true;
            newCharacterHomeValleySelect.innerHTML = '<option value="" disabled selected>Select Home Valley</option>';
            newCharacterHomeValleySelect.disabled = true;

            const selectedRegionName = newCharacterRegionNameSelect.value;
            if (selectedRegionName) {
                await populateShardDropdowns(selectedRegionName);
            }
        });
    }
};

const populateShardDropdowns = async (regionName) => {
    const { data, error } = await supabase
        .from('regions')
        .select('shard')
        .eq('region_name', regionName)
        .order('shard', { ascending: true });

    if (error) {
        console.error('Error fetching shards:', error);
        await showCustomModal('Error', 'Failed to load shards. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    const distinctShards = [...new Set(data.map(item => item.shard))];

    if (newCharacterShardSelect) {
        newCharacterShardSelect.innerHTML = '<option value="" disabled selected>Select Shard</option>';
        distinctShards.forEach(shard => {
            const option = document.createElement('option');
            option.value = shard;
            option.textContent = shard;
            newCharacterShardSelect.appendChild(option);
        });
        newCharacterShardSelect.disabled = false;
    }

    if (newCharacterShardSelect) {
        newCharacterShardSelect.removeEventListener('change', handleShardChange);
        newCharacterShardSelect.addEventListener('change', handleShardChange);
    }
};

const handleShardChange = async () => {
    newCharacterProvinceSelect.innerHTML = '<option value="" disabled selected>Select Province</option>';
    newCharacterProvinceSelect.disabled = true;
    newCharacterHomeValleySelect.innerHTML = '<option value="" disabled selected>Select Home Valley</option>';
    newCharacterHomeValleySelect.disabled = true;

    const selectedRegionName = newCharacterRegionNameSelect.value;
    const selectedShard = newCharacterShardSelect.value;
    if (selectedRegionName && selectedShard) {
        await populateProvinceDropdowns(selectedRegionName, selectedShard);
    }
};

const populateProvinceDropdowns = async (regionName, shard) => {
    const { data, error } = await supabase
        .from('regions')
        .select('province')
        .eq('region_name', regionName)
        .eq('shard', shard)
        .order('province', { ascending: true });

    if (error) {
        console.error('Error fetching provinces:', error);
        await showCustomModal('Error', 'Failed to load provinces. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    const distinctProvinces = [...new Set(data.map(item => item.province))];

    if (newCharacterProvinceSelect) {
        newCharacterProvinceSelect.innerHTML = '<option value="" disabled selected>Select Province</option>';
        distinctProvinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            newCharacterProvinceSelect.appendChild(option);
        });
        newCharacterProvinceSelect.disabled = false;
    }

    if (newCharacterProvinceSelect) {
        newCharacterProvinceSelect.removeEventListener('change', handleProvinceChange);
        newCharacterProvinceSelect.addEventListener('change', handleProvinceChange);
    }
};

const handleProvinceChange = async () => {
    newCharacterHomeValleySelect.innerHTML = '<option value="" disabled selected>Select Home Valley</option>';
    newCharacterHomeValleySelect.disabled = true;

    const selectedRegionName = newCharacterRegionNameSelect.value;
    const selectedShard = newCharacterShardSelect.value;
    const selectedProvince = newCharacterProvinceSelect.value;
    if (selectedRegionName && selectedShard && selectedProvince) {
        await populateHomeValleyDropdowns(selectedRegionName, selectedShard, selectedProvince);
    }
};

const populateHomeValleyDropdowns = async (regionName, shard, province) => {
    const { data, error } = await supabase
        .from('regions')
        .select('home_valley')
        .eq('region_name', regionName)
        .eq('shard', shard)
        .eq('province', province)
        .order('home_valley', { ascending: true });

    if (error) {
        console.error('Error fetching home valleys:', error);
        await showCustomModal('Error', 'Failed to load home valleys. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    const distinctHomeValleys = [...new Set(data.map(item => item.home_valley))];

    if (newCharacterHomeValleySelect) {
        newCharacterHomeValleySelect.innerHTML = '<option value="" disabled selected>Select Home Valley</option>';
        distinctHomeValleys.forEach(homeValley => {
            const option = document.createElement('option');
            option.value = homeValley;
            option.textContent = homeValley;
            newCharacterHomeValleySelect.appendChild(option);
        });
        newCharacterHomeValleySelect.disabled = false;
    }
};

const handleCreateCharacter = async (e) => {
    e.preventDefault();
    const characterName = newCharacterNameInput.value.trim();
    const initialGold = parseInt(newCharacterGoldInput.value, 10);
    const selectedRegionName = newCharacterRegionNameSelect.value;
    const selectedShard = newCharacterShardSelect.value;
    const selectedProvince = newCharacterProvinceSelect.value;
    const selectedHomeValley = newCharacterHomeValleySelect.value;


    if (!characterName) {
        await showCustomModal('Validation Error', 'Character name cannot be empty.', [{ text: 'OK', value: true }]);
        return;
    }

    if (isNaN(initialGold) || initialGold < 0) {
        await showCustomModal('Validation Error', 'Starting gold must be a non-negative number.', [{ text: 'OK', value: true }]);
        return;
    }

    if (!selectedRegionName || !selectedShard || !selectedProvince || !selectedHomeValley) {
        await showCustomModal('Validation Error', 'Please select a Region Name, Shard, Province, and Home Valley.', [{ text: 'OK', value: true }]);
        return;
    }

    const { data: regionEntry, error: regionEntryError } = await supabase
        .from('regions')
        .select('id')
        .eq('region_name', selectedRegionName)
        .eq('shard', selectedShard)
        .eq('province', selectedProvince)
        .eq('home_valley', selectedHomeValley)
        .single();

    if (regionEntryError || !regionEntry) {
        console.error('Error fetching region entry ID:', regionEntryError);
        await showCustomModal('Error', 'Failed to find the selected region combination. Please ensure all fields are correctly selected.', [{ text: 'OK', value: true }]);
        return;
    }
    const regionEntryId = regionEntry.id;


    const { data, error } = await supabase
        .from('characters')
        .insert([{ user_id: currentUserId, character_name: characterName, gold: initialGold, region: selectedRegionName, region_entry_id: regionEntryId }])
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

    await createDefaultMarketStall(currentCharacterId, characterName);

    await showCustomModal('Success', `Character "${characterName}" created successfully with ${initialGold.toLocaleString()} gold in ${selectedRegionName} (${selectedShard}, ${selectedProvince}, ${selectedHomeValley})!`, [{ text: 'OK', value: true }]);
    if (createCharacterModal) {
        createCharacterModal.classList.add('hidden');
    }
    newCharacterNameInput.value = '';
    newCharacterGoldInput.value = '0';
    newCharacterRegionNameSelect.value = '';
    newCharacterShardSelect.innerHTML = '<option value="" disabled selected>Select Shard</option>';
    newCharacterProvinceSelect.innerHTML = '<option value="" disabled selected>Select Province</option>';
    newCharacterHomeValleySelect.innerHTML = '<option value="" disabled selected>Select Home Valley</option>';
    
    newCharacterShardSelect.disabled = true;
    newCharacterProvinceSelect.disabled = true;
    newCharacterHomeValleySelect.disabled = true;

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

const updateCharacterGoldByPveTransaction = async (newTotalGold, description = '') => {
    if (!currentCharacterId) {
        await showCustomModal("Error", "No character selected to record PVE gold.", [{ text: 'OK', value: true }]);
        return;
    }
    if (!currentUserId) {
        await showCustomModal("Error", "User not authenticated. Cannot record PVE transaction.", [{ text: 'OK', value: true }]);
        console.error("Attempted PVE transaction without authenticated user_id.");
        return;
    }

    const currentCharacter = await getCurrentCharacter();
    if (!currentCharacter) {
        return;
    }

    const goldChange = newTotalGold - currentCharacter.gold;

    if (newTotalGold < 0) {
        await showCustomModal("Validation Error", "PVE transaction would result in negative gold. Please enter a valid non-negative amount.", [{ text: 'OK', value: true }]);
        return;
    }
    
    if (goldChange === 0) {
        await showCustomModal('Info', 'Gold amount is unchanged. No PVE transaction recorded.', [{ text: 'OK', value: true }]);
        return;
    }

    const { error: updateCharError } = await supabase
        .from('characters')
        .update({ gold: newTotalGold })
        .eq('character_id', currentCharacterId)
        .eq('user_id', currentUserId);

    if (updateCharError) {
        await showCustomModal('Error', `Error updating character gold for PVE: ${updateCharError.message}`, [{ text: 'OK', value: true }]);
        console.error('Error updating character gold for PVE:', updateCharError.message);
        return;
    }

    const finalDescription = description.trim() !== ''
        ? description
        : (goldChange >= 0 ? `PVE Gold Change: +${goldChange.toLocaleString()}` : `PVE Gold Change: ${goldChange.toLocaleString()}`);

    const { error: insertPveError } = await supabase
        .from('pve_transactions')
        .insert([
            {
                character_id: currentCharacterId,
                gold_amount: goldChange,
                description: finalDescription,
                user_id: currentUserId
            }
        ]);

    if (insertPveError) {
        console.error('Error recording PVE transaction:', insertPveError.message);
        await showCustomModal('Error', `Failed to record PVE transaction: ${insertPveError.message}. Gold updated, but transaction history might be incomplete.`, [{ text: 'OK', value: true }]);
        return;
    }

    const message = `Character gold set to ${newTotalGold.toLocaleString()}. Recorded change: ${goldChange >= 0 ? '+' : ''}${goldChange.toLocaleString()} gold. Reason: ${finalDescription}.`;

    await showCustomModal('Success', message, [{ text: 'OK', value: true }]);
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

const showPveGoldInputModal = async (onConfirm, onCancel) => {
    const modalId = `pveGoldInputModal-${Date.now()}`;

    const currentCharacter = await getCurrentCharacter();
    const currentGold = currentCharacter ? currentCharacter.gold : 0;

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full text-gray-800">
                <h3 class="text-xl font-bold mb-4">Set Character Gold (PVE)</h3>
                
                <div class="mb-4">
                    <label for="pveGoldAmountInput" class="block text-sm font-bold mb-2">New Total Gold</label>
                    <p class="text-sm text-gray-600 mb-1">Current: ${currentGold.toLocaleString()}</p>
                    <input type="number" id="pveGoldAmountInput" class="w-full p-2 border border-gray-300 rounded-md" value="${currentGold}">
                </div>

                <div class="mb-4">
                    <label for="pveGoldChangeInput" class="block text-sm font-bold mb-2">Adjustment (+/-)</label>
                    <input type="number" id="pveGoldChangeInput" placeholder="e.g., 5 or -20" class="w-full p-2 border border-gray-300 rounded-md">
                </div>

                <div class="mb-6">
                    <label for="pveDescriptionInput" class="block text-sm font-bold mb-2">Description (Optional)</label>
                    <input type="text" id="pveDescriptionInput" placeholder="e.g., Daily quest reward" class="w-full p-2 border border-gray-300 rounded-md">
                </div>

                <div class="flex justify-end gap-3">
                    <button id="cancelPveGold" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
                    <button id="confirmPveGold" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Set & Record</button>
                </div>
                <p id="pveGoldInputError" class="text-red-500 text-sm mt-3 text-right" style="display:none;"></p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.getElementById(modalId);
    const pveGoldAmountInput = document.getElementById('pveGoldAmountInput');
    const pveGoldChangeInput = document.getElementById('pveGoldChangeInput');
    const pveDescriptionInput = document.getElementById('pveDescriptionInput');
    const confirmButton = document.getElementById('confirmPveGold');
    const cancelButton = document.getElementById('cancelPveGold');
    const errorEl = document.getElementById('pveGoldInputError');
    
    pveGoldChangeInput.addEventListener('input', () => {
        const adjustment = parseInt(pveGoldChangeInput.value, 10);
        if (!isNaN(adjustment)) {
            pveGoldAmountInput.value = currentGold + adjustment;
        } else if (pveGoldChangeInput.value.trim() === '') {
             pveGoldAmountInput.value = currentGold;
        }
    });

    pveGoldAmountInput.addEventListener('input', () => {
        pveGoldChangeInput.value = '';
    });


    confirmButton.addEventListener('click', () => {
        const newTotalGold = parseInt(pveGoldAmountInput.value, 10);
        const description = pveDescriptionInput.value.trim();

        if (!isNaN(newTotalGold) && newTotalGold >= 0) {
            onConfirm(newTotalGold, description);
            modalElement.remove();
        } else {
            errorEl.textContent = 'Please enter a valid non-negative number for the new total gold.';
            errorEl.style.display = 'block';
        }
    });

    cancelButton.addEventListener('click', () => {
        onCancel();
        modalElement.remove();
    });

    pveGoldAmountInput.focus();
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

    if (pveBtn) {
        pveBtn.addEventListener('click', async () => {
            if (!currentCharacterId) {
                showCustomModal("Error", "Please select a character first to record PVE gold.", [{ text: 'OK', value: true }]);
                return;
            }
            
            await showPveGoldInputModal(
                async (newTotalGold, description) => {
                    await updateCharacterGoldByPveTransaction(newTotalGold, description);
                },
                () => {
                    console.log("PVE Gold transaction cancelled.");
                }
            );
        });
    }
};