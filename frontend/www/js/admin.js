// frontend/www/js/admin.js

import { supabase } from './supabaseClient.js';
import { authorRoleColors } from './utils.js'; // Assuming utils.js provides authorRoleColors

// Get references to Admin page specific elements
const loginFormContainer = document.getElementById('loginFormContainer');
const discordLoginButton = document.getElementById('discordLoginButton');
const loginError = document.getElementById('loginError');
const adminDashboardAndForm = document.getElementById('adminDashboardAndForm');

// Dashboard statistics elements (added null checks)
const totalCommentsCount = document.getElementById('totalCommentsCount');
const totalNewsCount = document.getElementById('totalNewsCount');
const commentsMonthCount = document.getElementById('commentsMonthCount');
const newsMonthCount = document.getElementById('newsMonthCount');

// Form elements
const authorTypeDropdown = document.getElementById('author_type');
const formMessage = document.getElementById('formMessage');
const devCommentForm = document.getElementById('devCommentForm');
const tagSelect = document.getElementById('tagSelect');
const addNewsUpdateForm = document.getElementById('addNewsUpdateForm');
const addNewsUpdateMessage = document.getElementById('addNewsUpdateMessage');
const addLoreItemForm = document.getElementById('addLoreItemForm');
const addLoreItemMessage = document.getElementById('addLoreItemMessage');


// Cache for dashboard stats to prevent excessive fetches
let dashboardStatsCache = null;
let lastStatsFetchTime = 0;
const STATS_CACHE_DURATION = 60 * 5000; // Cache for 5 minutes (in ms)

// Helper function to show/hide form messages
function showFormMessage(messageElement, message, type) {
    if (!messageElement) {
        console.warn("Message element not found for displaying message:", message);
        return;
    }
    messageElement.textContent = message;
    messageElement.className = ''; // Reset classes
    if (type) {
        messageElement.classList.add('form-message', type);
        messageElement.style.display = 'block';

        if (message) {
            setTimeout(() => {
                if (messageElement) { // Check again before manipulating after timeout
                    messageElement.style.display = 'none';
                    messageElement.textContent = '';
                }
            }, 5000); // Hide after 5 seconds
        }
    } else {
        messageElement.style.display = 'none';
        messageElement.textContent = '';
    }
}

// Populate Author Type Dropdown
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

// --- Dashboard Functions ---
async function fetchDashboardData() {
    // Use cache if available and not expired
    const now = Date.now();
    if (dashboardStatsCache && (now - lastStatsFetchTime < STATS_CACHE_DURATION)) {
        console.log("Using cached dashboard stats.");
        updateDashboardUI(dashboardStatsCache);
        return;
    }

    try {
        // Fetch total dev comments
        const { count: totalComments, error: commentsError } = await supabase
            .from('developer_comments')
            .select('*', { count: 'exact', head: true });

        // Fetch total news updates
        const { count: totalNews, error: newsError } = await supabase
            .from('news_updates')
            .select('*', { count: 'exact', head: true });

        // Fetch comments this month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { count: commentsMonth, error: commentsMonthError } = await supabase
            .from('developer_comments')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', startOfMonth);

        // Fetch news this month
        const { count: newsMonth, error: newsMonthError } = await supabase
            .from('news_updates')
            .select('*', { count: 'exact', head: true })
            .gte('news_date', startOfMonth);

        if (commentsError || newsError || commentsMonthError || newsMonthError) {
            throw new Error(commentsError?.message || newsError?.message || commentsMonthError?.message || newsMonthError?.message);
        }

        const stats = {
            totalComments: totalComments || 0,
            totalNews: totalNews || 0,
            commentsMonth: commentsMonth || 0,
            newsMonth: newsMonth || 0
        };

        dashboardStatsCache = stats;
        lastStatsFetchTime = now;
        updateDashboardUI(stats);

    } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
        // Optionally display an error message to the user
    }
}

function updateDashboardUI(stats) {
    if (totalCommentsCount) totalCommentsCount.textContent = stats.totalComments;
    if (totalNewsCount) totalNewsCount.textContent = stats.totalNews;
    if (commentsMonthCount) commentsMonthCount.textContent = stats.commentsMonth;
    if (newsMonthCount) newsMonthCount.textContent = stats.newsMonth;
}


