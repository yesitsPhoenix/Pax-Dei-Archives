import { supabase } from './supabaseClient.js';
import { authorRoleColors, slugify } from './utils.js';
import { authSession } from './authSessionManager.js';

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────
let initialAuthCheckComplete = false;
let dashboardStatsCache = null;
let lastStatsFetchTime = 0;
const STATS_CACHE_DURATION = 5 * 60 * 1000;
let tagListCache = null;
let isAdminAuthorizedCache = null;
let currentUserIsAdmin = false;
let currentUserCanComment = false;
let currentUserCanPostArticles = false;
let currentUserIsLoreEditor = false;
let adminUsersCache = [];
let allSiteUsersCache = [];
let userRolesLoaded = false;

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
// Returns a Promise<boolean> — resolves true if confirmed, false if cancelled
function showConfirmModal(message, title) {
    return new Promise(function(resolve) {
        const modal   = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl   = document.getElementById('confirmModalMessage');
        const confirmBtn = document.getElementById('confirmModalConfirm');
        const cancelBtn  = document.getElementById('confirmModalCancel');
        if (!modal) { resolve(false); return; }

        if (titleEl) titleEl.innerHTML = '<i class="fas fa-triangle-exclamation text-red-400"></i> ' + (title || 'Confirm Action');
        if (msgEl)   msgEl.textContent = message || 'Are you sure?';

        modal.classList.remove('hidden');

        function cleanup(result) {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        }
        function onConfirm() { cleanup(true); }
        function onCancel()  { cleanup(false); }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

function showFormMessage(messageElement, message, type) {
    if (!messageElement) return;
    messageElement.textContent = message;
    messageElement.className = '';
    if (type) {
        messageElement.classList.add('form-message', type);
        messageElement.style.display = 'block';
        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
            }, 5000);
        }
    } else {
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}

function showLoadingOverlay(show) {
    const overlay = document.getElementById('adminLoadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function formatNumber(n) {
    if (n === null || n === undefined) return '--';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return n.toLocaleString();
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────
async function isAuthorizedAdmin(userId) {
    if (!userId) { isAdminAuthorizedCache = false; return false; }
    if (isAdminAuthorizedCache !== null) return isAdminAuthorizedCache;
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('is_editor, is_admin, role, can_post_articles, lore_role')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') { isAdminAuthorizedCache = false; return false; }
        if (error) { isAdminAuthorizedCache = false; return false; }
        currentUserIsAdmin         = data && data.is_admin === true;
        currentUserCanComment      = currentUserIsAdmin || (data && data.role === 'comment_adder');
        currentUserCanPostArticles = currentUserIsAdmin || (data && data.can_post_articles === true);
        currentUserIsLoreEditor    = currentUserIsAdmin || (data && data.lore_role === 'lore_editor');
        isAdminAuthorizedCache     = data && (data.is_editor === true || data.lore_role === 'lore_editor');
        return isAdminAuthorizedCache;
    } catch (e) {
        isAdminAuthorizedCache = false;
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// Dashboard Stats
// ─────────────────────────────────────────────────────────────
async function fetchDashboardStats() {
    const now = Date.now();
    if (dashboardStatsCache && (now - lastStatsFetchTime < STATS_CACHE_DURATION)) {
        applyStatsToDOM(dashboardStatsCache);
        return;
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const [
        { count: totalQuests },
        { count: questCategories },
        { count: totalComments },
        { count: commentsThisMonth },
        { count: totalLore },
        { count: totalArticles },
        { count: adminUsers },
        { count: totalCharacters },
        { count: totalItems },
        { count: totalListings },
        { count: activeListings },
        { count: totalSales },
        { data: salesRevData },
        { count: totalPve },
    ] = await Promise.all([
        supabase.from('cipher_quests').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('quest_categories').select('*', { count: 'exact', head: true }),
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }),
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }).gte('comment_date', startOfMonth).lte('comment_date', endOfMonth),
        supabase.from('lore_items').select('*', { count: 'exact', head: true }),
        supabase.from('articles').select('*', { count: 'exact', head: true }),
        supabase.from('admin_users').select('*', { count: 'exact', head: true }),
        supabase.from('characters').select('*', { count: 'exact', head: true }),
        supabase.from('items').select('*', { count: 'exact', head: true }),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }),
        supabase.from('market_listings').select('*', { count: 'exact', head: true }).eq('is_fully_sold', false).eq('is_cancelled', false),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('total_sale_price'),
        supabase.from('pve_transactions').select('*', { count: 'exact', head: true }),
    ]);

    const totalRevenue = salesRevData ? salesRevData.reduce((sum, r) => sum + (r.total_sale_price || 0), 0) : 0;

    dashboardStatsCache = {
        totalQuests, questCategories,
        totalComments, commentsThisMonth,
        totalLore, totalArticles,
        adminUsers, totalCharacters,
        totalItems, totalListings, activeListings,
        totalSales, totalRevenue,
        totalPve,
    };
    lastStatsFetchTime = now;
    applyStatsToDOM(dashboardStatsCache);
}

