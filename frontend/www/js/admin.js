import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const discordLoginButton = document.getElementById('discordLoginButton');
    const loginError = document.getElementById('loginError');
    const loginFormContainer = document.getElementById('loginFormContainer');
    const loginHeading = document.getElementById('loginHeading');
    const adminDashboardAndForm = document.getElementById('adminDashboardAndForm');

    const commentInput = document.getElementById('commentInput');
    const parseButton = document.getElementById('parseButton');
    const devCommentForm = document.getElementById('devCommentForm');
    const parseError = document.getElementById('parseError');
    const formMessage = document.getElementById('formMessage');

    const authorField = document.getElementById('author');
    const sourceField = document.getElementById('source');
    const timestampField = document.getElementById('timestamp');
    const commentContentField = document.getElementById('commentContent');
    const tagSelect = document.getElementById('tagSelect');
    const newTagInput = document.getElementById('newTagInput');
    const addNewTagButton = document.getElementById('addNewTagButton');
    const editButton = document.getElementById('editButton');

    const totalCommentsCount = document.getElementById('totalCommentsCount');
    const totalNewsCount = document.getElementById('totalNewsCount');
    const commentsMonthCount = document.getElementById('commentsMonthCount');
    const newsMonthCount = document.getElementById('newsMonthCount');

    const addNewsUpdateForm = document.getElementById('addNewsUpdateForm');
    const newsDateInput = document.getElementById('news_date');
    const newsTitleInput = document.getElementById('news_title');
    const newsSummaryInput = document.getElementById('news_summary');
    const fullArticleLinkInput = document.getElementById('full_article_link');
    const addNewsUpdateMessage = document.getElementById('addNewsUpdateMessage');

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

    async function fetchTags() {
        const { data, error } = await supabase
            .from('tag_list')
            .select('tag_name')
            .order('tag_name', { ascending: true });

        if (error) {
            console.error('Error fetching tags:', error.message);
            return;
        }

        tagSelect.innerHTML = '<option value="">Select existing tags (Ctrl/Cmd+Click to select multiple)</option>';
        data.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.tag_name;
            option.textContent = tag.tag_name;
            tagSelect.appendChild(option);
        });
    }

    async function addNewTag() {
        const tagName = newTagInput.value.trim();
        if (!tagName) {
            showFormMessage(formMessage, 'Tag name cannot be empty.', 'error');
            return;
        }

        const { data, error } = await supabase
            .from('tag_list')
            .insert([{ tag_name: tagName }])
            .select();

        if (error) {
            if (error.code === '23505') {
                showFormMessage(formMessage, `Tag '${tagName}' already exists.`, 'error');
            } else {
                console.error('Error adding new tag:', error.message);
                showFormMessage(formMessage, 'Error adding tag: ' + error.message, 'error');
            }
        } else {
            showFormMessage(formMessage, `Tag '${tagName}' added successfully!`, 'success');
            newTagInput.value = '';
            await fetchTags();
            for (const option of tagSelect.options) {
                if (option.value === tagName) {
                    option.selected = true;
                    break;
                }
            }
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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

        const { count: commentsTotal, error: commentsTotalError } = await supabase
            .from('developer_comments')
            .select('*', { count: 'exact', head: true });

        const { count: newsTotal, error: newsTotalError } = await supabase
            .from('news_updates')
            .select('*', { count: 'exact', head: true });

        const { count: commentsThisMonth, error: commentsMonthError } = await supabase
            .from('developer_comments')
            .select('*', { count: 'exact', head: true })
            .gte('comment_date', startOfMonth)
            .lte('comment_date', endOfMonth);

        const { count: newsThisMonth, error: newsMonthError } = await supabase
            .from('news_updates')
            .select('*', { count: 'exact', head: true })
            .gte('news_date', startOfMonth)
            .lte('news_date', endOfMonth);

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

    async function checkAuth() {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const authorized = await isAuthorizedAdmin(user.id);

            if (authorized) {
                loginFormContainer.style.display = 'none';
                loginHeading.style.display = 'none';
                adminDashboardAndForm.style.display = 'block';
                fetchDashboardStats();
                fetchTags();
            } else {
                loginFormContainer.style.display = 'block';
                loginHeading.style.display = 'none';
                loginError.textContent = 'You are logged in but not authorized to add comments.';
                loginError.style.display = 'block';
                adminDashboardAndForm.style.display = 'none';
            }
        } else {
            loginFormContainer.style.display = 'block';
            loginHeading.style.display = 'block';
            adminDashboardAndForm.style.display = 'none';
            loginError.style.display = 'none';
        }
    }

    checkAuth();
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            checkAuth();
        }
    });

    discordLoginButton.addEventListener('click', async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: 'https://yesitsphoenix.github.io/Pax-Dei-Archives/admin.html'
            }
        });

        if (error) {
            console.error('Discord login error:', error);
            loginError.textContent = 'Login failed: ' + error.message;
            loginError.style.display = 'block';
        }
    });

    function parseComment(text) {
        // Updated regex to correctly capture source and timestamp
        const regex = /^(.*?)\s*\|\s*(.*?)\s*—\s*(.*?)\n([\s\S]*)$/;
        const match = text.match(regex);

        if (match) {
            try {
                const author = match[1].trim();
                let sourceAndTimestamp = match[2].trim() + ' — ' + match[3].trim(); // Reconstruct for robust parsing
                let content = match[4].trim();

                // Split source and timestamp more robustly
                const lastDashIndex = sourceAndTimestamp.lastIndexOf('—');
                let originalSource = sourceAndTimestamp.substring(0, lastDashIndex).trim();
                let timestampStr = sourceAndTimestamp.substring(lastDashIndex + 1).trim();

                // Handle URL at the end of the content
                const urlRegex = /(https?:\/\/[^\s]+)$/;
                const urlMatch = content.match(urlRegex);
                let finalSource = originalSource;
                if (urlMatch) {
                    const extractedUrl = urlMatch[1];
                    content = content.replace(urlRegex, '').trim();
                    // If original source was just "Discord", update it to the URL.
                    // Otherwise, prefer the URL from content if it's not already set.
                    if (originalSource === "Discord" || !finalSource) {
                        finalSource = extractedUrl;
                    } else if (extractedUrl) {
                        // If there's an original source and a URL in content, prefer the content URL
                        finalSource = extractedUrl;
                    }
                }
                
                let parsedDate = new Date();
                let timePart = timestampStr;

                // Handle "Yesterday at" and "Today at"
                if (timestampStr.toLowerCase().startsWith('yesterday at ')) {
                    parsedDate.setDate(parsedDate.getDate() - 1);
                    timePart = timestampStr.substring('yesterday at '.length);
                } else if (timestampStr.toLowerCase().startsWith('today at ')) {
                    timePart = timestampStr.substring('today at '.length);
                } else {
                    // Handle full dates like "05/26/2025 4:30 PM"
                    const dateMatch = timestampStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                    if (dateMatch) {
                        // Create date based on MM/DD/YYYY to avoid timezone issues when parsing
                        parsedDate = new Date(dateMatch[1] + ' ' + new Date().getFullYear()); // Append current year for robust parsing
                        // Re-evaluate the parsedDate after setting the full year if year was missing
                        if (parsedDate.getFullYear() !== parseInt(dateMatch[1].split('/')[2])) {
                            parsedDate = new Date(`${dateMatch[1].split('/')[0]}/${dateMatch[1].split('/')[1]}/${dateMatch[1].split('/')[2]}`);
                        }
                        timePart = timestampStr.replace(dateMatch[1], '').trim();
                    }
                }
                
                // Now, reliably parse the time part (e.g., "4:30 PM", "4:19 AM", "1:30")
                const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); // AM/PM is optional
                if (timeMatch) {
                    let hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

                    if (ampm === 'pm' && hours < 12) {
                        hours += 12;
                    }
                    if (ampm === 'am' && hours === 12) {
                        hours = 0;
                    }
                    // If no AM/PM, assume 24-hour format or current day's AM/PM context if applicable
                    // For simplicity, we'll assume 24-hour if no AM/PM, or handle based on typical Discord timestamps (which often include AM/PM)
                    
                    parsedDate.setHours(hours, minutes, 0, 0);
                } else {
                    // Fallback for cases where time part might be missing or in an unexpected format
                    console.warn("Could not parse time part:", timePart);
                    // You might want to default to 00:00 or current time here
                    parsedDate.setHours(0, 0, 0, 0); 
                }

                // Format for the datetime-local input field
                const year = parsedDate.getFullYear();
                const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                const day = parsedDate.getDate().toString().padStart(2, '0');
                const hours = parsedDate.getHours().toString().padStart(2, '0');
                const minutes = parsedDate.getMinutes().toString().padStart(2, '0');
                const formattedTimestamp = `${year}-${month}-${day}T${hours}:${minutes}`;

                return { author, source: finalSource, timestamp: formattedTimestamp, content };

            } catch (e) {
                console.error("Error during parsing or timestamp conversion:", e);
                return null;
            }
        }
        return null;
    }

    parseButton.addEventListener('click', () => {
        showFormMessage(formMessage, '', '');
        const inputText = commentInput.value;
        const parsedData = parseComment(inputText);

        if (parsedData) {
            authorField.value = parsedData.author;
            sourceField.value = parsedData.source;
            timestampField.value = parsedData.timestamp;
            commentContentField.value = parsedData.content;
            Array.from(tagSelect.options).forEach(option => option.selected = false);

            devCommentForm.style.display = 'block';
            commentInput.style.display = 'none';
            parseButton.style.display = 'none';
            parseError.style.display = 'none';
        } else {
            parseError.textContent = 'Could not parse the input. Please ensure it matches the format: Author | Source — Timestamp\nContent [Optional URL at end]';
            parseError.style.display = 'block';
            devCommentForm.style.display = 'none';
            commentInput.style.display = 'block';
            parseButton.style.display = 'block';
        }
    });

    editButton.addEventListener('click', () => {
        showFormMessage(formMessage, '', '');
        devCommentForm.style.display = 'none';
        commentInput.style.display = 'block';
        parseButton.style.display = 'block';
        parseError.style.display = 'none';
    });

    addNewTagButton.addEventListener('click', addNewTag);

    devCommentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showFormMessage(formMessage, '', '');

        const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);

        if (selectedTags.length === 0) {
            showFormMessage(formMessage, 'Please select at least one tag.', 'error');
            return;
        }

        const newComment = {
            author: authorField.value,
            source: sourceField.value,
            comment_date: new Date(timestampField.value).toISOString(),
            content: commentContentField.value,
            title: commentContentField.value.substring(0, 45) + (commentContentField.value.length > 45 ? '...' : ''),
            tag: selectedTags
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
            authorField.value = '';
            sourceField.value = '';
            timestampField.value = '';
            commentContentField.value = '';
            Array.from(tagSelect.options).forEach(option => option.selected = false);
            newTagInput.value = '';
            devCommentForm.style.display = 'none';
            commentInput.style.display = 'block';
            parseButton.style.display = 'block';
            parseError.style.display = 'none';
            fetchDashboardStats();
            fetchTags();
        }
    });

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
});