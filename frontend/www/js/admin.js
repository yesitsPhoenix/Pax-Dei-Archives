import { supabase } from './supabaseClient.js';
import { authorRoleColors, slugify } from './utils.js';


let initialAuthCheckComplete = false;
let dashboardStatsCache = null;
let lastStatsFetchTime = 0;
const STATS_CACHE_DURATION = 60 * 5000;
let tagListCache = null;
let isAdminAuthorizedCache = null;
let loreItemsCache = [];

function showFormMessage(messageElement, message, type) {
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

const authorTypeDropdown = document.getElementById('author_type');
const formMessage = document.getElementById('formMessage');

if (authorTypeDropdown) {
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select Author Type";
    defaultOption.selected = true;
    authorTypeDropdown.appendChild(defaultOption);

    for (const type in authorRoleColors) {
        if (authorRoleColors.hasOwnProperty(type) && type !== 'default') {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            authorTypeDropdown.appendChild(option);
        }
    }
}

const devCommentForm = document.getElementById('devCommentForm');
const tagSelect = document.getElementById('tagSelect');

if (devCommentForm) {
    devCommentForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (formMessage) {
            formMessage.textContent = '';
            formMessage.className = '';
        }

        const author = document.getElementById('author').value;
        const source = document.getElementById('source').value;
        const timestamp = document.getElementById('timestamp').value;
        const content = document.getElementById('commentContent').value;
        const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);
        const author_type = authorTypeDropdown ? authorTypeDropdown.value : '';

        let utcTimestamp = null;
        if (timestamp) {
            const localDate = new Date(timestamp);
            utcTimestamp = localDate.toISOString();
        }

        const submitButton = devCommentForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
        }

        if (!author_type) {
            showFormMessage(formMessage, 'Please select an Author Type.', 'error');
            if (authorTypeDropdown) {
                authorTypeDropdown.focus();
            }
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Add Comment to DB';
            }
            return;
        }

        const commentData = {
            author: author,
            source: source,
            comment_date: utcTimestamp,
            content: content,
            tag: selectedTags.length > 0 ? selectedTags : null,
            author_type: author_type,
        };

        showFormMessage(formMessage, 'Submitting comment...', 'info');

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                showFormMessage(formMessage, 'Please log in to submit comments.', 'error');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Add Comment to DB';
                }
                return;
            }

            const { data, error, status } = await supabase
                .from('developer_comments')
                .insert([commentData])
                .select();

            if (error) {
                console.error('Error inserting comment:', error);
                showFormMessage(formMessage, `Error saving comment: ${error.message}`, 'error');
            } else {
                showFormMessage(formMessage, 'Developer comment added successfully!', 'success');

                devCommentForm.reset();
                if (authorTypeDropdown) {
                    authorTypeDropdown.value = "";
                }
                if (tagSelect) {
                    Array.from(tagSelect.options).forEach(option => option.selected = false);
                }

                document.getElementById('devCommentForm').style.display = 'none';
                document.getElementById('commentInput').style.display = 'block';
                document.getElementById('parseButton').style.display = 'block';
                document.getElementById('parseError').style.display = 'none';

                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'developer-comments.html' && typeof fetchAndRenderDeveloperComments === 'function' && document.getElementById('dev-comments-container')) {
                    fetchAndRenderDeveloperComments('dev-comments-container');
                } else if ((currentPage === 'index.html' || currentPage === '') && typeof fetchAndRenderDeveloperComments === 'function' && document.getElementById('recent-comments-home')) {
                    fetchAndRenderDeveloperComments('recent-comments-home', 6);
                }
                fetchDashboardStats();
            }
        } catch (err) {
            console.error('Unexpected error submitting comment:', err);
            showFormMessage(formMessage, 'An unexpected error occurred. Please try again.', 'error');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Add Comment to DB';
            }
        }
    });
}

async function isAuthorizedAdmin(userId) {
    if (!userId) {
        isAdminAuthorizedCache = false;
        return false;
    }
    if (isAdminAuthorizedCache !== null) {
        return isAdminAuthorizedCache;
    }
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            isAdminAuthorizedCache = false;
            return false;
        }
        if (error) {
            console.error('Error checking admin authorization:', error.message);
            isAdminAuthorizedCache = false;
            return false;
        }

        isAdminAuthorizedCache = data && data.role === 'comment_adder';
        return isAdminAuthorizedCache;
    } catch (e) {
        console.error('Unexpected error in isAuthorizedAdmin:', e);
        isAdminAuthorizedCache = false;
        return false;
    }
}

