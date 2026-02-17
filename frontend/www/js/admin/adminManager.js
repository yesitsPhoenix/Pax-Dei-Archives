import { supabase } from '../supabaseClient.js';
import { initializeCharacterSystem } from '../redemption/characterManager.js';

export async function handleAdminAccess(user) {
    const path = window.location.pathname;
    const currentPage = path.split('/').pop().toLowerCase() || 'index.html';
    
    const publicPages = ['quests.html', 'chronicles.html', 'redeem.html', 'index.html', 'lore.html', ''];

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('quest_role')
            .eq('user_id', user.id);

        const isAdmin = !error && data && data.length > 0 && data[0].quest_role === 'quest_adder';

        if (isAdmin) {
            const adminElements = [
                'create-quest-nav',
                'edit-quest-nav',
                'character-container',
                'edit-features-nav',
                'quest-flow-nav',
                'edit-lore-nav'
            ];

            adminElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
        } else {
            if (!publicPages.includes(currentPage)) {
                window.location.href = 'quests.html';
            }
        }

        await initializeCharacterSystem(user.id);
        
    } catch (err) {
        await initializeCharacterSystem(user.id);
        if (!publicPages.includes(currentPage)) {
            window.location.href = 'quests.html';
        }
    }
}

export function setupAdminAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        const path = window.location.pathname;
        const currentPage = path.split('/').pop().toLowerCase() || 'index.html';
        const publicPages = ['quests.html', 'chronicles.html', 'redeem.html', 'index.html', 'lore.html', 'edit_lore.html', 'edit_quest.html', ''];

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            if (session?.user) {
                handleAdminAccess(session.user);
            } else if (!publicPages.includes(currentPage)) {
                window.location.href = 'quests.html';
            }
        } else if (event === 'SIGNED_OUT') {
            if (!publicPages.includes(currentPage)) {
                window.location.href = 'quests.html';
            }
        }
    });
}