// This script combines functionalities from main.js, admin.js, and developerCommentsFilters.js
// It handles Supabase interactions, UI rendering, search, admin-specific tasks, and comment filtering.

// Supabase Client Initialization
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- General Helper Functions (from main.js) ---

/**
 * Formats a date string into a localized date and time string.
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date and time string, or an empty string if input is invalid.
 */
function formatCommentDateTime(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString(undefined, options);
  } catch (e) {
    console.error('Error formatting comment date time:', dateString, e);
    return '';
  }
}

/**
 * Formats a date string into a localized date string (without time).
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date string, or an empty string if input is invalid.
 */
function formatNewsDate(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  if (!dateString) return '';
  try {
    // Append 'T00:00:00' to ensure it's parsed as a local date for consistent behavior
    // especially if the input dateString is just 'YYYY-MM-DD'.
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
  } catch (e) {
    console.error('Error formatting news date:', dateString, e);
    return '';
  }
}

/**
 * Fetches and renders developer comments from Supabase.
 * Can filter by limit and search term.
 * @param {string} containerId - The ID of the HTML element to render comments into.
 * @param {number} [limit=null] - The maximum number of comments to fetch.
 * @param {string} [searchTerm=null] - A term to search for in title, content, or author.
 * @returns {Promise<Array>} A promise that resolves to an array of fetched comments.
 */