function applyStatsToDOM(s) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('stat-total-quests',      formatNumber(s.totalQuests));
    set('stat-quest-categories',  formatNumber(s.questCategories));
    set('stat-total-comments',    formatNumber(s.totalComments));
    set('stat-comments-month',    formatNumber(s.commentsThisMonth) + ' this month');
    set('stat-total-lore',        formatNumber(s.totalLore));
    set('stat-total-articles',    formatNumber(s.totalArticles));
    set('stat-admin-users',       formatNumber(s.adminUsers));
    set('stat-total-characters',  formatNumber(s.totalCharacters));
    set('stat-total-items',       formatNumber(s.totalItems));
    set('stat-total-listings',    formatNumber(s.totalListings));
    set('stat-active-listings',   formatNumber(s.activeListings) + ' active');
    set('stat-total-sales',       formatNumber(s.totalSales));
    set('stat-sales-revenue',     formatNumber(Math.round(s.totalRevenue)) + ' gold');
    set('stat-total-pve',         formatNumber(s.totalPve));
}

// ─────────────────────────────────────────────────────────────
// Recent Activity
// ─────────────────────────────────────────────────────────────
async function fetchRecentActivity() {
    const [
        { data: lastComment },
        { data: lastLore },
        { data: lastArticle },
    ] = await Promise.all([
        supabase.from('developer_comments').select('author, comment_date, content').order('comment_date', { ascending: false }).limit(1).single(),
        supabase.from('lore_items').select('title, created_at, category').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('articles').select('title, publication_date, author').order('publication_date', { ascending: false }).limit(1).single(),
    ]);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '--'; };

    if (lastComment) {
        set('recent-comment-author',  lastComment.author || '(unknown)');
        set('recent-comment-date',    formatDate(lastComment.comment_date));
        set('recent-comment-preview', lastComment.content ? lastComment.content.substring(0, 120) + (lastComment.content.length > 120 ? '\u2026' : '') : '--');
    }
    if (lastLore) {
        set('recent-lore-title',    lastLore.title || '--');
        set('recent-lore-date',     formatDate(lastLore.created_at));
        set('recent-lore-category', lastLore.category ? 'Category: ' + lastLore.category : '--');
    }
    if (lastArticle) {
        set('recent-article-title',  lastArticle.title || '--');
        set('recent-article-date',   formatDate(lastArticle.publication_date));
        set('recent-article-author', lastArticle.author ? 'By ' + lastArticle.author : '--');
    }
}

