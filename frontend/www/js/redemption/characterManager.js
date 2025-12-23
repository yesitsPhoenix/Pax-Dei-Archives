import { supabase } from '../supabaseClient.js';

export let currentCharacterId = null;
let currentUserId = null;

export const initializeCharacterSystem = async (characterId = null) => {
    if (!characterId) {
        const { data: { session } } = await supabase.auth.getSession();
        characterId = session?.user?.id;
    }
    if (!characterId) return;
    currentUserId = characterId;
    await fetchCharacters();
    setupNewCharacterButton();
};

export const fetchCharacters = async () => {
    const characterSelect = document.getElementById('character-select');
    if (!characterSelect) return;

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
    if (btn) {
        btn.onclick = () => {
            window.location.href = 'ledger.html';
        };
    }
};