import { supabase } from '../supabaseClient.js';
import { initializeCharacterSystem } from '../redemption/characterManager.js';
import { authSession } from '../authSessionManager.js';

// Wait for the header template to be loaded into the DOM
function waitForHeader(timeout = 5000) {
    return new Promise((resolve) => {
        // Check if header is already loaded
        if (document.querySelector('.main-nav')) {
            resolve(true);
            return;
        }
        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector('.main-nav')) {
                obs.disconnect();
                resolve(true);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Timeout fallback so we don't block forever
        setTimeout(() => { observer.disconnect(); resolve(false); }, timeout);
    });
}

export async function handleAdminAccess(user) {
    const path = window.location.pathname;
    const currentPage = path.split('/').pop().toLowerCase() || 'index.html';
    
    const publicPages = ['quests.html', 'chronicles.html', 'redeem.html', 'index.html', 'lore.html', ''];

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('quest_role, lore_role')
            .eq('user_id', user.id);

        const isAdmin = !error && data && data.length > 0 && data[0].quest_role === 'quest_adder';
        const isLoreEditor = !error && data && data.length > 0 && data[0].lore_role === 'lore_editor';

        if (isAdmin) {
            // Wait for header to be injected before toggling nav elements
            await waitForHeader();

            const adminElements = [
                'create-quest-nav',
                'edit-quest-nav',
                'character-container',
                'edit-features-nav',
                'quest-flow-nav',
                'edit-lore-nav',
                'stacks-nav'
            ];

            adminElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
        } else if (isLoreEditor) {
            await waitForHeader();
            const el = document.getElementById('edit-lore-nav');
            if (el) el.classList.remove('hidden');

            // Lore editors can only access public pages and edit_lore.html
            const loreEditorPages = [...publicPages, 'edit_lore.html'];
            if (!loreEditorPages.includes(currentPage)) {
                window.location.href = 'quests.html';
            }
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
    authSession.onChange((event, user) => {
        const path = window.location.pathname;
        const currentPage = path.split('/').pop().toLowerCase() || 'index.html';
        const publicPages = ['quests.html', 'chronicles.html', 'redeem.html', 'index.html', 'lore.html', 'edit_quest.html', ''];

        if (event === 'SIGNED_IN') {
            if (user) {
                handleAdminAccess(user);
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