async function fetchDashboardStats() {
    const totalCommentsCount = document.getElementById('totalCommentsCount');
    const commentsMonthCount = document.getElementById('commentsMonthCount');
    const totalLoreCount = document.getElementById('totalLoreCount');

    if (!totalCommentsCount || !commentsMonthCount || !totalLoreCount) {
        return;
    }

    const now = Date.now();
    if (dashboardStatsCache && (now - lastStatsFetchTime < STATS_CACHE_DURATION)) {
        totalCommentsCount.textContent = dashboardStatsCache.commentsTotal;
        commentsMonthCount.textContent = dashboardStatsCache.commentsThisMonth;
        totalLoreCount.textContent = dashboardStatsCache.loreTotal;
        return;
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const [{ count: commentsTotal, error: commentsTotalError },
        { count: commentsThisMonth, error: commentsMonthError },
        { count: loreTotal, error: loreTotalError }] = await Promise.all([
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }),
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }).gte('comment_date', startOfMonth).lte('comment_date', endOfMonth),
        supabase.from('lore_items').select('*', { count: 'exact', head: true })
    ]);

    if (commentsTotalError || commentsMonthError || loreTotalError) {
        console.error('Error fetching dashboard stats:', commentsTotalError || commentsMonthError || loreTotalError);
        totalCommentsCount.textContent = 'Error';
        commentsMonthCount.textContent = 'Error';
        totalLoreCount.textContent = 'Error';
        dashboardStatsCache = null;
    } else {
        dashboardStatsCache = {
            commentsTotal,
            commentsThisMonth,
            loreTotal
        };
        lastStatsFetchTime = now;

        totalCommentsCount.textContent = commentsTotal;
        commentsMonthCount.textContent = commentsThisMonth;
        totalLoreCount.textContent = loreTotal;
    }
}

function parseComment(text) {
    const mainRegex = /^(.*?)\s*—\s*([\s\S]*?)(https?:\/\/[^\s]+)?$/;
    const match = text.match(mainRegex);

    if (!match) {
        return null;
    }

    try {
        const author = match[1].trim();
        let fullContentAndPotentialTimestamp = match[2].trim();
        const url = match[3] ? match[3].trim() : '';
        const finalSource = url;

        let parsedDate = new Date();
        let content = fullContentAndPotentialTimestamp;

        const lines = fullContentAndPotentialTimestamp.split('\n').map(line => line.trim()).filter(Boolean);
        let firstLine = lines.length > 0 ? lines[0] : '';
        let timestampMatchFound = false;

        let timestampMatch;

        const fullDateTimePattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4})(?:,\s*|\s+)(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
        timestampMatch = firstLine.match(fullDateTimePattern);

        if (timestampMatch) {
            const datePart = timestampMatch[1];
            const timePart = timestampMatch[2];
            const remainingFirstLineContent = timestampMatch[3].trim();

            let [month, day, year] = datePart.split('/').map(Number);
            if (year < 100) {
                year += (year > 50) ? 1900 : 2000;
            }
            parsedDate = new Date(year, month - 1, day);
            parseTimeIntoDate(timePart, parsedDate);
            timestampMatchFound = true;

            content = [remainingFirstLineContent, ...lines.slice(1)].filter(Boolean).join('\n').trim();

        } else {
            const yesterdayPattern = /^yesterday at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
            timestampMatch = firstLine.match(yesterdayPattern);

            if (timestampMatch) {
                const timePart = timestampMatch[1];
                const remainingFirstLineContent = timestampMatch[2].trim();

                parsedDate = new Date();
                parsedDate.setDate(parsedDate.getDate() - 1);
                parseTimeIntoDate(timePart, parsedDate);
                timestampMatchFound = true;

                content = [remainingFirstLineContent, ...lines.slice(1)].filter(Boolean).join('\n').trim();

            } else {
                const todayPattern = /^today at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
                timestampMatch = firstLine.match(todayPattern);

                if (timestampMatch) {
                    const timePart = timestampMatch[1];
                    const remainingFirstLineContent = timestampMatch[2].trim();

                    parsedDate = new Date();
                    parseTimeIntoDate(timePart, parsedDate);
                    timestampMatchFound = true;

                    content = [remainingFirstLineContent, ...lines.slice(1)].filter(Boolean).join('\n').trim();

                } else {

                    const timeOnlyPattern = /^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
                    timestampMatch = firstLine.match(timeOnlyPattern);

                    if (timestampMatch) {
                        const timePart = timestampMatch[1];
                        const remainingFirstLineContent = timestampMatch[2].trim();

                        parsedDate = new Date();
                        parseTimeIntoDate(timePart, parsedDate);
                        timestampMatchFound = true;

                        content = [remainingFirstLineContent, ...lines.slice(1)].filter(Boolean).join('\n').trim();
                    }
                }
            }
        }

        if (!timestampMatchFound) {
            console.warn("No specific timestamp format recognized from the first line. Assuming content is the full string and using current date/time.");
        }

        function parseTimeIntoDate(timePart, dateObject) {
            const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
            const timeMatchResult = timePart.match(timeRegex);

            if (timeMatchResult) {
                let hours = parseInt(timeMatchResult[1]);
                const minutes = parseInt(timeMatchResult[2]);
                const ampm = timeMatchResult[3].toLowerCase();
                if (ampm === 'pm' && hours < 12) { hours += 12; }
                if (ampm === 'am' && hours === 12) { hours = 0; }
                dateObject.setHours(hours, minutes, 0, 0);
            } else {
                dateObject.setHours(0, 0, 0, 0);
            }
        }

        const yearFormatted = parsedDate.getFullYear();
        const monthFormatted = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
        const dayFormatted = parsedDate.getDate().toString().padStart(2, '0');
        const hoursFormatted = parsedDate.getHours().toString().padStart(2, '0');
        const minutesFormatted = parsedDate.getMinutes().toString().padStart(2, '0');

        const formattedTimestamp = `${yearFormatted}-${monthFormatted}-${dayFormatted}T${hoursFormatted}:${minutesFormatted}`;

        return { author, source: finalSource, timestamp: formattedTimestamp, content };

    } catch (e) {
        console.error("Error during comment parsing:", e);
        return null;
    }
}

