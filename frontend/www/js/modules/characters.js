// characters.js
import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';
import { loadTransactionHistory, } from './sales.js';
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

const addPveTransactionModal = document.getElementById('addPveTransactionModal');
const addPveTransactionForm = document.getElementById('add-pve-transaction-form');
const pveTransactionTypeSelect = document.getElementById('pve-transaction-type');
const pveAmountInput = document.getElementById('pve-amount');
const closeAddPveTransactionModalBtn = document.getElementById('closeAddPveTransactionModalBtn');

let currentUserId = null;
export let currentCharacterId = null;
export let currentCharacterGold = 0;
let cachedUserCharacters = [];
let _currentCharacter = null;
let cachedRegions = null;

export const setCurrentCharacterGold = (gold) => {
    currentCharacterGold = gold;
    if (_currentCharacter) {
        _currentCharacter.gold = gold;
    }
};


export const loadCurrentCharacterData = () => {
    if (currentCharacterId) {
        loadTraderPageData(currentCharacterId);
    }
};


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

export const initializeCharacters = async (userId = null, onCharacterSelectedCallback) => {
    document.body.addEventListener('statsNeedRefresh', loadCurrentCharacterData);
    if (!userId) {
        const session = await supabase.auth.getSession();
        userId = session?.data?.session?.user?.id;
    }

    if (!userId) {
        console.warn("initializeCharacters: No valid user ID found.");
        return;
    }

    currentUserId = userId;
    await loadCharacters(onCharacterSelectedCallback);
    deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
    addCharacterEventListeners();
};


export const loadCharacters = async (onCharacterSelectedCallback) => {
    if (!currentUserId) {
        console.warn("No currentUserId set. Cannot load characters.");
        return;
    }

    const characterSelect = document.getElementById('character-select');
    if (!characterSelect) {
        console.warn("characterSelect element not found in DOM.");
        return;
    }

    const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
    const setGoldBtn = document.getElementById('setGoldBtn');
    const pveBtn = document.getElementById('pveBtn');

    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name, gold')
        .eq('user_id', currentUserId);

    if (error) {
        console.error('Error fetching characters:', error.message);
        await showCustomModal('Error', 'Failed to load characters: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    cachedUserCharacters = data || [];
    const characters = cachedUserCharacters;
    characterSelect.innerHTML = '';

    if (characters.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No characters available. Create one!';
        characterSelect.appendChild(option);
        characterSelect.disabled = true;
        currentCharacterId = null;
        _currentCharacter = null; 
        setCurrentCharacterGold(0);
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
        _currentCharacter = characters.find(char => char.character_id === currentCharacterId);
        setCurrentCharacterGold(_currentCharacter ? _currentCharacter.gold : 0);
    }

    if (onCharacterSelectedCallback) {
        await onCharacterSelectedCallback();
    }
};


const showAddPveTransactionModal = async () => {
    if (addPveTransactionModal) {
        addPveTransactionModal.classList.remove('hidden');
        if (pveAmountInput) {
            pveAmountInput.value = currentCharacterGold;
        }
        if (pveTransactionTypeSelect) {
            pveTransactionTypeSelect.value = "";
        }
    }
};

const hideAddPveTransactionModal = () => {
    if (addPveTransactionModal) {
        addPveTransactionModal.classList.add('hidden');
    }
};

const handleCharacterSelection = async (event) => {
    currentCharacterId = event.target.value;
    _currentCharacter = cachedUserCharacters.find(char => char.character_id === currentCharacterId);
    if (_currentCharacter) {
        setCurrentCharacterGold(_currentCharacter.gold);
    } else {
        setCurrentCharacterGold(0); 
    }
    await loadTraderPageData();
};

const populateRegionDropdowns = async () => {
    if (cachedRegions === null) {
        const { data, error } = await supabase
            .from('regions')
            .select('id, region_name, shard, province, home_valley')
            .order('region_name', { ascending: true })
            .order('shard', { ascending: true })
            .order('province', { ascending: true })
            .order('home_valley', { ascending: true });

        if (error) {
            console.error('Error fetching all regions for caching:', error);
            await showCustomModal('Error', 'Failed to load region data. Please try again.', [{ text: 'OK', value: true }]);
            return;
        }
        cachedRegions = data;
    }

    const distinctRegionNames = [...new Set(cachedRegions.map(item => item.region_name))];

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
                populateShardDropdowns(selectedRegionName);
            }
        });
    }
};

