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

        const questRole = (!error && data && data.length > 0) ? data[0].quest_role : null;
        const isAdmin = questRole === 'quest_admin';
        const isQuestEditor = questRole === 'quest_editor';
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
        } else if (isQuestEditor) {
            await waitForHeader();

            const editorElements = [
                'create-quest-nav',
                'edit-quest-nav',
                'character-container'
            ];

            editorElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });

            // Explicitly keep restricted nav items hidden for quest editors
            const restrictedElements = ['edit-features-nav', 'quest-flow-nav'];
            restrictedElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });

            // Quest editors can only access public pages, the quest panel, and edit quest
            const questEditorPages = [...publicPages, 'panel.html', 'edit_quest.html'];
            if (!questEditorPages.includes(currentPage)) {
                window.location.href = 'quests.html';
            }
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
    const path = window.location.pathname;
    const currentPage = path.split('/').pop().toLowerCase() || 'index.html';
    const publicPages = ['quests.html', 'chronicles.html', 'redeem.html', 'index.html', 'lore.html', 'edit_quest.html', ''];

    // INITIAL_SESSION fires before onChange subscribers are registered,
    // so we always do an immediate getUser() check to handle that case.
    authSession.getUser().then(user => {
        if (user) {
            handleAdminAccess(user);
        } else if (!publicPages.includes(currentPage)) {
            window.location.href = 'quests.html';
        }
    });

    // Listen for future auth changes (sign in / sign out after page load)
    authSession.onChange((event, user) => {
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