async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    // If no container and no search term (meaning it's not a search-only call), exit.
    if (!container && !searchTerm) return [];

    // Show loading indicator only if rendering to a container and not performing a search.
    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
    }

    try {
        let query = supabase
            .from('developer_comments')
            .select('*');

        // Apply search term if provided. Corrected ilike syntax.
        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
        }

        query = query.order('comment_date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching developer comments:', error.message);
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
            }
            return [];
        }

        if (data.length === 0 && !searchTerm && container) {
            container.innerHTML = '<div class="no-content-message">No developer comments found.</div>';
            return [];
        }

        // Render comments only if a container is provided (not for search-only calls)
        if (!searchTerm && container) {
            container.innerHTML = ''; // Clear existing content
            data.forEach(comment => {
                let sourceDisplay = '';
                const urlPattern = /^(https?:\/\/[^\s]+)$/i;

                if (comment.source && urlPattern.test(comment.source)) {
                    sourceDisplay = `
                        <a href="${comment.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
                            <i class="fas fa-external-link-alt"></i> Source
                        </a>
                    `;
                } else if (comment.source) {
                    sourceDisplay = comment.source;
                }

                let formattedDateForData = '';
                if (comment.comment_date) {
                    try {
                        const dateObj = new Date(comment.comment_date);
                        // Extract ISO, MM, DD ensuring two digits for month/day
                        const year = dateObj.getFullYear();
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        formattedDateForData = `${year}-${month}-${day}`;
                    } catch (e) {
                        console.warn('Could not parse comment_date for data attribute:', comment.comment_date, e);
                    }
                }

                const commentHtml = `
                    <div class="${containerId === 'recent-comments-home' ? 'col-lg-6 col-md-6' : 'col-lg-12'} mb-4 dev-comment-item"
                         data-author="${comment.author || ''}"
                         data-tag="${comment.tag ? (Array.isArray(comment.tag) ? comment.tag.join(',') : comment.tag) : ''}"
                         data-date="${formattedDateForData}">
                        <div class="${containerId === 'recent-comments-home' ? 'item' : 'comment-full-item'}">
                            <div class="down-content">
                                <h6>${comment.author} <span class="date">${formatCommentDateTime(comment.comment_date)}</span></h6>
                                <h4>${comment.title}</h4>
                                <p>${comment.content}</p>
                                ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', commentHtml);
            });
        }
        return data; // Return data for search functionality
    } catch (error) {
        console.error('Unexpected error in fetchAndRenderDeveloperComments:', error);
        if (!searchTerm && container) {
            container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
        }
        return [];
    }
}

/**
 * Fetches and renders news updates from Supabase.
 * Can filter by limit and search term.
 * @param {string} containerId - The ID of the HTML element to render news into.
 * @param {number} [limit=null] - The maximum number of news items to fetch.
 * @param {string} [searchTerm=null] - A term to search for in title, summary, or link.
 * @returns {Promise<Array>} A promise that resolves to an array of fetched news items.
 */
async function fetchAndRenderNewsUpdates(containerId, limit = null, searchTerm = null) {
    const container = document.getElementById(containerId);
    // If no container and no search term, exit.
    if (!container && !searchTerm) return [];

    // Show loading indicator only if rendering to a container and not performing a search.
    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading news...</div>';
    }

    try {
        let query = supabase
            .from('news_updates')
            .select('*');

        // Apply search term if provided. Corrected ilike syntax.
        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,full_article_link.ilike.%${searchTerm}%`);
        }

        query = query.order('news_date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching news updates:', error.message);
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">Failed to load news. Please try again later.</div>';
            }
            return [];
        }

        if (data.length === 0 && !searchTerm && container) {
            container.innerHTML = '<div class="no-content-message">No news updates found.</div>';
            return [];
        }

        // Render news only if a container is provided (not for search-only calls)
        if (!searchTerm && container) {
            container.innerHTML = ''; // Clear existing content
            data.forEach(newsItem => {
                const newsHtml = `
                    <div class="${containerId === 'news-updates-home' ? 'col-lg-4 col-md-6' : 'col-lg-12'}">
                        <div class="news-item">
                            <h6>${newsItem.title}</h6>
                            <span>${formatNewsDate(newsItem.news_date)}</span>
                            <p>${newsItem.summary}</p>
                            ${newsItem.full_article_link ? `<div class="main-button"><a href="${newsItem.full_article_link}" target="_blank">Read More</a></div>` : ''}
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', newsHtml);
            });
        }
        return data; // Return data for search functionality
    } catch (error) {
        console.error('Unexpected error in fetchAndRenderNewsUpdates:', error);
        if (!searchTerm && container) {
            container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
        }
        return [];
    }
}

/**
 * Performs a search across developer comments and news updates.
 * @param {string} searchTerm - The term to search for.
 */
async function performSearch(searchTerm) {
    const searchResultsDropdown = $('#searchResultsDropdown');
    searchResultsDropdown.html('<div class="search-loading-indicator">Searching...</div>');
    searchResultsDropdown.addClass('active');

    try {
        const [comments, newsUpdates] = await Promise.all([
            fetchAndRenderDeveloperComments(null, null, searchTerm), // Pass null for containerId as we just want data
            fetchAndRenderNewsUpdates(null, null, searchTerm) // Pass null for containerId as we just want data
        ]);

        const allResults = [];

        comments.forEach(comment => {
            allResults.push({
                type: 'Developer Comment',
                title: comment.title,
                content: comment.content,
                date: comment.comment_date,
                author: comment.author,
                source: comment.source,
                link: null // Developer comments don't have a direct 'read more' link
            });
        });

        newsUpdates.forEach(newsItem => {
            allResults.push({
                type: 'News Update',
                title: newsItem.title,
                content: newsItem.summary,
                date: newsItem.news_date,
                author: null, // News updates don't have an author in this context
                source: newsItem.full_article_link,
                link: newsItem.full_article_link
            });
        });

        // Sort all results by date in descending order
        allResults.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allResults.length === 0) {
            searchResultsDropdown.html('<div class="no-results-message">No results found for your search.</div>');
        } else {
            searchResultsDropdown.empty(); // Clear previous results
            allResults.forEach(item => {
                let sourceDisplay = '';
                if (item.source) {
                    const urlPattern = /^(https?:\/\/[^\s]+)$/i;
                    if (urlPattern.test(item.source)) {
                        sourceDisplay = `
                            <a href="${item.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
                                <i class="fas fa-external-link-alt"></i> Source
                            </a>
                        `;
                    } else {
                        sourceDisplay = `<span class="comment-source">Source: ${item.source}</span>`;
                    }
                }

                const formattedDateForDisplay = item.type === 'Developer Comment'
                                            ? formatCommentDateTime(item.date)
                                            : formatNewsDate(item.date);

                const resultHtml = `
                    <div class="search-result-item ${item.type === 'Developer Comment' ? 'comment-item' : 'news-item'}">
                        <div class="down-content">
                            <h6>${item.type === 'Developer Comment' ? item.author + ' - ' : ''}${item.title} <span class="date">${formattedDateForDisplay}</span></h6>
                            <p>${item.content}</p>
                            ${sourceDisplay ? sourceDisplay : ''}
                            ${item.link && item.type === 'News Update' ? `<div class="main-button"><a href="${item.link}" target="_blank">Read More</a></div>` : ''}
                        </div>
                    </div>
                `;
                searchResultsDropdown.append(resultHtml);
            });
        }

    } catch (error) {
        console.error('Error during search:', error);
        searchResultsDropdown.html('<div class="search-error-message">An error occurred during search. Please try again.</div>');
    }
}

// --- Admin Helper Functions (from admin.js) ---

// Helper function to show messages for forms
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

/**
 * Checks if the current user is an authorized admin.
 * @param {string} userId - The ID of the user to check.
 * @returns {Promise<boolean>} True if the user is an authorized admin, false otherwise.
 */
async function isAuthorizedAdmin(userId) {
    if (!userId) return false;
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', 'comment_adder') // Assuming 'comment_adder' role for admin access
            .single();

        return !!data; // Returns true if data exists, false otherwise
    } catch (error) {
        console.error('Error checking admin authorization:', error.message);
        return false;
    }
}

/**
 * Fetches and updates dashboard statistics (total comments, news, and monthly counts).
 */
async function fetchDashboardStats() {
    // Get dashboard elements (ensure they exist before trying to update)
    const totalCommentsCount = document.getElementById('totalCommentsCount');
    const totalNewsCount = document.getElementById('totalNewsCount');
    const commentsMonthCount = document.getElementById('commentsMonthCount');
    const newsMonthCount = document.getElementById('newsMonthCount');

    if (!totalCommentsCount || !totalNewsCount || !commentsMonthCount || !newsMonthCount) {
        console.warn('Dashboard elements not found. Skipping stats fetch.');
        return;
    }

    const now = new Date();
    // Set to the first day of the current month, 00:00:00.000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    // Set to the last day of the current month, 23:59:59.999
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    // Fetch counts concurrently
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

/**
 * Handles parsing a raw comment string into structured data (author, source, timestamp, content).
 * This function has been significantly improved to handle various date/time formats.
 * @param {string} text - The raw comment string.
 * @returns {object|null} An object containing parsed data, or null if parsing fails.
 */
function parseComment(text) {
    // Regex to capture author, content/timestamp, and optional URL at the end.
    // This regex is designed to be flexible with the separator.
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

        let parsedDate = new Date(); // Initialize with current date for fallback
        let content = rawContentWithTimestamp; // Default content, will be refined

        // --- Attempt to parse timestamp formats ---

        // 1. Full date and time: "MM/DD/YY, HH:MM AM/PM" or "MM/DD/YYYY, HH:MM AM/PM"
        const fullDateTimePattern = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
        let timestampMatch = rawContentWithTimestamp.match(fullDateTimePattern);

        if (timestampMatch) {
            const datePart = timestampMatch[1]; // e.g., "5/26/25"
            const timePart = timestampMatch[2]; // e.g., "10:27 AM"
            content = timestampMatch[3].trim(); // Rest is the actual content

            let [month, day, year] = datePart.split('/').map(Number);

            // Handle 2-digit years (e.g., 25 -> 2025, 90 -> 1990)
            if (year < 100) {
                year += (year > 50) ? 1900 : 2000;
            }

            // Create a date object from the parsed date part
            parsedDate = new Date(year, month - 1, day); // Month is 0-indexed

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
                    hours = 0; // 12 AM is midnight
                }
                parsedDate.setHours(hours, minutes, 0, 0);
            } else {
                console.warn("Could not parse time part for full date format:", timePart);
                parsedDate.setHours(0, 0, 0, 0); // Default to start of day if time parsing fails
            }
        } else {
            // 2. "Yesterday at HH:MM AM/PM"
            const yesterdayPattern = /^yesterday at\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
            timestampMatch = rawContentWithTimestamp.match(yesterdayPattern);

            if (timestampMatch) {
                const timePart = timestampMatch[1];
                content = timestampMatch[2].trim();

                parsedDate = new Date(); // Start with today
                parsedDate.setDate(parsedDate.getDate() - 1); // Set to yesterday

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
                // 3. "HH:MM AM/PM" (assuming "Today at" or just time)
                // This pattern should be last as it's the most general time-only pattern.
                const timeOnlyPattern = /^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(.*)$/i;
                timestampMatch = rawContentWithTimestamp.match(timeOnlyPattern);

                if (timestampMatch) {
                    const timePart = timestampMatch[1];
                    content = timestampMatch[2].trim();

                    parsedDate = new Date(); // Start with today

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
                    // If no specific timestamp format matched, assume the whole rawContentWithTimestamp is content
                    // and use the current date/time as the comment_date.
                    console.warn("No specific timestamp format recognized. Assuming content is the full string and using current date/time.");
                    content = rawContentWithTimestamp;
                    parsedDate = new Date();
                }
            }
        }

        // Ensure content is not just an empty string if the timestamp consumed everything
        // This attempts to recover content if it was incorrectly stripped,
        // assuming the remaining part of rawContentWithTimestamp is the actual content.
        // This is a heuristic and might need fine-tuning based on actual input patterns.
        if (content === '' && timestampMatch && rawContentWithTimestamp.length > timestampMatch[0].length) {
             const potentialContentAfterTimestamp = rawContentWithTimestamp.substring(timestampMatch[0].length).trim();
             if (potentialContentAfterTimestamp) {
                 content = potentialContentAfterTimestamp;
             }
        }


        // Format the parsed date into YYYY-MM-DDTHH:MM for the timestamp field
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


// --- Main Document Ready / Initialization Logic ---

$(document).ready(async function() {
    // --- UI Navigation and Modals (from main.js) ---
    $('.menu-trigger').on('click', function() {
        $(this).toggleClass('active');
        $('.header-area .nav').toggleClass('active');
    });

    // Smooth scroll for anchor links
    $('a[href*="#"]:not([href="#"])').on('click', function() {
        if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
            var target = $(this.hash);
            target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
            if (target.length) {
                $('html, body').animate({
                    scrollTop: target.offset().top - 80
                }, 1000);
                return false;
            }
        }
    });

    // Roadmap Modal functionality
    const roadmapLink = $('#roadmapLink');
    const roadmapModalOverlay = $('#roadmapModalOverlay');
    const closeRoadmapModalButton = $('#closeRoadmapModal');

    if (roadmapLink.length && roadmapModalOverlay.length && closeRoadmapModalButton.length) {
        roadmapLink.on('click', function(event) {
            event.preventDefault();
            roadmapModalOverlay.addClass('active');
            $('body').addClass('modal-open'); // Prevent body scroll
        });

        closeRoadmapModalButton.on('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            roadmapModalOverlay.removeClass('active');
            $('body').removeClass('modal-open');
        });

        roadmapModalOverlay.on('click', function(event) {
            if ($(event.target).is(roadmapModalOverlay)) {
                event.stopPropagation();
                roadmapModalOverlay.removeClass('active');
                $('body').removeClass('modal-open');
            }
        });

        $(document).on('keydown', function(event) {
            if (event.key === 'Escape' && roadmapModalOverlay.hasClass('active')) {
                roadmapModalOverlay.removeClass('active');
                $('body').removeClass('modal-open');
            }
        });
    }

    // --- Search Functionality (from main.js) ---
    const searchInput = $('#searchText');
    const searchResultsDropdown = $('#searchResultsDropdown');

    $('#search').on('submit', function(event) {
        event.preventDefault();
        const searchText = searchInput.val().trim();
        if (searchText) {
            performSearch(searchText);
        } else {
            searchResultsDropdown.removeClass('active');
            searchResultsDropdown.empty();
        }
    });

    // Close search results dropdown when clicking outside
    $(document).on('click', function(event) {
        if (!$(event.target).closest('.header-area .search-input').length &&
            !$(event.target).closest('#searchResultsDropdown').length) {
            searchResultsDropdown.removeClass('active');
        }
    });

    // Close search results dropdown on Escape key
    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && searchResultsDropdown.hasClass('active')) {
            searchResultsDropdown.removeClass('active');
        }
    });

    // --- Page-specific Content Loading ---
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'index.html' || currentPage === '') {
        fetchAndRenderDeveloperComments('recent-comments-home', 6);
        fetchAndRenderNewsUpdates('news-updates-home', 3);
    } else if (currentPage === 'developer-comments.html') {
        const devCommentsContainer = $('#dev-comments-container');
        const filterAuthorSelect = $('#filterAuthor');
        const filterTagSelect = $('#filterTag');
        const filterDateInput = $('#filterDate');
        const applyFiltersButton = $('#applyFilters');
        const clearFiltersButton = $('#clearFilters');

        // Function to populate tags from Supabase for filtering
        async function populateTagsFromSupabase() {
            filterTagSelect.find('option:not(:first)').remove(); // Clear existing options except the first

            try {
                const { data, error } = await supabase
                    .from('tag_list')
                    .select('tag_name');

                if (error) {
                    console.error('Error fetching tags from Supabase for filters:', error.message);
                    return;
                }

                data.forEach(tag => {
                    filterTagSelect.append(`<option value="${tag.tag_name}">${tag.tag_name}</option>`);
                });

            } catch (e) {
                console.error('Unexpected error during Supabase tag fetch for filters:', e);
            }
        }

        // Function to populate authors from currently rendered comments
        function populateAuthorsFromComments() {
            filterAuthorSelect.find('option:not(:first)').remove(); // Clear existing options except the first
            const authors = new Set();

            devCommentsContainer.children('.dev-comment-item').each(function() {
                const author = $(this).data('author');
                if (author) authors.add(author);
            });

            Array.from(authors).sort().forEach(author => {
                filterAuthorSelect.append(`<option value="${author}">${author}</option>`);
            });
        }

        // Function to apply filters to comments
        function applyFilters() {
            const selectedAuthor = filterAuthorSelect.val();
            const selectedTag = filterTagSelect.val();
            const selectedDate = filterDateInput.val();

            let commentsFound = false;

            devCommentsContainer.children('.dev-comment-item').each(function() {
                const commentAuthor = $(this).data('author');
                // For tags, if it's an array in data-tag, it will be a comma-separated string
                const commentTags = $(this).data('tag') ? $(this).data('tag').split(',') : [];
                const commentDate = $(this).data('date'); // YYYY-MM-DD format

                const matchesAuthor = selectedAuthor === "" || commentAuthor === selectedAuthor;
                // Check if the selectedTag is empty or if any of the commentTags include the selectedTag
                const matchesTag = selectedTag === "" || commentTags.includes(selectedTag);
                const matchesDate = selectedDate === "" || commentDate === selectedDate;

                if (matchesAuthor && matchesTag && matchesDate) {
                    $(this).show();
                    commentsFound = true;
                } else {
                    $(this).hide();
                }
            });

            const noCommentsMessage = devCommentsContainer.find('.no-comments-found');
            if (!commentsFound) {
                if (noCommentsMessage.length === 0) {
                    devCommentsContainer.append('<div class="col-lg-12 no-comments-found"><p class="text-center text-white-50">No comments found matching your filters.</p></div>');
                } else {
                    noCommentsMessage.show();
                }
            } else {
                noCommentsMessage.hide();
            }
        }

        // Function to clear all filters
        function clearFilters() {
            filterAuthorSelect.val('');
            filterTagSelect.val('');
            filterDateInput.val('');

            devCommentsContainer.children('.dev-comment-item').show(); // Show all comments

            devCommentsContainer.find('.no-comments-found').hide(); // Hide no comments message
        }

        // Fetch and render comments first
        await fetchAndRenderDeveloperComments('dev-comments-container');

        // When comments are rendered (e.g., loaded from DB), populate authors from them
        // This event is triggered after fetchAndRenderDeveloperComments completes
        devCommentsContainer.on('commentsRendered', function() {
            populateAuthorsFromComments();
            // Apply filters immediately after rendering and populating authors/tags
            applyFilters();
        });

        // Initial load: Fetch tags from Supabase directly for the filter dropdown
        populateTagsFromSupabase();

        // Populate authors if comments are already in DOM on initial load (less common for dynamic content)
        // This might be redundant if 'commentsRendered' is always triggered, but good for robustness.
        if (devCommentsContainer.children('.dev-comment-item').length > 0) {
            populateAuthorsFromComments();
        }

        // Attach event listeners for filter buttons
        applyFiltersButton.on('click', applyFilters);
        clearFiltersButton.on('click', clearFilters);

    } else if (currentPage === 'news-updates.html') {
        fetchAndRenderNewsUpdates('news-updates-container');
    }

    // --- Admin Panel Specific Logic (from admin.js) ---
    if (currentPage === 'admin.html') {
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
        const tagSelect = document.getElementById('tagSelect'); // Tag select dropdown
        const newTagInput = document.getElementById('newTagInput'); // New tag input field
        const addNewTagButton = document.getElementById('addNewTagButton'); // Add new tag button

        // News Update Form elements
        const addNewsUpdateForm = document.getElementById('addNewsUpdateForm');
        const newsDateInput = document.getElementById('news_date');
        const newsTitleInput = document.getElementById('news_title');
        const newsSummaryInput = document.getElementById('news_summary');
        const fullArticleLinkInput = document.getElementById('full_article_link');
        const addNewsUpdateMessage = document.getElementById('addNewsUpdateMessage');

        /**
         * Checks the current authentication state and updates the UI accordingly.
         * Shows/hides login form, dashboard, and displays authorization messages.
         */
        async function checkAuth() {
            const { data: { user } = {} } = await supabase.auth.getUser(); // Destructure with default empty object

            if (user) {
                const authorized = await isAuthorizedAdmin(user.id);

                if (authorized) {
                    if (loginFormContainer) loginFormContainer.style.display = 'none';
                    if (loginHeading) loginHeading.style.display = 'none';
                    if (adminDashboardAndForm) adminDashboardAndForm.style.display = 'block';
                    fetchDashboardStats(); // Fetch stats only if authorized
                    populateTagSelect(); // Populate tags for the admin form
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

        /**
         * Populates the tag selection dropdown in the admin form from Supabase.
         */
        async function populateTagSelect() {
            if (!tagSelect) {
                console.warn('tagSelect element not found. Cannot populate tags.');
                return;
            }
            tagSelect.innerHTML = '<option value="">Select existing tags (Ctrl/Cmd+Click to select multiple)</option>'; // Clear and add default option
            console.log('Attempting to populate tags...');

            try {
                const { data, error } = await supabase
                    .from('tag_list')
                    .select('tag_name')
                    .order('tag_name', { ascending: true }); // Order alphabetically

                if (error) {
                    console.error('Error fetching tags for admin form:', error.message);
                    return;
                }

                console.log('Fetched tags data:', data); // Log the fetched data

                if (data && data.length > 0) {
                    data.forEach(tag => {
                        console.log('Adding tag:', tag.tag_name); // Log each tag being added
                        const option = document.createElement('option');
                        option.value = tag.tag_name;
                        option.textContent = tag.tag_name;
                        tagSelect.appendChild(option);
                    });
                } else {
                    console.log('No tags found in Supabase tag_list table.');
                }
            } catch (e) {
                console.error('Unexpected error populating tags for admin form:', e);
            }
        }

        // Initial auth check and set up auth state change listener
        checkAuth();
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                checkAuth();
            }
        });

        // Discord Login Button Event Listener
        if (discordLoginButton) {
            discordLoginButton.addEventListener('click', async () => {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: 'https://yesitsphoenix.github.io/Pax-Dei-Archives/admin.html' // Ensure this matches your deployed admin page URL
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

        // Dev Comment Parser Button Event Listener
        if (parseButton && commentInput && devCommentForm && parseError) {
            parseButton.addEventListener('click', () => {
                showFormMessage(formMessage, '', ''); // Clear previous messages
                const inputText = commentInput.value;
                const parsedData = parseComment(inputText); // Call the improved parseComment function

                if (parsedData) {
                    // Populate form fields with parsed data
                    if (authorField) authorField.value = parsedData.author;
                    if (sourceField) sourceField.value = parsedData.source;
                    if (timestampField) timestampField.value = parsedData.timestamp;
                    if (commentContentField) commentContentField.value = parsedData.content;

                    // Show the form and hide parser elements
                    devCommentForm.style.display = 'block';
                    commentInput.style.display = 'none';
                    parseButton.style.display = 'none';
                    parseError.style.display = 'none';
                } else {
                    // Show error message if parsing fails
                    parseError.textContent = 'Could not parse the input. Please ensure it matches one of the expected formats: "Author — Timestamp Content [Optional URL]" or "Author — Content [Optional URL]"';
                    parseError.style.display = 'block';
                    devCommentForm.style.display = 'none';
                    commentInput.style.display = 'block';
                    parseButton.style.display = 'block';
                }
            });
        }

        // Edit Button Event Listener (to go back to parsing)
        if (editButton && devCommentForm && commentInput && parseButton && parseError) {
            editButton.addEventListener('click', () => {
                showFormMessage(formMessage, '', ''); // Clear messages
                devCommentForm.style.display = 'none';
                commentInput.style.display = 'block';
                parseButton.style.display = 'block';
                parseError.style.display = 'none';
            });
        }

        // Add New Tag Button Event Listener
        if (addNewTagButton && newTagInput && tagSelect) {
            addNewTagButton.addEventListener('click', async () => {
                const newTag = newTagInput.value.trim();
                if (newTag) {
                    try {
                        const { data, error } = await supabase
                            .from('tag_list')
                            .insert([{ tag_name: newTag }]);

                        if (error && error.code !== '23505') { // 23505 is unique violation (tag already exists)
                            console.error('Error adding new tag:', error.message);
                            showFormMessage(formMessage, 'Error adding tag: ' + error.message, 'error');
                        } else {
                            if (error && error.code === '23505') {
                                showFormMessage(formMessage, `Tag '${newTag}' already exists.`, 'warning');
                            } else {
                                showFormMessage(formMessage, `Tag '${newTag}' added successfully!`, 'success');
                            }
                            newTagInput.value = ''; // Clear input field
                            populateTagSelect(); // Refresh the tag dropdown
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

        // Dev Comment Form Submission
        if (devCommentForm && commentInput && parseButton && parseError) {
            devCommentForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                showFormMessage(formMessage, '', ''); // Clear messages

                // Get selected tags from the multiple select dropdown
                const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);

                const newComment = {
                    author: authorField.value,
                    source: sourceField.value,
                    // Convert the YYYY-MM-DDTHH:MM string to ISO string for Supabase
                    comment_date: new Date(timestampField.value).toISOString(),
                    content: commentContentField.value,
                    // Generate a title from the content, truncated to 45 characters
                    title: commentContentField.value.substring(0, 45) + (commentContentField.value.length > 45 ? '...' : ''),
                    tag: selectedTags.length > 0 ? selectedTags : null // Store selected tags as an array
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
                    // Reset parser and form UI
                    commentInput.value = '';
                    devCommentForm.style.display = 'none';
                    commentInput.style.display = 'block';
                    parseButton.style.display = 'block';
                    parseError.style.display = 'none';
                    // tagSelect.value = ''; // Clearing selected tags in a multiple select is done by setting selectedOptions or iterating.
                    // For a multi-select, you might want to deselect all or reset to default.
                    Array.from(tagSelect.options).forEach(option => option.selected = false); // Deselect all options
                    fetchDashboardStats(); // Refresh dashboard stats after adding comment
                }
            });
        }

        // News Update Form Submission
        if (addNewsUpdateForm) {
            addNewsUpdateForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                showFormMessage(addNewsUpdateMessage, '', '');

                const newNewsUpdate = {
                    news_date: newsDateInput.value, // Assuming this is already in YYYY-MM-DD format
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
                    // Clear form fields
                    newsDateInput.value = '';
                    newsTitleInput.value = '';
                    newsSummaryInput.value = '';
                    fullArticleLinkInput.value = '';
                    fetchDashboardStats(); // Refresh dashboard stats after adding news
                }
            });
        }
    }
});