const populateShardDropdowns = (regionName) => {
    const filteredShards = cachedRegions.filter(item => item.region_name === regionName);
    const distinctShards = [...new Set(filteredShards.map(item => item.shard))];

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
        populateProvinceDropdowns(selectedRegionName, selectedShard);
    }
};

const populateProvinceDropdowns = (regionName, shard) => {
    const filteredProvinces = cachedRegions.filter(item => item.region_name === regionName && item.shard === shard);
    const distinctProvinces = [...new Set(filteredProvinces.map(item => item.province))];

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
        populateHomeValleyDropdowns(selectedRegionName, selectedShard, selectedProvince);
    }
};

const populateHomeValleyDropdowns = (regionName, shard, province) => {
    const filteredHomeValleys = cachedRegions.filter(item => item.region_name === regionName && item.shard === shard && item.province === province);
    const distinctHomeValleys = [...new Set(filteredHomeValleys.map(item => item.home_valley))];

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

  const regionEntry = cachedRegions.find(
    r => r.region_name === selectedRegionName &&
         r.shard === selectedShard &&
         r.province === selectedProvince &&
         r.home_valley === selectedHomeValley
  );

  if (!regionEntry) {
    console.error('Error: Selected region combination not found in cache.');
    await showCustomModal('Error', 'Failed to find the selected region combination. Please ensure all fields are correctly selected.', [{ text: 'OK', value: true }]);
    return;
  }
  const regionEntryId = regionEntry.id;


  const { data, error } = await supabase
    .from('characters')
    .insert([{ 
        user_id: currentUserId, 
        character_name: characterName, 
        gold: initialGold, 
        region: selectedRegionName, 
        shard: selectedShard, 
        province: selectedProvince, 
        home_valley: selectedHomeValley, 
        region_entry_id: regionEntryId 
    }])
    .select('character_id, character_name, gold');

  if (error) {
    if (error.code === '23505') {
      await showCustomModal('Error', `A character with the name "${characterName}" already exists for your account.`, [{ text: 'OK', value: true }]);
    } else {
      await showCustomModal('Error', 'Error creating character: ' + error.message, [{ text: 'OK', value: true }]);
    }
    console.error('Error creating character:', error.message);
    return;
  }

  const newCharacter = data[0];
  currentCharacterId = newCharacter.character_id;
  _currentCharacter = newCharacter;
  setCurrentCharacterGold(newCharacter.gold);
  cachedUserCharacters.push(newCharacter);

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

export const handleDeleteCharacter = async (characterIdParam = null) => {
    const characterId = characterIdParam || currentCharacterId;

    if (!characterId) {
        await showCustomModal("Error", "No character selected to delete.", [{ text: 'OK', value: true }]);
        return;
    }

    try {
        const { data: marketStalls, error: marketStallError } = await supabase
            .from('market_stalls')
            .select('id')
            .eq('character_id', characterId);

        if (marketStallError) {
            throw marketStallError;
        }

        if (marketStalls?.length > 0) {
            const stallIds = marketStalls.map(stall => stall.id);
            const { data: listings, error: listingsError } = await supabase
                .from('market_listings')
                .select('listing_id, is_fully_sold, is_cancelled')
                .in('market_stall_id', stallIds);

            if (listingsError) {
                throw listingsError;
            }

            const hasActiveListings = listings.some(listing => !listing.is_fully_sold && !listing.is_cancelled);
            if (hasActiveListings) {
                await showCustomModal(
                    'Deletion Failed',
                    'This character cannot be deleted because they still have active listings in their market stalls. Please cancel or mark all listings as sold first.',
                    [{ text: 'OK', value: true }]
                );
                return;
            }
        }
    } catch (e) {
        console.error('Error checking for active listings:', e.message);
        await showCustomModal(
            'Error',
            'Failed to check for active listings. Please try again.',
            [{ text: 'OK', value: true }]
        );
        return;
    }

    const confirmed = await showCustomModal(
        'Confirmation',
        'Are you sure you want to delete this character and all associated data? This action cannot be undone.',
        [
            { text: 'Yes, Delete', value: true, type: 'confirm' },
            { text: 'No', value: false, type: 'cancel' }
        ]
    );

    if (!confirmed) return;

    try {
        if (!currentUserId) {
            const session = await supabase.auth.getSession();
            currentUserId = session?.data?.session?.user?.id;
            if (!currentUserId) {
                await showCustomModal('Error', 'Could not confirm your session. Please re-login.', [{ text: 'OK', value: true }]);
                return;
            }
        }

        const { error } = await supabase
            .from('characters')
            .delete()
            .eq('character_id', characterId)
            .eq('user_id', currentUserId);

        if (error) throw error;

        const card = document.getElementById(`character-card-${characterId}`);
        if (card?.parentElement) {
            card.parentElement.removeChild(card);
        }

        await showCustomModal('Success', 'Character deleted successfully!', [{ text: 'OK', value: true }]);

        cachedUserCharacters = cachedUserCharacters.filter(char => char.character_id !== characterId);
        _currentCharacter = null; 

        await loadCharacters(loadTraderPageData);
        if (document.getElementById('listingsContainer')) {
            loadTransactionHistory();
            renderSalesChart();
        }
    } catch (e) {
        console.error('Error deleting character:', e.message);
        await showCustomModal('Error', 'Failed to delete character: ' + e.message, [{ text: 'OK', value: true }]);
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

    setCurrentCharacterGold(newGoldAmount);

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

  const { data: characterData, error: fetchCharError } = await supabase
    .from('characters')
    .select('gold')
    .eq('character_id', currentCharacterId)
    .single();

  if (fetchCharError) {
    await showCustomModal('Error', `Error fetching current character gold: ${fetchCharError.message}`, [{ text: 'OK', value: true }]);
    console.error('Error fetching current character gold:', fetchCharError.message);
    return;
  }

  const currentCharacterGold = characterData.gold;

  const goldChange = newTotalGold - currentCharacterGold;

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

  setCurrentCharacterGold(newTotalGold);

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

    // Use currentCharacterGold directly from the global export
    const currentGold = currentCharacterGold;

    const modalHtml = `
        <div id="${modalId}" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full text-gray-800">
                <h3 class="text-xl font-bold mb-4">Set Character Gold (PVE)</h3>

                <div class="mb-4">
                    <label for="pveGoldAmountInput" class="block text-sm font-bold mb-2">New Total Gold</label>
                    <p class="text-lg text-white-600 mb-1">Current: ${currentGold.toLocaleString()}</p>
                    <input type="number" id="pveGoldAmountInput" class="w-full p-2 border border-gray-300 rounded-md" value="${currentGold}">
                </div>

                <div class="mb-4">
                    <label for="pveGoldChangeInput" class="block text-sm font-bold mb-2">Adjustment (+/-)</label>
                    <input type="number" id="pveGoldChangeInput" placeholder="e.g., 5 or -20" class="w-full p-2 border border-gray-300 rounded-md">
                </div>

                <div class="mb-6">
                    <label for="pveDescriptionInput" class="block text-sm font-bold mb-2">Description (Optional)</label>
                    <input type="text" id="pveDescriptionInput" placeholder="e.g., POI clear, Chest Deposit" class="w-full p-3 border border-gray-300 rounded-md">
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

export const getCurrentCharacter = async (forceRefresh = false) => {
    if (!currentCharacterId) return null;

    if (!forceRefresh && _currentCharacter && _currentCharacter.character_id === currentCharacterId) {
        return _currentCharacter;
    }

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
    _currentCharacter = data;
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
                    //console.log("Set Gold operation cancelled.");
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

            showAddPveTransactionModal();
        });
    }

    if (addPveTransactionForm) {
        addPveTransactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const transactionType = pveTransactionTypeSelect.value;
            const newAmount = parseInt(pveAmountInput.value, 10);

            if (!transactionType || isNaN(newAmount)) {
                showCustomModal("Error", "Please select a transaction type and enter a valid gold amount.", [{ text: 'OK', value: true }]);
                return;
            }

            await updateCharacterGoldByPveTransaction(newAmount, transactionType);
            hideAddPveTransactionModal();
        });
    }

    if (closeAddPveTransactionModalBtn) {
        closeAddPveTransactionModalBtn.addEventListener('click', hideAddPveTransactionModal);
    }
};

export const setCurrentUserId = (id) => {
    currentUserId = id;
};