async function populateTagSelect(tagSelectElement) {
    if (!tagSelectElement) {
        return;
    }
    tagSelectElement.innerHTML = '';

    if (!tagSelectElement.multiple && tagSelectElement.id === 'loreCategory') {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a category';
        tagSelectElement.appendChild(defaultOption);
    }

    if (!tagListCache) {
        try {
            const { data, error } = await supabase
                .from('tag_list')
                .select('tag_name')
                .order('tag_name', { ascending: true });

            if (error) {
                console.error('Error fetching tags for admin form:', error.message);
                return;
            }
            tagListCache = data;
        } catch (e) {
            console.error('Unexpected error populating tags for admin form:', e);
            return;
        }
    }

    if (tagListCache && tagListCache.length > 0) {
        tagListCache.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.tag_name;
            option.textContent = tag.tag_name;
            tagSelectElement.appendChild(option);
        });
    }
}


async function handleAddNewTag(newTagValue, inputElement, messageElement, tagSelectElement, loreCategorySelectElement, tagType = 'Tag') {
    if (newTagValue) {
        try {
            const { error } = await supabase
                .from('tag_list')
                .insert([{ tag_name: newTagValue }]);

            if (error && error.code !== '23505') {
                showFormMessage(messageElement, `Error adding ${tagType}: ` + error.message, 'error');
            } else {
                if (error && error.code === '23505') {
                    showFormMessage(messageElement, `${tagType} '${newTagValue}' already exists.`, 'warning');
                } else {
                    showFormMessage(messageElement, `${tagType} '${newTagValue}' added successfully!`, 'success');
                    tagListCache.push({ tag_name: newTagValue });
                    tagListCache.sort((a, b) => a.tag_name.localeCompare(b.tag_name));
                }
                inputElement.value = '';
                populateTagSelect(tagSelectElement);
                populateTagSelect(loreCategorySelectElement);
            }
        } catch (e) {
            showFormMessage(messageElement, `An unexpected error occurred while adding ${tagType}.`, 'error');
        }
    } else {
        showFormMessage(messageElement, `Please enter a ${tagType.toLowerCase()} name.`, 'warning');
    }
}

