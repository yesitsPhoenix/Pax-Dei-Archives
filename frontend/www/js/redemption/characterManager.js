import { questState } from './questStateManager.js';
import { supabase } from '../supabaseClient.js';

export let currentCharacterId = null;
let currentUserId = null;
let cachedRegions = null;

/**
 * Create a default market stall for a new character
 * This is a lightweight version that doesn't import heavy trader dependencies
 */
const createDefaultMarketStall = async (characterId, characterName) => {
    if (!characterId || !characterName) {
        console.error('createDefaultMarketStall: Missing characterId or characterName');
        return null;
    }

    const defaultStallName = `${characterName} - Default Stall`;

    try {
        const { data, error } = await supabase
            .from('market_stalls')
            .insert({
                stall_name: defaultStallName,
                character_id: characterId,
                is_default_stall: true
            })
            .select('id')
            .single();

        if (error) throw error;

        return data.id;
    } catch (e) {
        console.error('createDefaultMarketStall: Error creating default market stall:', e.message);
        return null;
    }
};

const showToast = (message, isError = false) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-[300] flex flex-col items-end';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    const bgClass = isError ? 'bg-[#1a0f0f]' : 'bg-[#111827]';
    const borderClass = isError ? 'border-red-900/50' : 'border-[#FFD700]/50';
    const textClass = isError ? 'text-red-300' : 'text-[#FFD700]';

    toast.className = `mb-3 px-6 py-3 rounded-lg shadow-2xl border font-bold uppercase text-xs flex items-center gap-3 transition-all duration-500 opacity-0 translate-y-2 ${bgClass} ${borderClass} ${textClass}`;
    
    toast.innerHTML = `
        <i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-check-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

export const initializeCharacterSystem = async (characterId = null) => {
    const user = questState.getUser();
    if (user) {
        currentUserId = user.id;
    }

    await fetchCharacters();
    setupNewCharacterButton();
    setupCharacterFormListener();
};

export const fetchCharacters = async (selectedId = null) => {
    const characterSelect = document.getElementById('character-select');
    if (!characterSelect) return;

    const characters = questState.getCharacters();
    
    if (!characters || characters.length === 0) {
        return;
    }
    
    characterSelect.innerHTML = '';

    characters.forEach(char => {
        const option = document.createElement('option');
        option.value = char.character_id;
        option.textContent = char.character_name;
        characterSelect.appendChild(option);
    });

    // Priority order for selecting character:
    // 1. Passed selectedId parameter (highest priority)
    // 2. Active character from questState (which reads from sessionStorage)
    // 3. First character in the list (fallback)
    let targetCharId = null;
    
    if (selectedId && characters.some(c => c.character_id === selectedId)) {
        targetCharId = selectedId;
    } else {
        const activeCharId = questState.getActiveCharacterId();
        
        if (activeCharId && characters.some(c => c.character_id === activeCharId)) {
            targetCharId = activeCharId;
        } else if (characters.length > 0) {
            targetCharId = characters[0].character_id;
            // If no character was in sessionStorage, set the first one as active
            await questState.setActiveCharacter(targetCharId);
        }
    }
    
    if (targetCharId) {
        characterSelect.value = targetCharId;
        currentCharacterId = targetCharId;
        
        // Force verify the dropdown value was set correctly
        setTimeout(() => {
            if (characterSelect.value !== targetCharId) {
                characterSelect.value = targetCharId;
            }
        }, 100);
    }

    if (!characterSelect.hasAttribute('data-listener-set')) {
        characterSelect.addEventListener('change', async (e) => {
            const newCharId = e.target.value;
            await questState.setActiveCharacter(newCharId);
            currentCharacterId = newCharId;

            const url = new URL(window.location);
            url.searchParams.delete('quest');
            window.history.replaceState({}, '', url.pathname);
            
            window.dispatchEvent(new CustomEvent('characterChanged', { 
                detail: { characterId: newCharId } 
            }));
        });
        characterSelect.setAttribute('data-listener-set', 'true');
    }
    
    setupNewCharacterButton();
};

/**
 * Populate region dropdowns for character creation with cascading
 */
export async function populateCharacterRegionDropdowns() {
    if (!cachedRegions) {
        const { data, error } = await supabase
            .from('regions')
            .select('id, region_name, shard, province, home_valley')
            .order('region_name', { ascending: true })
            .order('shard', { ascending: true })
            .order('province', { ascending: true })
            .order('home_valley', { ascending: true });

        if (error) {
            console.error('Error fetching regions:', error);
            showToast('Failed to load region data.', true);
            return;
        }
        cachedRegions = data;
    }

    const regionSelect = document.getElementById('newCharacterRegionSelect');
    const shardSelect = document.getElementById('newCharacterShardSelect');
    const provinceSelect = document.getElementById('newCharacterProvinceSelect');
    const valleySelect = document.getElementById('newCharacterHomeValleySelect');

    if (!regionSelect || !shardSelect || !provinceSelect || !valleySelect) return;

    // Get distinct regions
    const distinctRegions = [...new Set(cachedRegions.map(r => r.region_name))];

    regionSelect.innerHTML = '<option value="">Select Region</option>';
    distinctRegions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        // Change USA to NA for display
        option.textContent = region === 'USA' ? 'NA' : region;
        regionSelect.appendChild(option);
    });

    // Reset dependent dropdowns
    shardSelect.innerHTML = '<option value="">Select Region First</option>';
    shardSelect.disabled = true;
    provinceSelect.innerHTML = '<option value="">Select Shard First</option>';
    provinceSelect.disabled = true;
    valleySelect.innerHTML = '<option value="">Select Province First</option>';
    valleySelect.disabled = true;

    // Region change handler
    regionSelect.onchange = () => {
        const filtered = cachedRegions.filter(r => r.region_name === regionSelect.value);
        const shards = [...new Set(filtered.map(r => r.shard))];

        shardSelect.innerHTML = '<option value="">Select Shard</option>';
        shards.forEach(shard => {
            const option = document.createElement('option');
            option.value = shard;
            option.textContent = shard;
            shardSelect.appendChild(option);
        });
        shardSelect.disabled = false;

        provinceSelect.innerHTML = '<option value="">Select Shard First</option>';
        provinceSelect.disabled = true;
        valleySelect.innerHTML = '<option value="">Select Province First</option>';
        valleySelect.disabled = true;
    };

    // Shard change handler
    shardSelect.onchange = () => {
        const filtered = cachedRegions.filter(r =>
            r.region_name === regionSelect.value &&
            r.shard === shardSelect.value
        );
        const provinces = [...new Set(filtered.map(r => r.province))];

        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            provinceSelect.appendChild(option);
        });
        provinceSelect.disabled = false;

        valleySelect.innerHTML = '<option value="">Select Province First</option>';
        valleySelect.disabled = true;
    };

    // Province change handler
    provinceSelect.onchange = () => {
        const filtered = cachedRegions.filter(r =>
            r.region_name === regionSelect.value &&
            r.shard === shardSelect.value &&
            r.province === provinceSelect.value
        );

        valleySelect.innerHTML = '<option value="">Select Valley</option>';
        filtered.forEach(item => {
            const option = document.createElement('option');
            option.value = item.home_valley;
            option.textContent = item.home_valley;
            option.dataset.id = item.id;
            valleySelect.appendChild(option);
        });
        valleySelect.disabled = false;
    };
}

const setupNewCharacterButton = () => {
    const btn1 = document.getElementById('showCreateCharacterModalBtn');
    const btn2 = document.getElementById('showCreateCharacterModalBtn2');
    const modal = document.getElementById('createCharacterModal');
    const closeBtn = document.getElementById('closeCreateCharacterModalBtn');

    const openModal = async (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        await populateCharacterRegionDropdowns();
    };

    if (btn1 && modal) {
        btn1.onclick = openModal;
    }

    if (btn2 && modal) {
        btn2.onclick = openModal;
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            const form = document.getElementById('createCharacterForm');
            if (form) form.reset();
        };
    }
};

const setupCharacterFormListener = () => {
    const createCharacterForm = document.getElementById('questsCreateCharacterForm');
    if (!createCharacterForm) return;

    createCharacterForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitBtn = createCharacterForm.querySelector('button[type="submit"]');
        const characterName = document.getElementById('newCharacterNameInput').value;

        // Get region fields
        const regionSelect = document.getElementById('newCharacterRegionSelect');
        const shardSelect = document.getElementById('newCharacterShardSelect');
        const provinceSelect = document.getElementById('newCharacterProvinceSelect');
        const valleySelect = document.getElementById('newCharacterHomeValleySelect');

        if (submitBtn.disabled) return;

        // Validate required fields
        if (!characterName || !characterName.trim()) {
            showToast("Character name is required", true);
            return;
        }

        // Check if region fields exist and validate them
        if (regionSelect && shardSelect && provinceSelect && valleySelect) {
            if (!regionSelect.value || !shardSelect.value || !provinceSelect.value || !valleySelect.value) {
                showToast("Please fill in all region fields", true);
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';

        if (!currentUserId) {
            showToast("User not logged in", true);
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.textContent = originalText;
            return;
        }

        try {
            // Prepare region data if fields exist
            let regionData = null;
            if (regionSelect && valleySelect) {
                const selectedOption = valleySelect.options[valleySelect.selectedIndex];
                const regionEntryId = selectedOption ? selectedOption.dataset.id : null;

                if (regionEntryId) {
                    regionData = {
                        region: regionSelect.value,
                        shard: shardSelect.value,
                        province: provinceSelect.value,
                        home_valley: valleySelect.value,
                        region_entry_id: regionEntryId
                    };
                }
            }

            const data = await questState.addCharacter(characterName.trim(), regionData);

            // Create default market stall for the new character
            await createDefaultMarketStall(data.character_id, characterName.trim());

            showToast(`Character "${characterName}" created!`);

            const modal = document.getElementById('createCharacterModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
            createCharacterForm.reset();

            await questState.setActiveCharacter(data.character_id);

            await fetchCharacters(data.character_id);

            window.dispatchEvent(new CustomEvent('characterChanged', {
                detail: { characterId: data.character_id }
            }));

        } catch (e) {
            console.error('Error creating character:', e.message);
            showToast(e.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.textContent = originalText;
        }
    });
};