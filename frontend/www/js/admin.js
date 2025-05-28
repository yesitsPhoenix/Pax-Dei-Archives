import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let initialAuthCheckComplete = false;


function showFormMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.className = ''; // Reset classes
    if (type) {
        messageElement.classList.add('form-message', type);
        messageElement.style.display = 'block';

        if (message) {
            setTimeout(() => {
                messageElement.style.display = 'none';
                messageElement.textContent = '';
            }, 5000); // Hide after 5 seconds
        }
    } else {
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}


async function isAuthorizedAdmin(userId) {
    if (!userId) return false;
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', 'comment_adder')
            .single();

        return !!data;
    } catch (error) {
        console.error('Error checking admin authorization:', error.message);
        return false;
    }
}


async function fetchDashboardStats() {
    const totalCommentsCount = document.getElementById('totalCommentsCount');
    const totalNewsCount = document.getElementById('totalNewsCount');
    const commentsMonthCount = document.getElementById('commentsMonthCount');
    const newsMonthCount = document.getElementById('newsMonthCount');

    if (!totalCommentsCount || !totalNewsCount || !commentsMonthCount || !newsMonthCount) {
        console.warn('Dashboard elements not found. Skipping stats fetch.');
        return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const [{ count: commentsTotal, error: commentsTotalError },
           { count: newsTotal, error: newsTotalError },
           { count: commentsThisMonth, error: commentsMonthError },
           { count: newsThisMonth, error: newsMonthError }] = await Promise.all([
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }),
        supabase.from('news_updates').select('*', { count: 'exact', head: true }),
        supabase.from('developer_comments').select('*', { count: 'exact', head: true }).gte('comment_date', startOfMonth).lte('comment_date', endOfMonth),
        supabase.from('news_updates').select('*', { count: 'exact', head: true }).gte('news_date', startOfMonth).lte('news_date', endOfMonth)
    ]);

    if (commentsTotalError || newsTotalError || commentsMonthError || newsMonthError) {
        console.error('Error fetching dashboard stats:', commentsTotalError || newsTotalError || commentsMonthError || newsMonthError);
        totalCommentsCount.textContent = 'Error';
        totalNewsCount.textContent = 'Error';
        commentsMonthCount.textContent = 'Error';
        newsMonthCount.textContent = 'Error';
    } else {
        totalCommentsCount.textContent = commentsTotal;
        totalNewsCount.textContent = newsTotal;
        commentsMonthCount.textContent = commentsThisMonth;
        newsMonthCount.textContent = newsThisMonth;
    }
}


