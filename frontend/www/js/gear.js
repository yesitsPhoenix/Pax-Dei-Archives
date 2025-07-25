import { supabase } from './supabaseClient.js';

const gearSlots = [
    'head', 'back', 'chest', 'tabard', 'arms', 'gloves',
    'legs', 'feet', 'earring', 'ring1', 'ring2', 'ring3', 'necklace',
    'bracelet1', 'bracelet2'
];

const createGearsetBtn = document.getElementById('createGearsetBtn');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const loadoutImage = document.getElementById('loadoutImage');
const itemModal = document.getElementById('itemModal');
const itemInput = document.getElementById('itemInput');
const addItemBtn = document.getElementById('addItemBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const clearSlotBtn = document.getElementById('clearSlotBtn');
const buildNameInput = document.getElementById('buildNameInput');
const characterSelect = document.getElementById('character-select');
const showCreateCharacterModalBtn = document.getElementById('showCreateCharacterModalBtn');
const createCharacterModal = document.getElementById('createCharacterModal');
const closeCreateCharacterModalBtn = document.getElementById('closeCreateCharacterModalBtn');
const createCharacterFormModal = document.getElementById('create-character-form-modal');
const newCharacterNameInput = document.getElementById('newCharacterNameInput');
const savedBuildsSelect = document.getElementById('savedBuildsSelect');
const saveBuildBtn = document.getElementById('saveBuildBtn');
const loadBuildBtn = document.getElementById('loadBuildBtn');
const confirmationModal = document.getElementById('confirmationModal');
const confirmationMessage = document.getElementById('confirmationMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');

let currentGearset = {
    buildName: '',
    characterName: '',
    slots: {}
};
let characters = [];
let savedBuilds = [];
let activeSlotId = null;

function encodeGearset(gearset) {
    try {
        const jsonString = JSON.stringify(gearset);
        return btoa(jsonString);
    } catch {
        return '';
    }
}

function decodeGearset(encodedString) {
    try {
        const jsonString = atob(decodeURIComponent(encodedString));
        const decoded = JSON.parse(jsonString);
        return {
            buildName: decoded.buildName || '',
            characterName: decoded.characterName || '',
            slots: decoded.slots || {}
        };
    } catch {
        return { buildName: '', characterName: '', slots: {} };
    }
}

function saveCurrentGearsetLocal() {
    if (currentGearset.buildName && currentGearset.characterName) {
        try {
            localStorage.setItem('paxDeiGearset', JSON.stringify(currentGearset));
        } catch (e) {
            console.error("Error saving gearset to localStorage:", e);
        }
    } else {
        localStorage.removeItem('paxDeiGearset');
    }
}

function loadGearsetFromLocalStorage() {
    try {
        const storedGearset = localStorage.getItem('paxDeiGearset');
        return storedGearset ? JSON.parse(storedGearset) : { buildName: '', characterName: '', slots: {} };
    } catch (e) {
        console.error("Error loading gearset from localStorage:", e);
        return { buildName: '', characterName: '', slots: {} };
    }
}

async function loadCharactersFromSupabase() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return [];
    }
    const { data, error } = await supabase
        .from('characters')
        .select('character_name')
        .eq('user_id', user.id);
    if (error) {
        console.error("Error loading characters from Supabase:", error.message);
        return [];
    }
    return data.map(char => char.character_name);
}

async function saveCharacterToSupabase(characterName) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        await showConfirmation("You must be logged in to create a character.");
        return false;
    }
    const { error } = await supabase
        .from('characters')
        .insert([{ character_name: characterName, user_id: user.id }]);
    if (error) {
        console.error("Error saving character to Supabase:", error.message);
        return false;
    }
    return true;
}

function populateCharacterDropdown() {
    characterSelect.innerHTML = '<option value="">Select Character</option>';
    characters.forEach(charName => {
        const option = document.createElement('option');
        option.value = charName;
        option.textContent = charName;
        characterSelect.appendChild(option);
    });
    characterSelect.value = currentGearset.characterName;
}