// ─────────────────────────────────────────────────────────────
// User Role Management
// ─────────────────────────────────────────────────────────────
async function fetchAndRenderUserRoles() {
    const loadingEl = document.getElementById('userRolesLoadingIndicator');
    const tableEl   = document.getElementById('userRolesTableContainer');
    const emptyEl   = document.getElementById('userRolesEmptyState');
    const tbody     = document.getElementById('userRolesTableBody');

    if (!tbody) return;

    // Skip re-fetching if data is already loaded — only query when cache is explicitly invalidated
    if (userRolesLoaded && adminUsersCache.length > 0) {
        if (tableEl) tableEl.classList.remove('hidden');
        return;
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (tableEl)   tableEl.classList.add('hidden');
    if (emptyEl)   emptyEl.classList.add('hidden');

    const { data, error } = await supabase
        .from('admin_users')
        .select('user_id, role, quest_role, lore_role, is_admin, is_editor, can_post_articles')
        .order('user_id', { ascending: true });

    if (loadingEl) loadingEl.classList.add('hidden');

    if (error) {
        console.error('Error fetching admin users:', error);
        if (emptyEl) {
            emptyEl.classList.remove('hidden');
            emptyEl.querySelector('p').textContent = 'Error loading users: ' + error.message;
        }
        return;
    }

    adminUsersCache = data || [];
    userRolesLoaded = true;

    // Fetch usernames from users table separately (no FK relationship)
    const userIds = adminUsersCache.map(function(u) { return u.user_id; }).filter(Boolean);
    const usernameMap = {};
    if (userIds.length > 0) {
        const { data: usersData } = await supabase
            .from('users')
            .select('id, username')
            .in('id', userIds);
        if (usersData) {
            usersData.forEach(function(u) { usernameMap[u.id] = u.username; });
        }
    }

    if (adminUsersCache.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }

    tbody.innerHTML = '';

    adminUsersCache.forEach(function(u) {
        const isCommenter     = u.role === 'comment_adder';
        const isQuestAdder    = u.quest_role === 'quest_adder';
        const isLoreEditor    = u.lore_role === 'lore_editor';
        const isAdmin         = u.is_admin === true;
        const hasAccess       = u.is_editor === true;
        const canPostArticles = u.can_post_articles === true;
        const shortId         = u.user_id ? u.user_id.substring(0, 8) + '\u2026' : '--';
        const username        = usernameMap[u.user_id] || null;

        const userCell = '<td class="px-4 py-3">'
            + '<div class="flex flex-col gap-0.5">'
            + (username
                ? '<span class="text-lg text-white font-medium flex items-center gap-1"><i class="fab fa-discord text-indigo-400 text-lg"></i>' + username + '</span>'
                : '')
            + '<div class="flex items-center gap-2">'
            + '</div>'
            + '</div>'
            + '</td>';

        const commenterCell = '<td class="px-4 py-3">'
            + (isCommenter
                ? '<span class="role-badge comments"><i class="fas fa-message"></i> comment_adder</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        const questCell = '<td class="px-4 py-3">'
            + (isQuestAdder
                ? '<span class="role-badge quest"><i class="fas fa-scroll"></i> quest_adder</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        const adminCell = '<td class="px-4 py-3">'
            + (isAdmin
                ? '<span class="role-badge master"><i class="fas fa-user-shield"></i> admin</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        const canPostArticlesCell = '<td class="px-4 py-3">'
            + (canPostArticles
                ? '<span class="role-badge article"><i class="fas fa-newspaper"></i> can_post_articles</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        const loreCell = '<td class="px-4 py-3">'
            + (isLoreEditor
                ? '<span class="role-badge lore"><i class="fas fa-book"></i> lore_editor</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        const accessCell = '<td class="px-4 py-3">'
            + (hasAccess
                ? '<span class="role-badge none"><i class="fas fa-user-edit"></i> editor</span>'
                : '<span class="role-badge none">\u2014</span>')
            + '</td>';

        // Action buttons: only logged-in admins see Edit / Delete buttons
        var actionsContent = '';
        if (currentUserIsAdmin) {
            actionsContent = '<button class="edit-role-btn text-lg px-3 py-1 rounded transition-all bg-violet-900/40 text-violet-300 hover:bg-violet-900/70 border border-violet-500/30"'
                + ' data-uid="' + u.user_id + '"'
                + ' data-is-admin="' + isAdmin + '"'
                + ' data-is-editor="' + hasAccess + '"'
                + ' data-can-post-articles="' + canPostArticles + '"'
                + ' data-is-commenter="' + isCommenter + '"'
                + ' data-is-quest-adder="' + isQuestAdder + '"'
                + ' data-is-lore-editor="' + isLoreEditor + '"'
                + '>'
                + '<i class="fas fa-pen mr-1"></i>Edit Roles'
                + '</button>'
                + '<button class="delete-user-btn text-lg px-3 py-1 rounded transition-all bg-red-900/40 text-red-300 hover:bg-red-900/70 border border-red-500/30"'
                + ' data-uid="' + u.user_id + '"'
                + ' data-username="' + (username || shortId) + '"'
                + '>'
                + '<i class="fas fa-trash mr-1"></i>Remove'
                + '</button>';
        }

        const actionsCell = '<td class="px-4 py-3"><div class="flex gap-2 flex-wrap">' + actionsContent + '</div></td>';

        const tr = document.createElement('tr');
        tr.innerHTML = userCell + adminCell + commenterCell + questCell + canPostArticlesCell + loreCell + accessCell + actionsCell;
        tbody.appendChild(tr);
    });

    // Copy UID buttons
    tbody.querySelectorAll('.copy-uid-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            navigator.clipboard.writeText(btn.dataset.uid).then(function() {
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(function() { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
            });
        });
    });

    // Delete user buttons
    tbody.querySelectorAll('.delete-user-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            const uid      = btn.dataset.uid;
            const username = btn.dataset.username;
            const confirmed = await showConfirmModal(
                'Remove "' + username + '" from the admin users table? This cannot be undone.',
                'Remove User'
            );
            if (!confirmed) return;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Removing...';

            const { error } = await supabase
                .from('admin_users')
                .delete()
                .eq('user_id', uid);

            if (error) {
                console.error('Error deleting admin user:', error);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-trash mr-1"></i>Remove';
                alert('Error: ' + error.message);
            } else {
                adminUsersCache = adminUsersCache.filter(function(u) { return u.user_id !== uid; });
                allSiteUsersCache = [];
                userRolesLoaded = false;
                fetchAndRenderUserRoles();
                fetchDashboardStats();
            }
        });
    });

    // Edit role buttons
    tbody.querySelectorAll('.edit-role-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            await populateRoleUserDropdown(btn.dataset.uid);
            openManageUserRoleModal({
                userId: btn.dataset.uid,
                isAdmin: btn.dataset.isAdmin === 'true',
                isEditor: btn.dataset.isEditor === 'true',
                canPostArticles: btn.dataset.canPostArticles === 'true',
                isCommenter: btn.dataset.isCommenter === 'true',
                isQuestAdder: btn.dataset.isQuestAdder === 'true',
                isLoreEditor: btn.dataset.isLoreEditor === 'true'
            });
        });
    });

    if (tableEl) tableEl.classList.remove('hidden');
}