// --- Comment Form Functions ---
if (devCommentForm) {
    devCommentForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        showFormMessage(formMessage, '', null); // Clear previous message

        const author = document.getElementById('author')?.value;
        const source = document.getElementById('source')?.value;
        const timestamp = document.getElementById('timestamp')?.value;
        const content = document.getElementById('commentContent')?.value;
        const selectedTags = Array.from(tagSelect?.selectedOptions || []).map(option => option.value);
        const author_type = authorTypeDropdown ? authorTypeDropdown.value : '';

        // Input validation
        if (!author || !source || !timestamp || !content || !author_type || selectedTags.length === 0) {
            showFormMessage(formMessage, 'Please fill in all fields and select at least one tag.', 'error');
            return;
        }

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

        const commentData = {
            author: author,
            source: source,
            timestamp: utcTimestamp,
            content: content,
            tags: selectedTags, // Store as array
            author_type: author_type
        };

        const { error } = await supabase.from('developer_comments').insert([commentData]);

        if (error) {
            console.error('Error adding developer comment:', error.message);
            showFormMessage(formMessage, 'Error adding comment: ' + error.message, 'error');
        } else {
            showFormMessage(formMessage, 'Developer comment added successfully!', 'success');
            if (devCommentForm) devCommentForm.reset(); // Reset the form only on success
            // Optionally clear the textareas for markdown and content
            document.getElementById('commentInput').value = '';
            document.getElementById('commentContent').value = '';
            document.getElementById('devCommentForm').style.display = 'none'; // Hide parsed form
            await fetchDashboardData(); // Refresh dashboard stats
        }

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Comment to DB';
        }
    });
}

// Function to parse comment input (assuming it uses Marked and DOMPurify)
const parseCommentInput = () => {
    const commentInput = document.getElementById('commentInput');
    const parseError = document.getElementById('parseError');
    const devCommentForm = document.getElementById('devCommentForm');
    const authorInput = document.getElementById('author');
    const sourceInput = document.getElementById('source');
    const timestampInput = document.getElementById('timestamp');
    const commentContentInput = document.getElementById('commentContent');

    if (!commentInput || !parseError || !devCommentForm || !authorInput || !sourceInput || !timestampInput || !commentContentInput) {
        console.error("One or more comment parsing elements not found.");
        return;
    }

    const input = commentInput.value;
    parseError.style.display = 'none';

    try {
        const authorMatch = input.match(/Author:\s*(.*)/);
        const sourceMatch = input.match(/Source:\s*(.*)/);
        const timestampMatch = input.match(/Timestamp:\s*(.*)/);
        const contentMatch = input.match(/```markdown\s*([\s\S]*?)\s*```/);

        if (!authorMatch || !sourceMatch || !timestampMatch || !contentMatch) {
            parseError.textContent = 'Failed to parse. Ensure format: Author:, Source:, Timestamp:, and markdown block.';
            parseError.style.display = 'block';
            devCommentForm.style.display = 'none';
            return;
        }

        authorInput.value = authorMatch[1].trim();
        sourceInput.value = sourceMatch[1].trim();
        
        // Convert timestamp to local datetime format for datetime-local input
        const isoTimestamp = new Date(timestampMatch[1].trim()).toISOString().slice(0, 16);
        timestampInput.value = isoTimestamp;

        commentContentInput.value = DOMPurify.sanitize(marked.parse(contentMatch[1].trim()));
        
        devCommentForm.style.display = 'block';
    } catch (e) {
        parseError.textContent = 'An error occurred during parsing: ' + e.message;
        parseError.style.display = 'block';
        devCommentForm.style.display = 'none';
    }
};

// Add listener for parse button
document.getElementById('parseButton')?.addEventListener('click', parseCommentInput);

// Add listener for edit raw button
document.getElementById('editButton')?.addEventListener('click', () => {
    const commentInput = document.getElementById('commentInput');
    const devCommentForm = document.getElementById('devCommentForm');
    if (commentInput && devCommentForm) {
        devCommentForm.style.display = 'none';
        commentInput.focus();
    }
});


