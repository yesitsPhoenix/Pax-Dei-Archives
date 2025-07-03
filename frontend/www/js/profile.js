import { supabase } from './supabaseClient.js';
import { showCustomModal } from './trader.js';
import { handleDeleteCharacter as deleteCharacterWithCheck } from './modules/characters.js';


const profileLoading = document.getElementById('profileLoading');
const profileInfo = document.getElementById('profile-info');
const userAvatar = document.getElementById('user-avatar');
const userDiscordName = document.getElementById('user-discord-name');
const userDiscordId = document.getElementById('user-discord-id');
const userCreatedAt = document.getElementById('user-created-at');
const userLastLoginAt = document.getElementById('user-last-login-at');
const charactersList = document.getElementById('characters-list');

let currentUserId = null;

const fetchUserProfile = async () => {
    profileLoading.style.display = 'block';
    profileInfo.style.display = 'none';

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('Error fetching user:', userError?.message || 'User not logged in');
        profileLoading.textContent = 'Please log in to view your profile.';
        return;
    }

    currentUserId = user.id; 

    const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (userDataError) {
        console.error('Error fetching user data:', userDataError.message);
        profileLoading.textContent = 'Failed to load user profile data.';
        return;
    }

    userAvatar.src = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
    userDiscordName.textContent = user.user_metadata.full_name || 'N/A';
    userDiscordId.textContent = user.id;
    userCreatedAt.textContent = new Date(user.created_at).toLocaleDateString();
    userLastLoginAt.textContent = userData.last_login_at ? new Date(userData.last_login_at).toLocaleDateString() : 'N/A';

    profileLoading.style.display = 'none';
    profileInfo.style.display = 'block';

    await loadCharacters();
};

const loadCharacters = async () => {
    if (!charactersList) {
        console.error('Characters list element not found.');
        return;
    }
    if (!currentUserId) {
        charactersList.innerHTML = '<div class="text-gray-500">Log in to view your characters.</div>';
        return;
    }

    charactersList.innerHTML = '<div class="loading-indicator">Loading characters...</div>';

    try {
        const { data: characters, error } = await supabase
            .from('characters')
            .select('character_id, character_name')
            .eq('user_id', currentUserId)
            .order('character_name', { ascending: true });

        if (error) {
            throw error;
        }

        if (characters.length === 0) {
            charactersList.innerHTML = '<div class="text-gray-500">No characters found.</div>';
            return;
        }

        const ul = document.createElement('ul');
        ul.classList.add('list-disc', 'pl-5', 'space-y-2');
        characters.forEach(character => {
            const li = document.createElement('li');
            li.classList.add('flex', 'justify-between', 'items-center', 'bg-gray-100', 'p-2', 'rounded-md', 'shadow-sm');
            li.innerHTML = `
                <span class="font-medium text-lg">${character.character_name}</span>
                <button data-character-id="${character.character_id}" class="delete-character-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm transition duration-150 ease-in-out">Delete</button>
            `;
            ul.appendChild(li);
        });

        charactersList.innerHTML = '';
        charactersList.appendChild(ul);

        document.querySelectorAll('.delete-character-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const characterId = event.target.dataset.characterId;
                await deleteCharacterWithCheck(characterId);
            });
        });

    } catch (e) {
        console.error('Error loading characters:', e.message);
        charactersList.innerHTML = `<div class="text-red-500">Failed to load characters: ${e.message}</div>`;
        await showCustomModal('Error', 'Failed to load characters: ' + e.message, [{ text: 'OK', value: true }]);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchUserProfile();
});
document.addEventListener('authStatusChanged', () => {
    fetchUserProfile();
});