// Opens the shared Grant/Edit modal, pre-filling if editing an existing user
function openManageUserRoleModal(opts) {
    const modal = document.getElementById('addUserRoleModal');
    if (!modal) return;

    const userSelect    = document.getElementById('roleUserSelect');
    const ckAdmin       = document.getElementById('roleCheck_is_admin');
    const ckEditor      = document.getElementById('roleCheck_is_editor');
    const ckArticles    = document.getElementById('roleCheck_can_post_articles');
    const ckCommenter   = document.getElementById('roleCheck_comment_adder');
    const ckQuest       = document.getElementById('roleCheck_quest_adder');
    const ckLore        = document.getElementById('roleCheck_lore_editor');
    const msgEl         = document.getElementById('addUserRoleMessage');

    if (msgEl) { msgEl.classList.add('hidden'); msgEl.textContent = ''; }

    if (opts && opts.userId) {
        // Edit mode — select the existing user
        if (userSelect) userSelect.value = opts.userId;
        if (ckAdmin)     ckAdmin.checked     = opts.isAdmin     || false;
        if (ckEditor)    ckEditor.checked    = opts.isEditor    || false;
        if (ckArticles)  ckArticles.checked  = opts.canPostArticles || false;
        if (ckCommenter) ckCommenter.checked = opts.isCommenter || false;
        if (ckQuest)     ckQuest.checked     = opts.isQuestAdder || false;
        if (ckLore)      ckLore.checked      = opts.isLoreEditor || false;
    } else {
        // Grant mode — reset form
        if (userSelect) userSelect.value = '';
        if (ckAdmin)     ckAdmin.checked     = false;
        if (ckEditor)    ckEditor.checked    = false;
        if (ckArticles)  ckArticles.checked  = false;
        if (ckCommenter) ckCommenter.checked = false;
        if (ckQuest)     ckQuest.checked     = false;
        if (ckLore)      ckLore.checked      = false;
    }

    modal.classList.remove('hidden');
}

async function saveUserRoles(userId, roles) {
    if (!userId) return { error: 'Please select a user.' };

    const upsertData = {
        user_id:          userId,
        is_admin:         roles.isAdmin,
        is_editor:        roles.isEditor,
        can_post_articles: roles.canPostArticles,
        role:             roles.isCommenter ? 'comment_adder' : '',
        quest_role:       roles.isQuestAdder ? 'quest_adder' : null,
        lore_role:        roles.isLoreEditor ? 'lore_editor'  : null
    };

    const { error } = await supabase
        .from('admin_users')
        .upsert(upsertData, { onConflict: 'user_id' });

    if (error) return { error: error.message };
    return { success: true };
}

async function fetchAllSiteUsers() {
    if (allSiteUsersCache.length > 0) return allSiteUsersCache;
    const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .order('username', { ascending: true });
    if (error) { console.error('Error fetching site users:', error); return []; }
    allSiteUsersCache = data || [];
    return allSiteUsersCache;
}

