import { questState } from './questStateManager.js';

export let currentCharacterId = null;
let currentUserId = null;

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
        console.log('[CharacterManager] Using passed selectedId:', selectedId);
        targetCharId = selectedId;
    } else {
        const activeCharId = questState.getActiveCharacterId();
        const sessionCharId = sessionStorage.getItem('active_character_id');
        console.log('[CharacterManager] Active from questState:', activeCharId);
        console.log('[CharacterManager] Active from sessionStorage:', sessionCharId);
        
        if (activeCharId && characters.some(c => c.character_id === activeCharId)) {
            targetCharId = activeCharId;
            console.log('[CharacterManager] Using active character:', targetCharId);
        } else if (characters.length > 0) {
            targetCharId = characters[0].character_id;
            console.log('[CharacterManager] No active character, using first:', targetCharId);
            // If no character was in sessionStorage, set the first one as active
            await questState.setActiveCharacter(targetCharId);
        }
    }
    
    if (targetCharId) {
        console.log('[CharacterManager] Setting dropdown to:', targetCharId);
        characterSelect.value = targetCharId;
        currentCharacterId = targetCharId;
        
        // Force verify the dropdown value was set correctly
        setTimeout(() => {
            if (characterSelect.value !== targetCharId) {
                console.warn('[CharacterManager] Dropdown value mismatch! Forcing set...');
                characterSelect.value = targetCharId;
            }
        }, 100);
    }

    if (!characterSelect.hasAttribute('data-listener-set')) {
        characterSelect.addEventListener('change', async (e) => {
            const newCharId = e.target.value;
            console.log('[CharacterManager] Character changed to:', newCharId);
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

const setupNewCharacterButton = () => {
    const btn1 = document.getElementById('showCreateCharacterModalBtn');
    const btn2 = document.getElementById('showCreateCharacterModalBtn2');
    const modal = document.getElementById('createCharacterModal');
    const closeBtn = document.getElementById('closeCreateCharacterModalBtn');

    const openModal = (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
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
    const createCharacterForm = document.getElementById('createCharacterForm');
    if (!createCharacterForm) return;

    createCharacterForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitBtn = createCharacterForm.querySelector('button[type="submit"]');
        const characterName = document.getElementById('newCharacterNameInput').value;

        if (submitBtn.disabled) return;
        
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
            const data = await questState.addCharacter(characterName);

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