function updateShareLink(updateUrl = true) {
    const encodedGearset = encodeGearset(currentGearset);
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?gearset=${encodeURIComponent(encodedGearset)}`;
    shareLinkInput.value = shareUrl;
    if (updateUrl) {
        history.replaceState({}, '', shareUrl);
    }
}

function initializeEmptyGearset() {
    currentGearset = {
        buildName: '',
        characterName: characterSelect.value || '',
        slots: {}
    };
    gearSlots.forEach(slot => {
        currentGearset.slots[slot] = '';
        const slotElement = document.getElementById(`slot-${slot}`);
        if (slotElement) {
            slotElement.textContent = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            slotElement.classList.remove('is-set');
        }
    });
    buildNameInput.value = '';
    populateGearSlots(currentGearset.slots);
    saveCurrentGearsetLocal();
    history.replaceState({}, '', window.location.pathname);
    updateShareLink(true);
    refreshSavedBuilds();
}

let buildNameUpdateTimeout = null;

function handleBuildNameInput() {
    currentGearset.buildName = buildNameInput.value.trim();
    saveCurrentGearsetLocal();
    if (buildNameUpdateTimeout) clearTimeout(buildNameUpdateTimeout);
    buildNameUpdateTimeout = setTimeout(() => {
        updateShareLink(true);
    }, 1000);
}

function populateGearSlots(slots) {
    gearSlots.forEach(slot => {
        const slotElement = document.getElementById(`slot-${slot}`);
        const highlight = document.getElementById(`highlight-${slot}`);
        const itemName = slots[slot] || '';
        const slotDisplayName = slot.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        if (slotElement) {
            slotElement.textContent = itemName || slotDisplayName;
            slotElement.classList.toggle('is-set', !!itemName);
        }
        if (highlight) {
            if (itemName) {
                highlight.classList.remove('opacity-0');
                highlight.classList.add('opacity-100');
                highlight.dataset.tooltip = `${slotDisplayName}\n${itemName}`;
            } else {
                highlight.classList.remove('opacity-100');
                highlight.classList.add('opacity-0');
                highlight.dataset.tooltip = slotDisplayName;
            }
        }
    });
    buildNameInput.value = currentGearset.buildName;
    characterSelect.value = currentGearset.characterName;
}

function openModal(slotId) {
    activeSlotId = slotId;
    if (itemInput) itemInput.value = currentGearset.slots[slotId] || '';
    if (itemModal) {
        itemModal.classList.remove('hidden');
        requestAnimationFrame(() => itemModal.classList.remove('opacity-0'));
    }
    const activeSlotElement = document.getElementById(`slot-${activeSlotId}`);
    if (activeSlotElement) activeSlotElement.classList.add('active');
    itemInput.focus();
}

function closeModal() {
    if (itemModal) {
        itemModal.classList.add('opacity-0');
        setTimeout(() => itemModal.classList.add('hidden'), 300);
    }
    if (activeSlotId) {
        const activeSlotElement = document.getElementById(`slot-${activeSlotId}`);
        if (activeSlotElement) activeSlotElement.classList.remove('active');
    }
    activeSlotId = null;
    if (itemInput) itemInput.value = '';
}

function handleAddItem() {
    if (activeSlotId) {
        const itemName = itemInput.value.trim();
        currentGearset.slots[activeSlotId] = itemName;
        populateGearSlots(currentGearset.slots);
        saveCurrentGearsetLocal();
        updateShareLink();
        closeModal();
    }
}

async function handleCharacterSelectChange() {
    currentGearset.characterName = characterSelect.value;
    currentGearset.buildName = '';
    currentGearset.slots = {};
    buildNameInput.value = '';
    populateGearSlots(currentGearset.slots);
    saveCurrentGearsetLocal();
    updateShareLink(true);
    await refreshSavedBuilds();
    if (savedBuilds.length > 0) {
        // If there are saved builds for the selected character, load the first one
        loadBuildByName(savedBuilds[0].build_name);
    } else {
        // If no builds, ensure UI is clean for a new build
        initializeEmptyGearset();
    }
}

function openCreateCharacterModal() {
    newCharacterNameInput.value = '';
    createCharacterModal.classList.remove('hidden');
    requestAnimationFrame(() => createCharacterModal.classList.remove('opacity-0'));
    newCharacterNameInput.focus();
}

function closeCreateCharacterModal() {
    createCharacterModal.classList.add('opacity-0');
    setTimeout(() => createCharacterModal.classList.add('hidden'), 300);
}

async function handleCreateCharacter(event) {
    event.preventDefault();
    const newCharName = newCharacterNameInput.value.trim();
    if (newCharName) {
        if (!characters.includes(newCharName)) {
            const saved = await saveCharacterToSupabase(newCharName);
            if (saved) {
                characters.push(newCharName);
                populateCharacterDropdown();
                characterSelect.value = newCharName;
                currentGearset.characterName = newCharName;
                saveCurrentGearsetLocal();
                closeCreateCharacterModal();
                refreshSavedBuilds();
                initializeEmptyGearset();
            } else {
                await showConfirmation("Failed to create character. Please ensure you are logged in and try again.");
            }
        } else {
            await showConfirmation("Character name already exists!");
        }
    } else {
        await showConfirmation("Character name cannot be empty.");
    }
}

async function loadGearsetsForCharacter(characterName) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return [];
    }
    const { data, error } = await supabase
        .from('gearsets')
        .select('*')
        .eq('user_id', user.id)
        .eq('character_name', characterName)
        .order('updated_at', { ascending: false });
    if (error) {
        console.error("Error loading gearsets from Supabase:", error.message);
        return [];
    }
    return data;
}

async function saveGearsetToSupabase(gearset) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        await showConfirmation("You must be logged in to save a build.");
        return false;
    }
    if (!gearset.characterName) {
        await showConfirmation("Please select a character before saving a build.");
        return false;
    }
    if (!gearset.buildName) {
        await showConfirmation("Please provide a name for your build before saving.");
        return false;
    }

    const { error } = await supabase
        .from('gearsets')
        .upsert([{
            user_id: user.id,
            character_name: gearset.characterName,
            build_name: gearset.buildName,
            gearset_json: gearset.slots,
            updated_at: new Date().toISOString()
        }], { onConflict: ['user_id', 'character_name', 'build_name'] });
    if (error) {
        console.error("Error saving gearset to Supabase:", error.message);
        return false;
    }
    return true;
}

function populateSavedBuildsDropdown() {
    if (!savedBuildsSelect) return;
    savedBuildsSelect.innerHTML = '<option value="">Select a saved build</option>';
    savedBuilds.forEach(build => {
        const option = document.createElement('option');
        option.value = build.build_name;
        option.textContent = build.build_name;
        savedBuildsSelect.appendChild(option);
    });
}

function loadBuildByName(buildName) {
    const build = savedBuilds.find(b => b.build_name === buildName);
    if (!build) return;
    currentGearset.buildName = build.build_name;
    currentGearset.characterName = build.character_name;
    currentGearset.slots = build.gearset_json || {};
    buildNameInput.value = currentGearset.buildName;
    characterSelect.value = currentGearset.characterName;
    populateGearSlots(currentGearset.slots);
    updateShareLink();
    saveCurrentGearsetLocal();
}

async function refreshSavedBuilds() {
    if (!currentGearset.characterName) {
        savedBuilds = [];
        populateSavedBuildsDropdown();
        return;
    }
    savedBuilds = await loadGearsetsForCharacter(currentGearset.characterName);
    populateSavedBuildsDropdown();
}

async function loadGearset() {
    characters = await loadCharactersFromSupabase();
    populateCharacterDropdown();

    const urlParams = new URLSearchParams(window.location.search);
    const encodedGearset = urlParams.get('gearset');

    if (encodedGearset) {
        const decodedGearset = decodeGearset(encodedGearset);
        currentGearset = decodedGearset;

        if (currentGearset.characterName && !characters.includes(currentGearset.characterName)) {
            characters.push(currentGearset.characterName);
            populateCharacterDropdown();
        }

        populateGearSlots(currentGearset.slots);
        buildNameInput.value = currentGearset.buildName;
        characterSelect.value = currentGearset.characterName;

        saveCurrentGearsetLocal();
        updateShareLink(false);
    } else {
        currentGearset = { buildName: '', characterName: '', slots: {} };
        buildNameInput.value = '';
        characterSelect.value = '';
        populateGearSlots({});
        shareLinkInput.value = '';
        history.replaceState({}, '', window.location.pathname);
        localStorage.removeItem('paxDeiGearset');
    }
    await refreshSavedBuilds();
}

if (createGearsetBtn) createGearsetBtn.addEventListener('click', initializeEmptyGearset);

gearSlots.forEach(slot => {
    const slotElement = document.getElementById(`slot-${slot}`);
    if (slotElement) slotElement.addEventListener('click', () => openModal(slot));
});

if (addItemBtn) addItemBtn.addEventListener('click', handleAddItem);
if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
if (clearSlotBtn) clearSlotBtn.addEventListener('click', () => {
    if (activeSlotId) {
        currentGearset.slots[activeSlotId] = '';
        populateGearSlots(currentGearset.slots);
        saveCurrentGearsetLocal();
        updateShareLink();
        closeModal();
    }
});

if (itemInput) {
    itemInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddItem();
        }
    });
}

if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareLinkInput.value);
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => (copyLinkBtn.textContent = 'Copy Link'), 2000);
        } catch {
            shareLinkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => (copyLinkBtn.textContent = 'Copy Link'), 2000);
        }
    });
}

if (buildNameInput) {
    buildNameInput.addEventListener('input', handleBuildNameInput);
}

if (characterSelect) {
    characterSelect.addEventListener('change', handleCharacterSelectChange);
}

if (savedBuildsSelect) {
    savedBuildsSelect.addEventListener('change', () => {
        if (savedBuildsSelect.value) loadBuildByName(savedBuildsSelect.value);
    });
}

if (loadBuildBtn) {
    loadBuildBtn.addEventListener('click', async () => {
        if (!savedBuildsSelect.value) {
            await showConfirmation('Please select a build to load.');
            return;
        }
        const confirmLoad = await showConfirmation(`Load build "${savedBuildsSelect.options[savedBuildsSelect.selectedIndex].text}"? Unsaved changes will be lost.`);
        if (!confirmLoad) return;
        loadBuildByName(savedBuildsSelect.value);
    });
}

if (saveBuildBtn) {
    saveBuildBtn.addEventListener('click', async () => {
        if (!currentGearset.buildName) {
            await showConfirmation('Please enter a build name before saving.');
            return;
        }
        if (!currentGearset.characterName) {
            await showConfirmation('Please select a character before saving.');
            return;
        }
        const confirmSave = await showConfirmation(`Save current build "${currentGearset.buildName}"? This will overwrite existing build if name matches.`);
        if (!confirmSave) return;
        const saved = await saveGearsetToSupabase(currentGearset);
        if (saved) {
            await refreshSavedBuilds();
            await showConfirmation('Build saved successfully!');
        } else {
            await showConfirmation('Failed to save build.');
        }
    });
}

if (showCreateCharacterModalBtn) {
    showCreateCharacterModalBtn.addEventListener('click', openCreateCharacterModal);
}

if (closeCreateCharacterModalBtn) {
    closeCreateCharacterModalBtn.addEventListener('click', closeCreateCharacterModal);
}

if (createCharacterFormModal) {
    createCharacterFormModal.addEventListener('submit', handleCreateCharacter);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && itemModal && !itemModal.classList.contains('hidden')) {
        closeModal();
    }
    if (e.key === 'Escape' && createCharacterModal && !createCharacterModal.classList.contains('hidden')) {
        closeCreateCharacterModal();
    }
    if (e.key === 'Escape' && confirmationModal && !confirmationModal.classList.contains('hidden')) {
        hideConfirmation();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadGearset();
});

function showConfirmation(message) {
    return new Promise((resolve) => {
        confirmationMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        requestAnimationFrame(() => confirmationModal.classList.remove('opacity-0'));

        function cleanUp() {
            confirmationModal.classList.add('opacity-0');
            setTimeout(() => confirmationModal.classList.add('hidden'), 300);
            confirmYesBtn.removeEventListener('click', onYes);
            confirmNoBtn.removeEventListener('click', onNo);
        }

        function onYes() {
            cleanUp();
            resolve(true);
        }

        function onNo() {
            cleanUp();
            resolve(false);
        }

        confirmYesBtn.addEventListener('click', onYes);
        confirmNoBtn.addEventListener('click', onNo);
    });
}

function hideConfirmation() {
    confirmationModal.classList.add('opacity-0');
    setTimeout(() => confirmationModal.classList.add('hidden'), 300);
    confirmYesBtn.replaceWith(confirmYesBtn.cloneNode(true));
    confirmNoBtn.replaceWith(confirmNoBtn.cloneNode(true));
}