async function populateRoleUserDropdown(editingUserId) {
    const sel = document.getElementById('roleUserSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select a user --</option>';
    const users = await fetchAllSiteUsers();

    // Build a set of user_ids already managed in the table,
    // but exclude the one currently being edited so it still appears
    const managedIds = new Set(adminUsersCache.map(function(u) { return u.user_id; }));
    if (editingUserId) managedIds.delete(editingUserId);

    const filtered = users.filter(function(u) { return !managedIds.has(u.id); });

    if (filtered.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.textContent = '-- All site users already have roles assigned --';
        sel.appendChild(opt);
        return;
    }

    filtered.forEach(function(u) {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = (u.username || '(no username)') + '  [' + u.id.substring(0, 8) + '\u2026]';
        sel.appendChild(opt);
    });
}

// ─────────────────────────────────────────────────────────────
// Tag management
// ─────────────────────────────────────────────────────────────
async function populateTagSelect(tagSelectElement) {
    if (!tagSelectElement) return;
    tagSelectElement.innerHTML = '';
    tagSelectElement.style.color = 'white';

    if (!tagListCache) {
        const { data, error } = await supabase
            .from('tag_list')
            .select('tag_name')
            .order('tag_name', { ascending: true });
        if (error) { console.error('Error fetching tags:', error.message); return; }
        tagListCache = data;
    }

    if (tagListCache) {
        tagListCache.forEach(function(tag) {
            const option = document.createElement('option');
            option.value = tag.tag_name;
            option.textContent = tag.tag_name;
            tagSelectElement.appendChild(option);
        });
    }
}

// ─────────────────────────────────────────────────────────────
// Comment parsing
// ─────────────────────────────────────────────────────────────
function parseComment(text) {
    const mainRegex = /^(.*?)\s*—\s*([\s\S]*?)(https?:\/\/[^\s]+)?$/;
    const match = text.match(mainRegex);
    if (!match) return null;

    try {
        const author = match[1].trim();
        const fullContent = match[2].trim();
        const url = match[3] ? match[3].trim() : '';

        let parsedDate = new Date();
        let content = fullContent;
        const lines = fullContent.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
        const firstLine = lines.length > 0 ? lines[0] : '';
        let timestampMatchFound = false;

        function parseTimeIntoDate(timePart, dateObject) {
            const m = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i);
            if (m) {
                let h = parseInt(m[1]);
                const mins = parseInt(m[2]);
                const ampm = m[3].toLowerCase();
                if (ampm === 'pm' && h < 12) h += 12;
                if (ampm === 'am' && h === 12) h = 0;
                dateObject.setHours(h, mins, 0, 0);
            } else {
                dateObject.setHours(0, 0, 0, 0);
            }
        }

        const fullDT = firstLine.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})(?:,\s*|\s+)(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i);
        if (fullDT) {
            let parts = fullDT[1].split('/').map(Number);
            let month = parts[0], day = parts[1], year = parts[2];
            if (year < 100) year += year > 50 ? 1900 : 2000;
            parsedDate = new Date(year, month - 1, day);
            parseTimeIntoDate(fullDT[2], parsedDate);
            timestampMatchFound = true;
            content = [fullDT[3].trim()].concat(lines.slice(1)).filter(Boolean).join('\n').trim();
        }

        if (!timestampMatchFound) {
            const yesterday = firstLine.match(/^yesterday at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i);
            if (yesterday) {
                parsedDate = new Date();
                parsedDate.setDate(parsedDate.getDate() - 1);
                parseTimeIntoDate(yesterday[1], parsedDate);
                timestampMatchFound = true;
                content = [yesterday[2].trim()].concat(lines.slice(1)).filter(Boolean).join('\n').trim();
            }
        }

        if (!timestampMatchFound) {
            const today = firstLine.match(/^today at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i);
            if (today) {
                parsedDate = new Date();
                parseTimeIntoDate(today[1], parsedDate);
                timestampMatchFound = true;
                content = [today[2].trim()].concat(lines.slice(1)).filter(Boolean).join('\n').trim();
            }
        }

        if (!timestampMatchFound) {
            const timeOnly = firstLine.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i);
            if (timeOnly) {
                parsedDate = new Date();
                parseTimeIntoDate(timeOnly[1], parsedDate);
                timestampMatchFound = true;
                content = [timeOnly[2].trim()].concat(lines.slice(1)).filter(Boolean).join('\n').trim();
            }
        }

        const yr = parsedDate.getFullYear();
        const mo = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
        const dy = parsedDate.getDate().toString().padStart(2, '0');
        const hr = parsedDate.getHours().toString().padStart(2, '0');
        const mn = parsedDate.getMinutes().toString().padStart(2, '0');

        return { author: author, source: url, timestamp: yr + '-' + mo + '-' + dy + 'T' + hr + ':' + mn, content: content };
    } catch (e) {
        console.error('Error parsing comment:', e);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// Modal gating
// ─────────────────────────────────────────────────────────────
function applySidebarLinkState(btnId, allowed, disabledTitle) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (allowed) {
        btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        btn.removeAttribute('title');
        btn.removeAttribute('aria-disabled');
    } else {
        btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
        btn.setAttribute('title', disabledTitle);
        btn.setAttribute('aria-disabled', 'true');
    }
}