function renderLoreItems(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (loreItemsCache.length === 0) {
        container.innerHTML = 'No lore items found.';
        return;
    }

    container.innerHTML = '';
    const list = document.createElement('ul');
    list.classList.add('lore-item-list');
    loreItemsCache.forEach(item => {
        const listItem = document.createElement('li');
        listItem.classList.add('lore-item');
        listItem.innerHTML = `
            <div class="lore-item-header">
                <h3>${item.title}</h3>
                <span class="lore-item-category">${item.category}</span>
            </div>
            <p class="lore-item-slug">Slug: ${item.slug}</p>
            <div class="lore-item-content">
                <p>${item.content.substring(0, 150)}...</p>
            </div>
            <div class="lore-item-actions">
                <button class="edit-lore-item" data-id="${item.id}">Edit</button>
                <button class="delete-lore-item" data-id="${item.id}">Delete</button>
            </div>
        `;
        list.appendChild(listItem);
    });
    container.appendChild(list);

    container.querySelectorAll('.edit-lore-item').forEach(button => {
        button.addEventListener('click', (e) => editLoreItem(e.target.dataset.id));
    });
    container.querySelectorAll('.delete-lore-item').forEach(button => {
        button.addEventListener('click', (e) => deleteLoreItem(e.target.dataset.id));
    });
}

async function fetchAndSetLoreItemsCache(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = 'Loading lore items...';

    try {
        const { data, error } = await supabase
            .from('lore_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `Error loading lore items: ${error.message}`;
            console.error('Error fetching lore items:', error.message);
            loreItemsCache = [];
            return;
        }

        loreItemsCache = data;
        renderLoreItems(containerId);

    } catch (e) {
        container.innerHTML = `An unexpected error occurred: ${e.message}`;
        console.error('Unexpected error in fetchAndSetLoreItemsCache:', e);
        loreItemsCache = [];
    }
}

async function editLoreItem(id) {
    const loreItem = loreItemsCache.find(item => item.id == id);

    if (!loreItem) {
        console.error('Lore item not found in cache for edit:', id);
        showFormMessage(document.getElementById('addLoreItemMessage'), `Error: Lore item not found.`, 'error');
        return;
    }

    document.getElementById('loreTitle').value = loreItem.title;
    document.getElementById('loreSlug').value = loreItem.slug;
    document.getElementById('loreCategory').value = loreItem.category;
    document.getElementById('loreContent').value = loreItem.content;
    document.getElementById('addLoreItemForm').dataset.editingId = loreItem.id;
    document.getElementById('addLoreItemForm').querySelector('button[type="submit"]').textContent = 'Update Lore Item';
    document.getElementById('cancelEditLoreItemButton').style.display = 'inline-block';
    document.getElementById('newLoreCategoryInput').style.display = 'none';
    document.getElementById('addNewLoreCategoryButton').style.display = 'none';

    document.getElementById('addLoreItemMessage').textContent = 'Editing Lore Item';
    document.getElementById('addLoreItemMessage').className = 'form-message info';
    document.getElementById('addLoreItemMessage').style.display = 'block';
}

async function deleteLoreItem(id) {
    if (!confirm('Are you sure you want to delete this lore item?')) {
        return;
    }

    const { error } = await supabase
        .from('lore_items')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting lore item:', error.message);
        showFormMessage(document.getElementById('addLoreItemMessage'), `Error deleting lore item: ${error.message}`, 'error');
    } else {
        loreItemsCache = loreItemsCache.filter(item => item.id != id);
        renderLoreItems('loreItemsList');
        showFormMessage(document.getElementById('addLoreItemMessage'), 'Lore item deleted successfully!', 'success');
        fetchDashboardStats();
    }
}

function resetLoreForm() {
    const addLoreItemForm = document.getElementById('addLoreItemForm');
    addLoreItemForm.reset();
    addLoreItemForm.removeAttribute('data-editing-id');
    addLoreItemForm.querySelector('button[type="submit"]').textContent = 'Add Lore Item';
    document.getElementById('cancelEditLoreItemButton').style.display = 'none';
    document.getElementById('newLoreCategoryInput').style.display = 'block';
    document.getElementById('addNewLoreCategoryButton').style.display = 'inline-block';
    showFormMessage(document.getElementById('addLoreItemMessage'), '', '');
}

