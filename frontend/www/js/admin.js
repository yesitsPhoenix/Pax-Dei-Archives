// admin.js
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

    // Dev Comment Parser elements
    const commentInput = document.getElementById('commentInput');
    const parseButton = document.getElementById('parseButton');
    const devCommentForm = document.getElementById('devCommentForm');
    const parseError = document.getElementById('parseError');
    const formMessage = document.getElementById('formMessage');

    // Dev Comment Form fields (from the parsed content)
    const authorField = document.getElementById('author');
    const sourceField = document.getElementById('source');
    const timestampField = document.getElementById('timestamp');
    const commentContentField = document.getElementById('commentContent');
    const editButton = document.getElementById('editButton');

    // Dashboard elements
    const totalCommentsCount = document.getElementById('totalCommentsCount');
    const totalNewsCount = document.getElementById('totalNewsCount');
    const commentsMonthCount = document.getElementById('commentsMonthCount');
    const newsMonthCount = document.getElementById('newsMonthCount');

    // News Update Form elements
    const addNewsUpdateForm = document.getElementById('addNewsUpdateForm');
    const newsDateInput = document.getElementById('news_date');
    const newsTitleInput = document.getElementById('news_title');
    const newsSummaryInput = document.getElementById('news_summary');
    const fullArticleLinkInput = document.getElementById('full_article_link');
    const addNewsUpdateMessage = document.getElementById('addNewsUpdateMessage');

    // Helper function to show messages
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
    const regex = /^(.*?)—\s*([\s\S]*?)(https?:\/\/[^\s]+)?$/;
    const match = text.match(regex);

    if (match) {
        try {
            const author = match[1].trim();
            let rawContentWithTimestamp = match[2].trim();
            const url = match[3] ? match[3].trim() : '';

            const finalSource = url;


            const timestampPattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
            let timestampMatch = rawContentWithTimestamp.match(timestampPattern);

            let timestampStr = '';
            let content = '';
            let parsedDate = new Date();

            if (timestampMatch) {
                const datePart = timestampMatch[1]; // e.g., "5/26/25"
                const timePart = timestampMatch[2]; // e.g., "11:05 AM"
                content = timestampMatch[3].trim(); // Rest is the actual content

                // Parse the date part
                let [month, day, year] = datePart.split('/').map(Number);

                if (year < 100) { // Handle 2-digit years
                    year += (year > 50) ? 1900 : 2000;
                }
                parsedDate.setFullYear(year, month - 1, day); // Month is 0-indexed

                // Parse the time part
                const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
                const timeMatchResult = timePart.match(timeRegex);

                if (timeMatchResult) {
                    let hours = parseInt(timeMatchResult[1]);
                    const minutes = parseInt(timeMatchResult[2]);
                    const ampm = timeMatchResult[3].toLowerCase();

                    if (ampm === 'pm' && hours < 12) {
                        hours += 12;
                    }
                    if (ampm === 'am' && hours === 12) {
                        hours = 0;
                    }
                    parsedDate.setHours(hours, minutes, 0, 0);
                } else {
                    // Default to start of day if time parsing fails
                    parsedDate.setHours(0, 0, 0, 0);
                }
            } else {
                // Handle "Yesterday at" and "Today at" as fallback if full date not found
                if (rawContentWithTimestamp.toLowerCase().startsWith('yesterday at ')) {
                    parsedDate.setDate(parsedDate.getDate() - 1);
                    const timePart = rawContentWithTimestamp.substring('yesterday at '.length).trim();
                    const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
                    const timeMatchResult = timePart.match(timeRegex);
                    if (timeMatchResult) {
                        let hours = parseInt(timeMatchResult[1]);
                        const minutes = parseInt(timeMatchResult[2]);
                        const ampm = timeMatchResult[3].toLowerCase();
                        if (ampm === 'pm' && hours < 12) { hours += 12; }
                        if (ampm === 'am' && hours === 12) { hours = 0; }
                        parsedDate.setHours(hours, minutes, 0, 0);
                        content = ''; // No content if only 'Yesterday at X' is matched
                    } else {
                        parsedDate.setHours(0,0,0,0);
                        content = rawContentWithTimestamp; // Treat whole thing as content if no time found
                    }
                } else if (rawContentWithTimestamp.toLowerCase().startsWith('today at ')) {
                    const timePart = rawContentWithTimestamp.substring('today at '.length).trim();
                    const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i;
                    const timeMatchResult = timePart.match(timeRegex);
                    if (timeMatchResult) {
                        let hours = parseInt(timeMatchResult[1]);
                        const minutes = parseInt(timeMatchResult[2]);
                        const ampm = timeMatchResult[3].toLowerCase();
                        if (ampm === 'pm' && hours < 12) { hours += 12; }
                        if (ampm === 'am' && hours === 12) { hours = 0; }
                        parsedDate.setHours(hours, minutes, 0, 0);
                        content = ''; // No content if only 'Today at X' is matched
                    } else {
                        parsedDate.setHours(0,0,0,0);
                        content = rawContentWithTimestamp; // Treat whole thing as content if no time found
                    }
                } else {
                     // If no specific timestamp format matched, assume the whole rawContentWithTimestamp is content
                    content = rawContentWithTimestamp;
                    // Default timestamp to current date/time or throw error depending on strictness
                    parsedDate = new Date(); // Or set to a default if parsing failed
                    console.warn("Timestamp format not fully recognized at the beginning of the string:", rawContentWithTimestamp);
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
            console.error("Error during timestamp parsing:", e);
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

    devCommentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        showFormMessage(formMessage, '', '');

        const newComment = {
            author: authorField.value,
            source: sourceField.value,
            comment_date: new Date(timestampField.value).toISOString(),
            content: commentContentField.value,
            title: commentContentField.value.substring(0, 45) + (commentContentField.value.length > 45 ? '...' : '')
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
            fetchDashboardStats();
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