function applyModalGating() {
    applySidebarLinkState('openDevCommentModalBtn',   currentUserCanComment,      'You do not have the comment_adder role');
    applySidebarLinkState('openArticleModalBtn',      currentUserCanPostArticles, 'You do not have the can_post_articles role');
    applySidebarLinkState('openAddUserRoleModalBtn',  currentUserIsAdmin,         'Only admins can manage user roles');

    // Show/hide Edit Lore sidebar link based on lore role
    const loreSidebarLi = document.getElementById('sidebarEditLoreLink');
    if (loreSidebarLi) {
        if (currentUserIsLoreEditor) {
            loreSidebarLi.classList.remove('hidden');
        } else {
            loreSidebarLi.classList.add('hidden');
        }
    }

    // Show/hide Edit Lore link in the header nav dropdown
    // The header is loaded async but by the time roles resolve it will be in the DOM
    const editLoreNav = document.getElementById('edit-lore-nav');
    if (editLoreNav) {
        if (currentUserIsLoreEditor) {
            editLoreNav.classList.remove('hidden');
        } else {
            editLoreNav.classList.add('hidden');
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Init auth + dashboard
// ─────────────────────────────────────────────────────────────
async function initAuthAndDashboard() {
    const loginContainer = document.getElementById('loginFormContainer');
    const adminDashboard = document.getElementById('adminDashboardAndForm');
    const loginError     = document.getElementById('loginError');

    const user = await authSession.getUser();

    showLoadingOverlay(false);

    if (user) {
        const authorized = await isAuthorizedAdmin(user.id);
        if (authorized) {
            if (loginContainer) loginContainer.classList.add('hidden');
            if (adminDashboard) adminDashboard.style.display = 'block';

            applyModalGating();
            fetchDashboardStats();
            fetchRecentActivity();
            fetchAndRenderUserRoles();

            if (!initialAuthCheckComplete) {
                populateTagSelect(document.getElementById('tagSelect'));
                initialAuthCheckComplete = true;
            }
        } else {
            if (loginContainer) loginContainer.classList.remove('hidden');
            if (adminDashboard) adminDashboard.style.display = 'none';
            if (loginError) { loginError.textContent = 'You are not authorized. Redirecting\u2026'; loginError.classList.remove('hidden'); }
            setTimeout(function() { window.location.href = 'index.html'; }, 6000);
        }
    } else {
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (adminDashboard) adminDashboard.style.display = 'none';
        if (loginError) { loginError.textContent = 'Please log in. Redirecting\u2026'; loginError.classList.remove('hidden'); }
        setTimeout(function() { window.location.href = 'index.html'; }, 6000);
    }
}

// ─────────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────────
function setupAuthEventListeners() {
    authSession.onChange(function(event, user) {
        initialAuthCheckComplete   = false;
        isAdminAuthorizedCache     = null;
        dashboardStatsCache        = null;
        currentUserIsAdmin         = false;
        currentUserCanComment      = false;
        currentUserCanPostArticles = false;
        currentUserIsLoreEditor    = false;
        allSiteUsersCache          = [];
        userRolesLoaded            = false;
        initAuthAndDashboard();
    });

    const discordBtn = document.getElementById('discordLoginButton');
    if (discordBtn) {
        discordBtn.addEventListener('click', async function() {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { redirectTo: 'https://yesitsphoenix.github.io/Pax-Dei-Archives/admin.html' }
            });
            if (error) {
                const el = document.getElementById('loginError');
                if (el) { el.textContent = 'Login failed: ' + error.message; el.classList.remove('hidden'); }
            }
        });
    }
}

function setupCommentFormHandlers() {
    const commentInput        = document.getElementById('commentInput');
    const parseButton         = document.getElementById('parseButton');
    const devCommentForm      = document.getElementById('devCommentForm');
    const parseError          = document.getElementById('parseError');
    const authorField         = document.getElementById('author');
    const sourceField         = document.getElementById('source');
    const timestampField      = document.getElementById('timestamp');
    const commentContentField = document.getElementById('commentContent');
    const editButton          = document.getElementById('editButton');
    const formMessage         = document.getElementById('formMessage');
    const authorTypeDropdown  = document.getElementById('author_type');

    if (authorTypeDropdown) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = ''; defaultOpt.textContent = 'Select Author Type'; defaultOpt.selected = true;
        authorTypeDropdown.appendChild(defaultOpt);
        for (const type in authorRoleColors) {
            if (authorRoleColors.hasOwnProperty(type) && type !== 'default') {
                const opt = document.createElement('option');
                opt.value = type; opt.textContent = type;
                authorTypeDropdown.appendChild(opt);
            }
        }
    }

    if (parseButton && commentInput && devCommentForm) {
        parseButton.addEventListener('click', function() {
            showFormMessage(formMessage, '', '');
            const parsed = parseComment(commentInput.value);
            if (parsed) {
                if (authorField)         authorField.value         = parsed.author;
                if (sourceField)         sourceField.value         = parsed.source;
                if (timestampField)      timestampField.value      = parsed.timestamp;
                if (commentContentField) commentContentField.value = parsed.content;
                devCommentForm.style.display = 'block';
                commentInput.style.display   = 'none';
                parseButton.style.display    = 'none';
                if (parseError) parseError.style.display = 'none';
            } else {
                if (parseError) {
                    parseError.textContent = 'Could not parse. Expected: "Author \u2014 Timestamp Content [Optional URL]"';
                    parseError.style.display = 'block';
                }
            }
        });
    }

    if (editButton) {
        editButton.addEventListener('click', function() {
            showFormMessage(formMessage, '', '');
            if (devCommentForm) devCommentForm.style.display = 'none';
            if (commentInput)   commentInput.style.display   = 'block';
            if (parseButton)    parseButton.style.display    = 'block';
            if (parseError)     parseError.style.display     = 'none';
        });
    }

    if (devCommentForm) {
        devCommentForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const author       = document.getElementById('author').value;
            const source       = document.getElementById('source').value;
            const timestamp    = document.getElementById('timestamp').value;
            const content      = document.getElementById('commentContent').value;
            const tagSelect    = document.getElementById('tagSelect');
            const selectedTags = tagSelect ? Array.from(tagSelect.selectedOptions).map(function(o) { return o.value; }) : [];
            const aDropdown    = document.getElementById('author_type');
            const author_type  = aDropdown ? aDropdown.value : '';
            const submitBtn    = devCommentForm.querySelector('button[type="submit"]');

            if (!author_type) {
                showFormMessage(formMessage, 'Please select an Author Type.', 'error');
                return;
            }

            let utcTimestamp = null;
            if (timestamp) utcTimestamp = new Date(timestamp).toISOString();

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting\u2026'; }

            try {
                const { error } = await supabase
                    .from('developer_comments')
                    .insert([{ author: author, source: source, comment_date: utcTimestamp, content: content, tag: selectedTags.length ? selectedTags : null, author_type: author_type }]);

                if (error) {
                    showFormMessage(formMessage, 'Error: ' + error.message, 'error');
                } else {
                    showFormMessage(formMessage, 'Dev comment added successfully!', 'success');
                    devCommentForm.reset();
                    devCommentForm.style.display = 'none';
                    if (commentInput) { commentInput.value = ''; commentInput.style.display = 'block'; }
                    if (parseButton)  parseButton.style.display = 'block';
                    dashboardStatsCache = null;
                    fetchDashboardStats();
                    fetchRecentActivity();
                }
            } catch (err) {
                showFormMessage(formMessage, 'Unexpected error. Please try again.', 'error');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add to DB'; }
            }
        });
    }

    const addNewTagButton = document.getElementById('addNewTagButton');
    const newTagInput     = document.getElementById('newTagInput');
    const tagSelect       = document.getElementById('tagSelect');
    if (addNewTagButton && newTagInput && tagSelect) {
        addNewTagButton.addEventListener('click', async function() {
            const newTag = newTagInput.value.trim();
            if (!newTag) { showFormMessage(formMessage, 'Please enter a tag name.', 'warning'); return; }
            const { error } = await supabase.from('tag_list').insert([{ tag_name: newTag }]);
            if (error && error.code !== '23505') {
                showFormMessage(formMessage, 'Error: ' + error.message, 'error');
            } else {
                if (error && error.code === '23505') {
                    showFormMessage(formMessage, "Tag '" + newTag + "' already exists.", 'warning');
                } else {
                    showFormMessage(formMessage, "Tag '" + newTag + "' added!", 'success');
                    if (!tagListCache) tagListCache = [];
                    tagListCache.push({ tag_name: newTag });
                    tagListCache.sort(function(a, b) { return a.tag_name.localeCompare(b.tag_name); });
                }
                newTagInput.value = '';
                populateTagSelect(tagSelect);
            }
        });
    }
}