function hideAllAdminElements() {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const loginHeading = document.getElementById('loginHeading');
    const adminDashboardAndForm = document.getElementById('adminDashboardAndForm');
    const loginError = document.getElementById('loginError');

    if (loginFormContainer) loginFormContainer.style.display = 'none';
    if (loginHeading) loginHeading.style.display = 'none';
    if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
}

async function initAuthAndDashboard() {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const loginHeading = document.getElementById('loginHeading');
    const adminDashboardAndForm = document.getElementById('adminDashboardAndForm');
    const loginError = document.getElementById('loginError');

    const { data: { user } = {} } = await supabase.auth.getUser();

    if (user) {
        const authorized = await isAuthorizedAdmin(user.id);

        if (authorized) {
            if (loginFormContainer) loginFormContainer.style.display = 'none';
            if (loginHeading) loginHeading.style.display = 'none';
            if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'block';
            fetchDashboardStats();
            if (!initialAuthCheckComplete) {
                populateTagSelect(document.getElementById('tagSelect'));
                populateTagSelect(document.getElementById('loreCategory'));
                fetchAndSetLoreItemsCache('loreItemsList');
                initialAuthCheckComplete = true;
            }
        } else {
            if (loginFormContainer) loginFormContainer.style.display = 'block';
            if (loginHeading) loginHeading.style.display = 'none';
            if (loginError) {
                loginError.textContent = 'You are logged in but not authorized to view this page. Redirecting to home...';
                loginError.style.display = 'block';
            }
            if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 8000);
        }
    } else {
        if (loginFormContainer) loginFormContainer.style.display = 'block';
        if (loginHeading) loginHeading.style.display = 'block';
        if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
        if (loginError) {
             loginError.textContent = 'Please log in to view this page. Redirecting to home...';
             loginError.style.display = 'block';
        }
       
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 8000);
    }
}

function setupAuthEventListeners() {
    const discordLoginButton = document.getElementById('discordLoginButton');
    const loginError = document.getElementById('loginError');

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            initialAuthCheckComplete = false;
            isAdminAuthorizedCache = null;
            initAuthAndDashboard();
        }
    });

    if (discordLoginButton) {
        discordLoginButton.addEventListener('click', async () => {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: 'https://yesitsphoenix.github.io/Pax-Dei-Archives/admin.html'
                }
            });

            if (error) {
                console.error('Discord login error:', error);
                if (loginError) {
                    loginError.textContent = 'Login failed: ' + error.message;
                    loginError.style.display = 'block';
                }
            }
        });
    }
}

function setupCommentFormHandlers() {
    const commentInput = document.getElementById('commentInput');
    const parseButton = document.getElementById('parseButton');
    const devCommentForm = document.getElementById('devCommentForm');
    const parseError = document.getElementById('parseError');
    const authorField = document.getElementById('author');
    const sourceField = document.getElementById('source');
    const timestampField = document.getElementById('timestamp');
    const commentContentField = document.getElementById('commentContent');
    const editButton = document.getElementById('editButton');
    const formMessage = document.getElementById('formMessage');

    if (parseButton && commentInput && devCommentForm && parseError) {
        parseButton.addEventListener('click', () => {
            showFormMessage(formMessage, '', '');
            const inputText = commentInput.value;
            const parsedData = parseComment(inputText);

            if (parsedData) {
                if (authorField) authorField.value = parsedData.author;
                if (sourceField) sourceField.value = parsedData.source;
                if (timestampField) timestampField.value = parsedData.timestamp;
                if (commentContentField) commentContentField.value = parsedData.content;

                devCommentForm.style.display = 'block';
                commentInput.style.display = 'none';
                parseButton.style.display = 'none';
                parseError.style.display = 'none';
            } else {
                parseError.textContent = 'Could not parse the input. Please ensure it matches one of the expected formats: "Author — Timestamp Content [Optional URL]" or "Author — Content [Optional URL]"';
                parseError.style.display = 'block';
                devCommentForm.style.display = 'none';
                commentInput.style.display = 'block';
                parseError.style.display = 'none';
            }
        });
    }

    if (editButton && devCommentForm && commentInput && parseButton && parseError) {
        editButton.addEventListener('click', () => {
            showFormMessage(formMessage, '', '');
            devCommentForm.style.display = 'none';
            commentInput.style.display = 'block';
            parseButton.style.display = 'block';
            parseError.style.display = 'none';
        });
    }
}

