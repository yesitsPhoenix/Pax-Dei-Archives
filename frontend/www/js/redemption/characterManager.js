import { supabase } from '../supabaseClient.js';

export let currentCharacterId = null;
let currentUserId = null;

const showToast = (message, isError = false) => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-animate mb-3 px-6 py-3 rounded-lg shadow-xl border font-bold uppercase text-sm flex items-center gap-3 ${
        isError ? 'bg-red-900/90 border-red-500 text-white' : 'bg-gray-800/90 border-[#FFD700] text-[#FFD700]'
    }`;
    
    toast.innerHTML = `
        <i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-check-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

export const initializeCharacterSystem = async (characterId = null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        currentUserId = session.user.id;
    }

    if (!characterId && session?.user) {
        characterId = session.user.id;
    }
    
    await fetchCharacters();
    setupNewCharacterButton();
    setupCharacterFormListener();
};

export const fetchCharacters = async () => {
    const characterSelect = document.getElementById('character-select');
    if (!characterSelect || !currentUserId) return;

    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name')
        .eq('user_id', currentUserId);

    if (error || !data) return;

    characterSelect.innerHTML = '';

    data.forEach(char => {
        const option = document.createElement('option');
        option.value = char.character_id;
        option.textContent = char.character_name;
        characterSelect.appendChild(option);
    });

    const savedId = sessionStorage.getItem('active_character_id');
    if (savedId && data.some(c => c.character_id === savedId)) {
        characterSelect.value = savedId;
        currentCharacterId = savedId;
    } else if (data.length > 0) {
        currentCharacterId = data[0].character_id;
        characterSelect.value = currentCharacterId;
        sessionStorage.setItem('active_character_id', currentCharacterId);
    }

    characterSelect.addEventListener('change', (e) => {
        currentCharacterId = e.target.value;
        sessionStorage.setItem('active_character_id', currentCharacterId);

        const url = new URL(window.location);
        url.searchParams.delete('quest');
        window.history.replaceState({}, '', url.pathname);
        
        window.dispatchEvent(new CustomEvent('characterChanged', { 
            detail: { characterId: currentCharacterId } 
        }));
    });
};

const setupNewCharacterButton = () => {
    const btn = document.getElementById('showCreateCharacterModalBtn');
    const modal = document.getElementById('createCharacterModal');
    const closeBtn = document.getElementById('closeCreateCharacterModalBtn');

    if (btn && modal) {
        btn.onclick = (e) => {
            e.preventDefault();
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        };
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
        submitBtn.textContent = 'Creating...';

        if (!currentUserId) {
            showToast("User not logged in", true);
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.textContent = 'Create Character';
            return;
        }

        try {
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data, error } = await supabase
                .from('characters')
                .insert([{
                    user_id: currentUserId,
                    character_name: characterName
                }])
                .select();

            if (error) {
                if (error.code === '23505') {
                    throw new Error('This character name is already taken');
                }
                throw error;
            }

            showToast(`Character "${characterName}" created!`);

            const modal = document.getElementById('createCharacterModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
            createCharacterForm.reset();

            await fetchCharacters();
            
            if (data && data[0]) {
                const characterSelect = document.getElementById('character-select');
                characterSelect.value = data[0].character_id;
                characterSelect.dispatchEvent(new Event('change'));
            }

        } catch (e) {
            console.error('Error creating character:', e.message);
            showToast(e.message, true);
        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            submitBtn.textContent = 'Create Character';
        }
    });
};