// --- Tag Management Functions ---
async function populateTagSelect() {
    if (!tagSelect) {
        console.warn("Tag select element not found.");
        return;
    }
    const { data, error } = await supabase
        .from('tags')
        .select('tag_id, tag_name')
        .order('tag_name', { ascending: true });

    if (error) {
        console.error('Error fetching tags:', error.message);
        return;
    }

    tagSelect.innerHTML = '<option value="">Select one or more tags</option>'; // Clear existing
    data.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.tag_id;
        option.textContent = tag.tag_name;
        tagSelect.appendChild(option);
    });
}

document.getElementById('addNewTagButton')?.addEventListener('click', async () => {
    const newTagInput = document.getElementById('newTagInput');
    if (!newTagInput || !tagSelect) {
        console.warn("New tag input or select element not found.");
        return;
    }
    const newTagName = newTagInput.value.trim();

    if (newTagName) {
        const { error } = await supabase.from('tags').insert([{ tag_name: newTagName }]);
        if (error) {
            console.error('Error adding new tag:', error.message);
            showFormMessage(formMessage, 'Failed to add new tag: ' + error.message, 'error');
        } else {
            showFormMessage(formMessage, 'New tag added!', 'success');
            newTagInput.value = '';
            await populateTagSelect(); // Re-populate dropdown with new tag
        }
    } else {
        showFormMessage(formMessage, 'Please enter a tag name.', 'error');
    }
});

// --- News Update Form Functions ---
if (addNewsUpdateForm) {
    addNewsUpdateForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        showFormMessage(addNewsUpdateMessage, '', null); // Clear previous message

        const news_date = document.getElementById('news_date')?.value;
        const news_title = document.getElementById('news_title')?.value;
        const news_summary = document.getElementById('news_summary')?.value;
        const full_article_link = document.getElementById('full_article_link')?.value;

        if (!news_date || !news_title || !news_summary) {
            showFormMessage(addNewsUpdateMessage, 'Please fill in all required news update fields.', 'error');
            return;
        }

        const submitButton = addNewsUpdateForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';
        }

        const { error } = await supabase.from('news_updates').insert([
            {
                news_date: news_date, // Already in YYYY-MM-DD format
                title: news_title,
                summary: news_summary,
                full_article_link: full_article_link || null
            }
        ]);

        if (error) {
            console.error('Error adding news update:', error.message);
            showFormMessage(addNewsUpdateMessage, 'Error adding news update: ' + error.message, 'error');
        } else {
            showFormMessage(addNewsUpdateMessage, 'News update added successfully!', 'success');
            if (addNewsUpdateForm) addNewsUpdateForm.reset();
            await fetchDashboardData(); // Refresh dashboard stats
        }

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add News Update';
        }
    });
}

// --- Lore Item Form Functions ---
if (addLoreItemForm) {
    // Auto-generate slug from title
    document.getElementById('loreTitle')?.addEventListener('input', function() {
        const loreSlugInput = document.getElementById('loreSlug');
        if (loreSlugInput) {
            loreSlugInput.value = this.value.toLowerCase()
                .replace(/[^a-z0-9 -]/g, '') // Remove invalid chars
                .replace(/\s+/g, '-')       // Replace spaces with -
                .replace(/-+/g, '-');       // Collapse repeated dashes
        }
    });

    addLoreItemForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        showFormMessage(addLoreItemMessage, '', null); // Clear previous message

        const loreTitle = document.getElementById('loreTitle')?.value;
        const loreSlug = document.getElementById('loreSlug')?.value;
        const loreCategory = document.getElementById('loreCategory')?.value;
        const loreContent = document.getElementById('loreContent')?.value;

        if (!loreTitle || !loreSlug || !loreCategory || !loreContent) {
            showFormMessage(addLoreItemMessage, 'Please fill in all required lore item fields.', 'error');
            return;
        }

        const submitButton = addLoreItemForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Adding...';
        }

        const { error } = await supabase.from('lore_items').insert([
            {
                title: loreTitle,
                slug: loreSlug,
                category_id: loreCategory, // category_id should match the foreign key in Supabase
                content_markdown: loreContent // Store raw markdown
            }
        ]);

        if (error) {
            console.error('Error adding lore item:', error.message);
            showFormMessage(addLoreItemMessage, 'Error adding lore item: ' + error.message, 'error');
        } else {
            showFormMessage(addLoreItemMessage, 'Lore item added successfully!', 'success');
            if (addLoreItemForm) addLoreItemForm.reset();
        }

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Lore Item';
        }
    });
}