function setupModalHandlers() {
    // Dev Comment modal
    const openDevComment  = document.getElementById('openDevCommentModalBtn');
    const devCommentModal = document.getElementById('devCommentModal');
    const closeDevComment = document.getElementById('closeDevCommentModalBtn');

    if (openDevComment) {
        openDevComment.addEventListener('click', function(e) {
            e.preventDefault();
            if (!currentUserCanComment) return;
            if (devCommentModal) devCommentModal.classList.remove('hidden');
            populateTagSelect(document.getElementById('tagSelect'));
        });
    }
    if (closeDevComment) closeDevComment.addEventListener('click', function() { if (devCommentModal) devCommentModal.classList.add('hidden'); });
    if (devCommentModal) devCommentModal.addEventListener('click', function(e) { if (e.target === devCommentModal) devCommentModal.classList.add('hidden'); });

    // Article modal
    const openArticle  = document.getElementById('openArticleModalBtn');
    const articleModal = document.getElementById('articleModal');
    const closeArticle = document.getElementById('closeArticleModalBtn');

    if (openArticle)  openArticle.addEventListener('click',  function(e) { e.preventDefault(); if (!currentUserCanPostArticles) return; if (articleModal) articleModal.classList.remove('hidden'); });
    if (closeArticle) closeArticle.addEventListener('click', function()  { if (articleModal) articleModal.classList.add('hidden'); });
    if (articleModal) articleModal.addEventListener('click', function(e) { if (e.target === articleModal) articleModal.classList.add('hidden'); });

    // Add User Role modal
    const openUserRole  = document.getElementById('openAddUserRoleModalBtn');
    const userRoleModal = document.getElementById('addUserRoleModal');
    const closeRole1    = document.getElementById('closeAddUserRoleModalBtn');
    const closeRole2    = document.getElementById('closeAddUserRoleModalBtn2');
    const submitRoleBtn = document.getElementById('submitGrantRoleBtn');
    const roleMsg       = document.getElementById('addUserRoleMessage');

    // openUserRole click is handled below after submitRoleBtn section (needs populateRoleUserDropdown)
    if (closeRole1)    closeRole1.addEventListener('click',    function() { if (userRoleModal) userRoleModal.classList.add('hidden'); });
    if (closeRole2)    closeRole2.addEventListener('click',    function() { if (userRoleModal) userRoleModal.classList.add('hidden'); });
    if (userRoleModal) userRoleModal.addEventListener('click', function(e) { if (e.target === userRoleModal) userRoleModal.classList.add('hidden'); });

    // Refresh user roles button
    const refreshUserRolesBtn = document.getElementById('refreshUserRolesBtn');
    if (refreshUserRolesBtn) {
        refreshUserRolesBtn.addEventListener('click', function() {
            const icon = refreshUserRolesBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            refreshUserRolesBtn.disabled = true;
            userRolesLoaded = false;
            allSiteUsersCache = [];
            fetchAndRenderUserRoles().finally(function() {
                if (icon) icon.classList.remove('fa-spin');
                refreshUserRolesBtn.disabled = false;
            });
        });
    }

    // Populate the user dropdown when opening the modal
    if (openUserRole) {
        openUserRole.addEventListener('click', async function() {
            if (!currentUserIsAdmin) return; // blocked
            await populateRoleUserDropdown(null); // grant mode — exclude all already-managed users
            openManageUserRoleModal(null);
        });
    }

    if (submitRoleBtn) {
        submitRoleBtn.addEventListener('click', async function() {
            const userId = document.getElementById('roleUserSelect') ? document.getElementById('roleUserSelect').value : '';
            const roles = {
                isAdmin:         document.getElementById('roleCheck_is_admin')         ? document.getElementById('roleCheck_is_admin').checked         : false,
                isEditor:        document.getElementById('roleCheck_is_editor')        ? document.getElementById('roleCheck_is_editor').checked        : false,
                canPostArticles: document.getElementById('roleCheck_can_post_articles') ? document.getElementById('roleCheck_can_post_articles').checked : false,
                isCommenter:     document.getElementById('roleCheck_comment_adder')    ? document.getElementById('roleCheck_comment_adder').checked    : false,
                isQuestAdder:    document.getElementById('roleCheck_quest_adder')      ? document.getElementById('roleCheck_quest_adder').checked      : false,
                isLoreEditor:    document.getElementById('roleCheck_lore_editor')      ? document.getElementById('roleCheck_lore_editor').checked      : false
            };

            if (roleMsg) { roleMsg.className = 'form-message info'; roleMsg.textContent = 'Saving\u2026'; roleMsg.classList.remove('hidden'); }

            const result = await saveUserRoles(userId, roles);

            if (result.error) {
                if (roleMsg) { roleMsg.className = 'form-message error'; roleMsg.textContent = result.error; }
            } else {
                if (roleMsg) { roleMsg.className = 'form-message success'; roleMsg.textContent = 'Roles saved successfully!'; }
                allSiteUsersCache = [];
                userRolesLoaded = false;
                dashboardStatsCache = null;
                fetchAndRenderUserRoles();
                fetchDashboardStats();
                setTimeout(function() { if (userRoleModal) userRoleModal.classList.add('hidden'); }, 1500);
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
$(document).ready(async function() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'admin.html') return;

    showLoadingOverlay(true);
    setupAuthEventListeners();
    setupCommentFormHandlers();
    setupModalHandlers();
    initAuthAndDashboard();
});