function setupTagManagementHandlers() {
    const newTagInput = document.getElementById('newTagInput');
    const addNewTagButton = document.getElementById('addNewTagButton');
    const tagSelect = document.getElementById('tagSelect');
    const loreCategorySelect = document.getElementById('loreCategory');

    if (addNewTagButton && newTagInput && tagSelect && loreCategorySelect) {
        addNewTagButton.addEventListener('click', async () => {
            const newTag = newTagInput.value.trim();
            await handleAddNewTag(newTag, newTagInput, formMessage, tagSelect, loreCategorySelect, 'Tag');
        });
    }
    
    const newLoreCategoryInput = document.getElementById('newLoreCategoryInput');
    const addNewLoreCategoryButton = document.getElementById('addNewLoreCategoryButton');
    const addLoreItemMessage = document.getElementById('addLoreItemMessage');

    if (addNewLoreCategoryButton && newLoreCategoryInput && loreCategorySelect && tagSelect) {
        addNewLoreCategoryButton.addEventListener('click', async () => {
            const newCategory = newLoreCategoryInput.value.trim();
            await handleAddNewTag(newCategory, newLoreCategoryInput, addLoreItemMessage, tagSelect, loreCategorySelect, 'Category');
        });
    }
}

function setupLoreItemFormHandlers() {
    const addLoreItemForm = document.getElementById('addLoreItemForm');
    const loreTitleInput = document.getElementById('loreTitle');
    const loreSlugInput = document.getElementById('loreSlug');
    const loreCategorySelect = document.getElementById('loreCategory');
    const loreContentInput = document.getElementById('loreContent');
    const addLoreItemMessage = document.getElementById('addLoreItemMessage');
    const cancelEditLoreItemButton = document.getElementById('cancelEditLoreItemButton');

    if (loreTitleInput && loreSlugInput && addLoreItemForm) {
        loreTitleInput.addEventListener('input', () => {
            loreSlugInput.value = slugify(loreTitleInput.value);
        });
    }

    if (addLoreItemForm) {
        addLoreItemForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showFormMessage(addLoreItemMessage, '', '');

            const title = loreTitleInput.value.trim();
            const slug = loreSlugInput.value.trim() || slugify(title);
            const category = loreCategorySelect.value;
            const content = loreContentInput.value.trim();
            const editingId = addLoreItemForm.dataset.editingId;

            if (!title || !slug || !category || !content) {
                showFormMessage(addLoreItemMessage, 'Please fill in all required lore item fields (Title, Slug, Category, Content).', 'error');
                return;
            }

            const loreItemData = {
                title: loreTitleInput.value,
                slug: loreSlugInput.value,
                category: loreCategorySelect.value,
                content: loreContentInput.value
            };

            let error;
            let insertedData;
            if (editingId) {
                const { data, error: updateError } = await supabase
                    .from('lore_items')
                    .update(loreItemData)
                    .eq('id', editingId)
                    .select();
                error = updateError;
                insertedData = data ? data[0] : null;
            } else {
                const { data, error: insertError } = await supabase
                    .from('lore_items')
                    .insert([loreItemData])
                    .select();
                error = insertError;
                insertedData = data ? data[0] : null;
            }

            if (error) {
                console.error('Error saving lore item:', error);
                showFormMessage(addLoreItemMessage, 'Error saving lore item: ' + error.message, 'error');
            } else {
                if (editingId) {
                    const index = loreItemsCache.findIndex(item => item.id == editingId);
                    if (index !== -1) {
                        loreItemsCache[index] = { ...loreItemsCache[index], ...loreItemData };
                    }
                } else {
                    loreItemsCache.unshift(insertedData);
                }
                renderLoreItems('loreItemsList');
                showFormMessage(addLoreItemMessage, `Lore item ${editingId ? 'updated' : 'added'} successfully!`, 'success');
                resetLoreForm();
                fetchDashboardStats();
            }
        });
    }

    if (cancelEditLoreItemButton) {
        cancelEditLoreItemButton.addEventListener('click', resetLoreForm);
    }
}

$(document).ready(async function() {
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'admin.html') {
        return;
    }

    hideAllAdminElements();
    initAuthAndDashboard();
    setupAuthEventListeners();
    setupCommentFormHandlers();
    setupTagManagementHandlers();
    setupLoreItemFormHandlers();
});