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
    // New regex to match: Author — Timestamp Content [Optional URL at end]
    // It captures: (Author) — (Timestamp) (Content before URL) (Optional URL)
    const regex = /^(.*?)—\s*(.*?)\s*([\s\S]*?)(https?:\/\/[^\s]+)?$/;
    const match = text.match(regex);

    if (match) {
        try {
            const author = match[1].trim();
            const timestampStr = match[2].trim();
            let contentAndOptionalUrl = match[3] ? match[3].trim() : ''; // Get content and potential URL
            const url = match[4] ? match[4].trim() : ''; // Directly capture the URL if it exists

            let content = contentAndOptionalUrl;
            // If a URL was captured by the regex, ensure it's removed from the content string if it was part of it
            if (url && content.endsWith(url)) {
                content = content.substring(0, content.length - url.length).trim();
            }
            
            // The 'source' property will now directly be the URL if present, otherwise empty
            let finalSource = url;

            let parsedDate = new Date(); // Initialize with current date
            let timePart = timestampStr;

            // Handle "Yesterday at" and "Today at"
            if (timestampStr.toLowerCase().startsWith('yesterday at ')) {
                parsedDate.setDate(parsedDate.getDate() - 1);
                timePart = timestampStr.substring('yesterday at '.length);
            } else if (timestampStr.toLowerCase().startsWith('today at ')) {
                timePart = timestampStr.substring('today at '.length);
            } else {
                // Handle full dates like "05/26/2025, 4:30 PM" or "5/26/25, 11:05 AM"
                const dateMatch = timestampStr.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
                if (dateMatch) {
                    // Create date from "MM/DD/YYYY" or "MM/DD/YY" format
                    let dateParts = dateMatch[1].split('/');
                    let year = parseInt(dateParts[2]);
                    // Handle 2-digit year (e.g., 25 for 2025)
                    if (year < 100) {
                        year += (year > (parsedDate.getFullYear() % 100)) ? 1900 : 2000;
                    }
                    parsedDate = new Date(year, parseInt(dateParts[0]) - 1, parseInt(dateParts[1]));
                    timePart = timestampStr.replace(dateMatch[1], '').replace(/^,\s*/, '').trim();
                }
            }
            
            // Now, parse the time part (e.g., "4:30 PM" or "11:05 AM")
            const timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toLowerCase();

                if (ampm === 'pm' && hours < 12) {
                    hours += 12;
                }
                if (ampm === 'am' && hours === 12) {
                    hours = 0;
                }
                
                parsedDate.setHours(hours, minutes, 0, 0);
            } else {
                 // If no time part, try to set to a default for the given date, or flag an error
                 // For now, let's assume valid time part or set to 00:00
                 parsedDate.setHours(0, 0, 0, 0); // Default to start of day if time isn't found
            }

            // Format for the datetime-local input field (YYYY-MM-DDTHH:MM)
            const year = parsedDate.getFullYear();
            const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
            const day = parsedDate.getDate().toString().padStart(2, '0');
            const hours = parsedDate.getHours().toString().padStart(2, '0');
            const minutes = parsedDate.getMinutes().toString().padStart(2, '0');
            const formattedTimestamp = `${year}-${month}-${day}T${hours}:${minutes}`;

            return { author, source: finalSource, timestamp: formattedTimestamp, content };

        } catch (e) {
            console.error("Timestamp parsing error:", e);
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