// --- Lore Category Management Functions ---
async function populateLoreCategorySelect() {
    const loreCategorySelect = document.getElementById('loreCategory');
    if (!loreCategorySelect) {
        console.warn("Lore category select element not found.");
        return;
    }
    const { data, error } = await supabase
        .from('lore_categories')
        .select('category_id, category_name')
        .order('category_name', { ascending: true });

    if (error) {
        console.error('Error fetching lore categories:', error.message);
        return;
    }

    loreCategorySelect.innerHTML = '<option value="">Select a category</option>'; // Clear existing
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        loreCategorySelect.appendChild(option);
    });
}

document.getElementById('addNewLoreCategoryButton')?.addEventListener('click', async () => {
    const newLoreCategoryInput = document.getElementById('newLoreCategoryInput');
    const loreCategorySelect = document.getElementById('loreCategory');
    if (!newLoreCategoryInput || !loreCategorySelect) {
        console.warn("New lore category input or select element not found.");
        return;
    }
    const newCategoryName = newLoreCategoryInput.value.trim();

    if (newCategoryName) {
        const { error } = await supabase.from('lore_categories').insert([{ category_name: newCategoryName }]);
        if (error) {
            console.error('Error adding new lore category:', error.message);
            showFormMessage(addLoreItemMessage, 'Failed to add new lore category: ' + error.message, 'error');
        } else {
            showFormMessage(addLoreItemMessage, 'New lore category added!', 'success');
            newLoreCategoryInput.value = '';
            await populateLoreCategorySelect(); // Re-populate dropdown with new category
        }
    } else {
        showFormMessage(addLoreItemMessage, 'Please enter a category name.', 'error');
    }
});


// --- Core Authentication Logic for Admin Page ---

// Admin login button event listener
if (discordLoginButton) {
    discordLoginButton.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + window.location.pathname // Redirects back to admin.html
                }
            });
            if (error) {
                console.error('Discord login error:', error);
                if (loginError) {
                    loginError.textContent = 'Login failed: ' + error.message;
                    loginError.style.display = 'block';
                }
            }
        } catch (e) {
            console.error('Login initiation failed:', e);
            if (loginError) {
                loginError.textContent = 'An unexpected error occurred during login initiation.';
                loginError.style.display = 'block';
            }
        }
    });
}

async function loadAdminPageData() {
    // Hide all forms/dashboard initially
    if (loginFormContainer) loginFormContainer.style.display = 'none';
    if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
    if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        console.log("User found:", user.id);
        // Check if user is an admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles') // Assuming you have a 'profiles' table with 'id' and 'role'
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') { // Adjust role check as needed
            console.warn("User is not an admin or profile not found:", user.id, profileError?.message);
            if (loginFormContainer) loginFormContainer.style.display = 'block';
            if (loginError) {
                loginError.textContent = "You are logged in, but you don't have administrative privileges to access this page.";
                loginError.style.display = 'block';
            }
            // Optionally redirect
            // window.location.href = 'index.html';
            return;
        }

        // User is authenticated and is an admin
        console.log("Admin user authenticated. Loading dashboard...");
        if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'block';

        // Load admin dashboard data and populate forms
        await fetchDashboardData();
        await populateTagSelect();
        await populateLoreCategorySelect();

    } else {
        console.log("User not authenticated on Admin page. Showing login.");
        if (loginFormContainer) loginFormContainer.style.display = 'block';
        if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'none';
    }
}

// Listen for auth state changes across the app
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session);
    // This listener will trigger on initial load and whenever auth state changes (login, logout, refresh)
    await loadAdminPageData();
});

// Initial load for the admin page
// The onAuthStateChange listener above will handle the initial load, so we don't need a separate DOMContentLoaded here.