function parseComment(text) {
    const mainRegex = /^(.*?)\s*—\s*([\s\S]*?)(https?:\/\/[^\s]+)?$/;
    const match = text.match(mainRegex);

    if (!match) {
        console.error("Main regex did not match the input text.");
        return null;
    }

    try {
        const author = match[1].trim();
        let rawContentWithTimestamp = match[2].trim();
        const url = match[3] ? match[3].trim() : '';
        const finalSource = url;

        let parsedDate = new Date();
        let content = rawContentWithTimestamp;

        const fullDateTimePattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
        let timestampMatch = rawContentWithTimestamp.match(fullDateTimePattern);

        if (timestampMatch) {
            const datePart = timestampMatch[1];
            const timePart = timestampMatch[2];
            content = timestampMatch[3].trim();

            let [month, day, year] = datePart.split('/').map(Number);
            if (year < 100) {
                year += (year > 50) ? 1900 : 2000;
            }
            parsedDate = new Date(year, month - 1, day);

            const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
            const timeMatchResult = timePart.match(timeRegex);

            if (timeMatchResult) {
                let hours = parseInt(timeMatchResult[1]);
                const minutes = parseInt(timeMatchResult[2]);
                const ampm = timeMatchResult[3].toLowerCase();
                if (ampm === 'pm' && hours < 12) { hours += 12; }
                if (ampm === 'am' && hours === 12) { hours = 0; }
                parsedDate.setHours(hours, minutes, 0, 0);
            } else {
                console.warn("Could not parse time part for full date format:", timePart);
                parsedDate.setHours(0, 0, 0, 0);
            }
        } else {
            const yesterdayPattern = /^yesterday at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
            timestampMatch = rawContentWithTimestamp.match(yesterdayPattern);

            if (timestampMatch) {
                const timePart = timestampMatch[1];
                content = timestampMatch[2].trim();
                parsedDate = new Date();
                parsedDate.setDate(parsedDate.getDate() - 1);

                const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
                const timeMatchResult = timePart.match(timeRegex);
                if (timeMatchResult) {
                    let hours = parseInt(timeMatchResult[1]);
                    const minutes = parseInt(timeMatchResult[2]);
                    const ampm = timeMatchResult[3].toLowerCase();
                    if (ampm === 'pm' && hours < 12) { hours += 12; }
                    if (ampm === 'am' && hours === 12) { hours = 0; }
                    parsedDate.setHours(hours, minutes, 0, 0);
                } else {
                    console.warn("Could not parse time part for 'Yesterday at' format:", timePart);
                    parsedDate.setHours(0,0,0,0);
                }
            } else {
                const timeOnlyPattern = /^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
                timestampMatch = rawContentWithTimestamp.match(timeOnlyPattern);

                if (timestampMatch) {
                    const timePart = timestampMatch[1];
                    content = timestampMatch[2].trim();
                    parsedDate = new Date();

                    const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
                    const timeMatchResult = timePart.match(timeRegex);

                    if (timeMatchResult) {
                        let hours = parseInt(timeMatchResult[1]);
                        const minutes = parseInt(timeMatchResult[2]);
                        const ampm = timeMatchResult[3].toLowerCase();
                        if (ampm === 'pm' && hours < 12) { hours += 12; }
                        if (ampm === 'am' && hours === 12) { hours = 0; }
                        parsedDate.setHours(hours, minutes, 0, 0);
                    } else {
                        console.warn("Could not parse time part for time-only format:", timePart);
                        parsedDate.setHours(0,0,0,0);
                    }
                } else {
                    console.warn("No specific timestamp format recognized. Assuming content is the full string and using current date/time.");
                    content = rawContentWithTimestamp;
                    parsedDate = new Date();
                }
            }
        }

        if (content === '' && timestampMatch && rawContentWithTimestamp.length > timestampMatch[0].length) {
             const potentialContentAfterTimestamp = rawContentWithTimestamp.substring(timestampMatch[0].length).trim();
             if (potentialContentAfterTimestamp) {
                 content = potentialContentAfterTimestamp;
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
        console.warn('tagSelect element not found. Cannot populate tags.');
        return;
    }
    // Clear all existing options
    tagSelectElement.innerHTML = '';

    // Add a default option based on the select element's ID
    if (tagSelectElement.id === 'loreCategory') {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a category';
        tagSelectElement.appendChild(defaultOption);
    } else if (tagSelectElement.id === 'tagSelect') {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select existing tags (Ctrl/Cmd+Click to select multiple)';
        tagSelectElement.appendChild(defaultOption);
    }


    try {
        const { data, error } = await supabase
            .from('tag_list')
            .select('tag_name')
            .order('tag_name', { ascending: true });

        if (error) {
            console.error('Error fetching tags for admin form:', error.message);
            return;
        }

        if (data && data.length > 0) {
            data.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.tag_name;
                option.textContent = tag.tag_name;
                tagSelectElement.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Unexpected error populating tags for admin form:', e);
    }
}


function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}


$(document).ready(async function() {
    // Check if we are on the admin page
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'admin.html') {
        return; // Exit if not on admin page
    }

    const discordLoginButton = document.getElementById('discordLoginButton');
    const loginError = document.getElementById('loginError');
    const loginFormContainer = document.getElementById('loginFormContainer');
    const loginHeading = document.getElementById('loginHeading');
    const adminDashboardAndForm = document.getElementById('adminDashboardAndForm');

    // Dev Comment Parser elements
    const commentInput = document.getElementById('commentInput');
    const parseButton = document.getElementById('parseButton');
    const devCommentForm = document.getElementById('devCommentForm');
    const parseError = document.getElementById('parseError');
    const formMessage = document.getElementById('formMessage');

    // Dev Comment Form fields
    const authorField = document.getElementById('author');
    const sourceField = document.getElementById('source');
    const timestampField = document.getElementById('timestamp');
    const commentContentField = document.getElementById('commentContent');
    const editButton = document.getElementById('editButton');
    const tagSelect = document.getElementById('tagSelect');
    const newTagInput = document.getElementById('newTagInput');
    const addNewTagButton = document.getElementById('addNewTagButton');

    // News Update Form elements
    const addNewsUpdateForm = document.getElementById('addNewsUpdateForm');
    const newsDateInput = document.getElementById('news_date');
    const newsTitleInput = document.getElementById('news_title');
    const newsSummaryInput = document.getElementById('news_summary');
    const fullArticleLinkInput = document.getElementById('full_article_link');
    const addNewsUpdateMessage = document.getElementById('addNewsUpdateMessage');

    // Lore Item Form elements
    const addLoreItemForm = document.getElementById('addLoreItemForm');
    const loreTitleInput = document.getElementById('loreTitle');
    const loreSlugInput = document.getElementById('loreSlug');
    const loreCategorySelect = document.getElementById('loreCategory');
    const newLoreCategoryInput = document.getElementById('newLoreCategoryInput');
    const addNewLoreCategoryButton = document.getElementById('addNewLoreCategoryButton');
    const loreContentInput = document.getElementById('loreContent');
    const addLoreItemMessage = document.getElementById('addLoreItemMessage');


    async function checkAuth() {
        const { data: { user } = {} } = await supabase.auth.getUser();

        if (user) {
            const authorized = await isAuthorizedAdmin(user.id);

            if (authorized) {
                if (loginFormContainer) loginFormContainer.style.display = 'none';
                if (loginHeading) loginHeading.style.display = 'none';
                if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'block';
                fetchDashboardStats();
                // Populate selects only once after successful authorization and UI display
                if (!initialAuthCheckComplete) {
                    populateTagSelect(tagSelect);
                    populateTagSelect(loreCategorySelect);
                    initialAuthCheckComplete = true;
                }
            } else {
                if (loginFormContainer) loginFormContainer.style.display = 'block';
                if (loginHeading) loginHeading.style.display = 'none';
                if (loginError) {
                    loginError.textContent = 'You are logged in but not authorized to add comments.';
                    loginError.style.display = 'block';
                }
                if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
            }
        } else {
            if (loginFormContainer) loginFormContainer.style.display = 'block';
            if (loginHeading) loginHeading.style.display = 'block';
            if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
            if (loginError) loginError.style.display = 'none';
        }
    }

    // Initial auth check
    checkAuth();

    supabase.auth.onAuthStateChange((event, session) => {
        // Only trigger checkAuth if the event is a significant change, not just focus
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { // INITIAL_SESSION is handled by initial checkAuth() call
            initialAuthCheckComplete = false; // Reset flag to allow repopulation if session changes
            checkAuth();
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
                parseButton.style.display = 'block';
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

    if (addNewTagButton && newTagInput && tagSelect) {
        addNewTagButton.addEventListener('click', async () => {
            const newTag = newTagInput.value.trim();
            if (newTag) {
                try {
                    const { data, error } = await supabase
                        .from('tag_list')
                        .insert([{ tag_name: newTag }]);

                    if (error && error.code !== '23505') {
                        console.error('Error adding new tag:', error.message);
                        showFormMessage(formMessage, 'Error adding tag: ' + error.message, 'error');
                    } else {
                        if (error && error.code === '23505') {
                            showFormMessage(formMessage, `Tag '${newTag}' already exists.`, 'warning');
                        } else {
                            showFormMessage(formMessage, `Tag '${newTag}' added successfully!`, 'success');
                        }
                        newTagInput.value = '';
                        populateTagSelect(tagSelect); // Refresh the tag dropdown
                        populateTagSelect(loreCategorySelect); // Also refresh lore categories
                    }
                } catch (e) {
                    console.error('Unexpected error adding new tag:', e);
                    showFormMessage(formMessage, 'An unexpected error occurred while adding tag.', 'error');
                }
            } else {
                showFormMessage(formMessage, 'Please enter a tag name.', 'warning');
            }
        });
    }

    if (devCommentForm && commentInput && parseButton && parseError) {
        devCommentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showFormMessage(formMessage, '', '');

            const selectedTag = tagSelect.value;

            const newComment = {
                author: authorField.value,
                source: sourceField.value,
                comment_date: new Date(timestampField.value).toISOString(),
                content: commentContentField.value,
                title: commentContentField.value.substring(0, 45) + (commentContentField.value.length > 45 ? '...' : ''),
                tag: selectedTag || null
            };

            const { data, error } = await supabase
                .from('developer_comments')
                .insert([newComment]);

            if (error) {
                console.error('Error inserting comment:', error);
                showFormMessage(formMessage, 'Error adding comment: ' + error.message, 'error');
            } else {
                showFormMessage(formMessage, 'Developer comment added successfully!', 'success');
                console.log('Developer comment added:', data);
                commentInput.value = '';
                devCommentForm.style.display = 'none';
                commentInput.style.display = 'block';
                parseButton.style.display = 'block';
                parseError.style.display = 'none';
                Array.from(tagSelect.options).forEach(option => option.selected = false);
                fetchDashboardStats();
            }
        });
    }

    if (addNewsUpdateForm) {
        addNewsUpdateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showFormMessage(addNewsUpdateMessage, '', '');

            const newNewsUpdate = {
                news_date: newsDateInput.value,
                title: newsTitleInput.value,
                summary: newsSummaryInput.value,
                full_article_link: fullArticleLinkInput.value || null
            };

            const { data, error } = await supabase
                .from('news_updates')
                .insert([newNewsUpdate]);

            if (error) {
                console.error('Error inserting news update:', error);
                showFormMessage(addNewsUpdateMessage, 'Error adding news update: ' + error.message, 'error');
            } else {
                showFormMessage(addNewsUpdateMessage, 'News update added successfully!', 'success');
                console.log('News update added:', data);
                newsDateInput.value = '';
                newsTitleInput.value = '';
                newsSummaryInput.value = '';
                fullArticleLinkInput.value = '';
                fetchDashboardStats();
            }
        });
    }

    // --- Lore Item Form Logic ---
    if (loreTitleInput && loreSlugInput && addLoreItemForm) {
        loreTitleInput.addEventListener('input', () => {
            loreSlugInput.value = slugify(loreTitleInput.value);
        });
    }

    if (addNewLoreCategoryButton && newLoreCategoryInput && loreCategorySelect) {
        addNewLoreCategoryButton.addEventListener('click', async () => {
            const newCategory = newLoreCategoryInput.value.trim();
            if (newCategory) {
                try {
                    const { data, error } = await supabase
                        .from('tag_list') // Assuming lore categories are also stored in tag_list
                        .insert([{ tag_name: newCategory }]);

                    if (error && error.code !== '23505') {
                        console.error('Error adding new lore category:', error.message);
                        showFormMessage(addLoreItemMessage, 'Error adding category: ' + error.message, 'error');
                    } else {
                        if (error && error.code === '23505') {
                            showFormMessage(addLoreItemMessage, `Category '${newCategory}' already exists.`, 'warning');
                        } else {
                            showFormMessage(addLoreItemMessage, `Category '${newCategory}' added successfully!`, 'success');
                        }
                        newLoreCategoryInput.value = '';
                        populateTagSelect(loreCategorySelect);
                        populateTagSelect(tagSelect);
                    }
                } catch (e) {
                    console.error('Unexpected error adding new lore category:', e);
                    showFormMessage(addLoreItemMessage, 'An unexpected error occurred while adding category.', 'error');
                }
            } else {
                showFormMessage(addLoreItemMessage, 'Please enter a category name.', 'warning');
            }
        });
    }

    if (addLoreItemForm) {
        addLoreItemForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showFormMessage(addLoreItemMessage, '', '');

            const newLoreItem = {
                title: loreTitleInput.value,
                slug: loreSlugInput.value,
                category: loreCategorySelect.value,
                content: loreContentInput.value
            };

            const { data, error } = await supabase
                .from('lore_items')
                .insert([newLoreItem]);

            if (error) {
                console.error('Error inserting lore item:', error);
                showFormMessage(addLoreItemMessage, 'Error adding lore item: ' + error.message, 'error');
            } else {
                showFormMessage(addLoreItemMessage, 'Lore item added successfully!', 'success');
                console.log('Lore item added:', data);
                loreTitleInput.value = '';
                loreSlugInput.value = '';
                loreCategorySelect.value = '';
                loreContentInput.value = '';
            }
        });
    }
});
