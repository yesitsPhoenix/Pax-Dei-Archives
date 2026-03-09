import { supabase } from '../supabaseClient.js';
import { initializeCharacterSystem } from '../redemption/characterManager.js';
import { authSession } from '../authSessionManager.js';

const _roleCache = {
    questRole: null,
    loreRole: null,
    resolved: false
};

export async function getAdminRoles() {
    if (_roleCache.resolved) {
        return { questRole: _roleCache.questRole, loreRole: _roleCache.loreRole };
    }

    const user = await authSession.getUser();
    if (!user) {
        _roleCache.questRole = null;
        _roleCache.loreRole  = null;
        _roleCache.resolved  = true;
        return { questRole: null, loreRole: null };
    }

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('quest_role, lore_role')
            .eq('user_id', user.id);

        _roleCache.questRole = (!error && data && data.length > 0) ? data[0].quest_role : null;
        _roleCache.loreRole  = (!error && data && data.length > 0) ? data[0].lore_role  : null;
        _roleCache.resolved  = true;
    } catch (err) {
        _roleCache.questRole = null;
        _roleCache.loreRole  = null;
        _roleCache.resolved  = true;
    }

    return { questRole: _roleCache.questRole, loreRole: _roleCache.loreRole };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForHeader(timeout = 5000) {
    return new Promise((resolve) => {
        if (document.querySelector('.main-nav')) { resolve(true); return; }
        const observer = new MutationObserver((mutations, obs) => {
            if (document.querySelector('.main-nav')) { obs.disconnect(); resolve(true); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(false); }, timeout);
    });
}

/**
 * Returns the appropriate fallback URL when a user is denied access to a page.
 * - edit_lore.html → lore.html    (unauthorized lore access stays in lore)
 * - admin.html     → index.html   (unauthorized admin access goes home)
 * - everything else → quests.html
 */
function getUnauthorizedRedirect(page) {
    if (page === 'edit_lore.html') return 'lore.html';
    if (page === 'edit_quest.html' || page === 'panel.html' || page === 'quest_flow.html') return 'quests.html';
    return 'index.html';
}

// ── Core access handler ───────────────────────────────────────────────────────

export async function handleAdminAccess(user) {
    const path        = window.location.pathname;
    const currentPage = path.split('/').pop().toLowerCase() || 'index.html';

    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('is_admin, is_editor, quest_role, lore_role')
            .eq('user_id', user.id);

        const record = (!error && data && data.length > 0) ? data[0] : null;

        const isAdmin       = record?.is_admin  === true;   // user management within admin panel
        const isEditor      = record?.is_editor === true;   // grants access to admin.html
        const questRole     = record?.quest_role ?? null;
        const loreRole      = record?.lore_role  ?? null;

        const isQuestAdmin  = questRole === 'quest_admin';  // full quest access incl. flow/features
        const isQuestEditor = questRole === 'quest_editor'; // add/edit quests only
        const isLoreEditor  = loreRole  === 'lore_editor';  // add/edit lore only

        // Populate shared cache so getAdminRoles() is free for the rest of this session
        _roleCache.questRole = questRole;
        _roleCache.loreRole  = loreRole;
        _roleCache.resolved  = true;

        // ── Check if current page requires a role the user doesn't have ─────────
        // Only protected pages are gated; all other pages are freely accessible.
        const allowedPages = new Set();

        // admin.html access is controlled solely by is_editor
        if (isEditor) {
            allowedPages.add('admin.html');
        }

        // categorize_items.html is restricted to is_admin only
        if (isAdmin) {
            allowedPages.add('categorize_items.html');
        }

        // Quest editor: add/edit quests
        if (isQuestEditor || isQuestAdmin) {
            allowedPages.add('panel.html');
            allowedPages.add('edit_quest.html');
        }

        // Quest admin: additionally gets edit features and quest flow
        if (isQuestAdmin) {
            allowedPages.add('features.html');
            allowedPages.add('quest_flow.html');
        }

        // Lore editor: edit lore only
        if (isLoreEditor) {
            allowedPages.add('edit_lore.html');
        }

        // ── Show nav elements based on roles ─────────────────────────────────
        await waitForHeader();

        if (isQuestAdmin) {
            [
                'create-quest-nav',
                'edit-quest-nav',
                'character-container',
                'edit-features-nav',
                'quest-flow-nav',
                'stacks-nav'
            ].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
        } else if (isQuestEditor) {
            ['create-quest-nav', 'edit-quest-nav', 'character-container'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('hidden');
            });
            // Keep advanced quest features hidden for editors
            ['edit-features-nav', 'quest-flow-nav'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
        }

        if (isLoreEditor) {
            const el = document.getElementById('edit-lore-nav');
            if (el) el.classList.remove('hidden');
        }

        // ── Enforce page access ───────────────────────────────────────────────
        // Only redirect if this is a protected page the user doesn't have access to.
        if (protectedPages.includes(currentPage) && !allowedPages.has(currentPage)) {
            window.location.href = getUnauthorizedRedirect(currentPage);
            return;
        }

        await initializeCharacterSystem(user.id);

    } catch (err) {
        await initializeCharacterSystem(user.id);
        if (protectedPages.includes(currentPage)) {
            window.location.href = getUnauthorizedRedirect(currentPage);
        }
    }
}

// ── Auth listener bootstrap ───────────────────────────────────────────────────

// Pages that require specific roles to access. Everything else is freely accessible.
const protectedPages = ['admin.html', 'categorize_items.html', 'edit_lore.html', 'edit_quest.html', 'panel.html', 'quest_flow.html', 'features.html'];

export function setupAdminAuthListener() {
    const path        = window.location.pathname;
    const currentPage = path.split('/').pop().toLowerCase() || 'index.html';

    // Handle the initial session (INITIAL_SESSION fires before onChange subscribers)
    authSession.getUser().then(user => {
        if (user) {
            handleAdminAccess(user);
        } else if (protectedPages.includes(currentPage)) {
            window.location.href = getUnauthorizedRedirect(currentPage);
        }
    });

    // Handle future auth changes (sign in / sign out after page load)
    authSession.onChange((event, user) => {
        if (event === 'SIGNED_IN') {
            if (user) {
                handleAdminAccess(user);
            }
        } else if (event === 'SIGNED_OUT') {
            if (protectedPages.includes(currentPage)) {
                window.location.href = getUnauthorizedRedirect(currentPage);
            }
        }
    });
}
