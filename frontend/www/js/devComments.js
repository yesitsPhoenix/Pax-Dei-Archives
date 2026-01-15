// devComments.js

import { supabase } from './supabaseClient.js';
import { authorRoleColors, formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

// State management for filters and pagination
let currentFilters = {
    author: '',
    tags: [],
    date: ''
};

let currentPage = 1;
const commentsPerPage = 20;
let allComments = [];
let filteredComments = [];


export async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null, cacheKey = null, cacheExpiryMs = null) {
    const container = containerId ? document.getElementById(containerId) : null;

    if (container && !searchTerm) {
        container.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
    }

    let commentsData = [];

    if (cacheKey && cacheExpiryMs && !searchTerm) {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            if (Date.now() - parsedCache.timestamp < cacheExpiryMs) {
                commentsData = parsedCache.data;
            } else {
                sessionStorage.removeItem(cacheKey);
            }
        }
    }

    if (commentsData.length === 0 || searchTerm) {
        try {
            let query = supabase
                .from('developer_comments')
                .select('*');

            if (searchTerm) {
                query = query.or(`content.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
            }

            query = query.order('comment_date', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching developer comments:', error.message);
                if (container && !searchTerm) {
                    container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
                }
                return [];
            }
            commentsData = data;

            if (cacheKey && cacheExpiryMs && !searchTerm) {
                sessionStorage.setItem(cacheKey, JSON.stringify({ data: commentsData, timestamp: Date.now() }));
            }

        } catch (e) {
            console.error('Unexpected error in fetchAndRenderDeveloperComments:', e);
            if (container && !searchTerm) {
                container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
            }
            return [];
        }
    }

    if (container && !searchTerm) {
        if (commentsData.length === 0) {
            container.innerHTML = '<div class="col-lg-12 no-comments-found"><p class="text-center text-white-50">No comments found.</p></div>';
        } else {
            renderComments(container, commentsData);
        }
        $(container).trigger('commentsRendered');
    }

    return commentsData;
}

// Initialize developer comments page with filters and pagination
export async function initializeDeveloperCommentsPage() {
    const container = document.getElementById('dev-comments-container');
    if (!container) return;

    try {
        // Fetch all comments
        const { data, error } = await supabase
            .from('developer_comments')
            .select('*')
            .order('comment_date', { ascending: false });

        if (error) throw error;

        allComments = data;
        filteredComments = [...allComments];

        // Populate filters
        await populateAuthorFilter();
        await populateTagFilter();

        // Render initial page
        renderPaginatedComments();

        // Setup event listeners
        setupFilterEventListeners();

    } catch (error) {
        console.error('Error initializing developer comments:', error);
        container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
    }
}

// Populate author filter dropdown
async function populateAuthorFilter() {
    const authorSelect = document.getElementById('filterAuthor');
    if (!authorSelect) return;

    try {
        const { data, error } = await supabase
            .from('developer_comments')
            .select('author, author_type')
            .order('author', { ascending: true });

        if (error) throw error;

        // Get unique authors
        const uniqueAuthors = [...new Set(data.map(item => item.author))].filter(Boolean);

        // Clear and repopulate
        authorSelect.innerHTML = '<option value="">All Authors</option>';
        uniqueAuthors.forEach(author => {
            const option = document.createElement('option');
            option.value = author;
            option.textContent = author;
            authorSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error populating author filter:', error);
    }
}

// Populate tag filter cloud
async function populateTagFilter() {
    const tagContainer = document.getElementById('filterTagContainer');
    if (!tagContainer) return;

    try {
        // Extract all unique tags from comments
        const allTags = new Set();
        allComments.forEach(comment => {
            if (comment.tag && Array.isArray(comment.tag)) {
                comment.tag.forEach(tag => allTags.add(tag));
            }
        });

        // Sort tags alphabetically
        const sortedTags = Array.from(allTags).sort();

        // Create tag buttons
        tagContainer.innerHTML = '';
        sortedTags.forEach(tag => {
            const tagButton = document.createElement('span');
            tagButton.className = 'tag-button';
            tagButton.textContent = tag;
            tagButton.dataset.tag = tag;
            tagButton.addEventListener('click', () => toggleTagFilter(tag, tagButton));
            tagContainer.appendChild(tagButton);
        });

    } catch (error) {
        console.error('Error populating tag filter:', error);
    }
}

// Toggle tag filter
function toggleTagFilter(tag, button) {
    const index = currentFilters.tags.indexOf(tag);
    if (index > -1) {
        currentFilters.tags.splice(index, 1);
        button.classList.remove('selected');
    } else {
        currentFilters.tags.push(tag);
        button.classList.add('selected');
    }
    // Apply filters immediately when tag is toggled
    applyFilters();
}

// Apply filters to comments
function applyFilters() {
    filteredComments = allComments.filter(comment => {
        // Author filter
        if (currentFilters.author && comment.author !== currentFilters.author) {
            return false;
        }

        // Tag filter (comment must have ALL selected tags)
        if (currentFilters.tags.length > 0) {
            if (!comment.tag || !Array.isArray(comment.tag)) {
                return false;
            }
            const hasAllTags = currentFilters.tags.every(tag => comment.tag.includes(tag));
            if (!hasAllTags) {
                return false;
            }
        }

        // Date filter
        if (currentFilters.date) {
            const commentDate = new Date(comment.comment_date).toISOString().split('T')[0];
            if (commentDate !== currentFilters.date) {
                return false;
            }
        }

        return true;
    });

    currentPage = 1;
    renderPaginatedComments();
}

// Clear all filters
function clearFilters() {
    currentFilters = {
        author: '',
        tags: [],
        date: ''
    };

    // Reset UI
    const authorSelect = document.getElementById('filterAuthor');
    const dateInput = document.getElementById('filterDate');
    const tagButtons = document.querySelectorAll('.tag-button');

    if (authorSelect) authorSelect.value = '';
    if (dateInput) dateInput.value = '';
    tagButtons.forEach(btn => btn.classList.remove('selected'));

    filteredComments = [...allComments];
    currentPage = 1;
    renderPaginatedComments();
}

// Render comments with pagination
function renderPaginatedComments() {
    const container = document.getElementById('dev-comments-container');
    if (!container) return;

    if (filteredComments.length === 0) {
        container.innerHTML = '<div class="col-lg-12 no-comments-found"><p class="text-center text-white-50">No comments found matching your filters.</p></div>';
        return;
    }

    const totalPages = Math.ceil(filteredComments.length / commentsPerPage);
    const startIndex = (currentPage - 1) * commentsPerPage;
    const endIndex = startIndex + commentsPerPage;
    const commentsToShow = filteredComments.slice(startIndex, endIndex);

    container.innerHTML = '';
    renderComments(container, commentsToShow);

    // Render pagination controls
    renderPaginationControls(totalPages);
}

// Render pagination controls
function renderPaginationControls(totalPages) {
    const container = document.getElementById('dev-comments-container');
    if (!container || totalPages <= 1) return;

    const paginationHtml = `
        <div class="col-lg-12 mt-4">
            <div class="pagination-controls flex justify-center items-center gap-2">
                <button id="prevPage" class="px-4 py-2 rounded ${currentPage === 1 ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="text-white px-4">Page ${currentPage} of ${totalPages}</span>
                <button id="nextPage" class="px-4 py-2 rounded ${currentPage === totalPages ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white" ${currentPage === totalPages ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', paginationHtml);

    // Add event listeners
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPaginatedComments();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPaginatedComments();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

// Setup event listeners for filters
function setupFilterEventListeners() {
    const applyBtn = document.getElementById('applyFilters');
    const clearBtn = document.getElementById('clearFilters');
    const authorSelect = document.getElementById('filterAuthor');
    const dateInput = document.getElementById('filterDate');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            currentFilters.author = authorSelect?.value || '';
            currentFilters.date = dateInput?.value || '';
            applyFilters();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearFilters);
    }
}

// Auto-initialize if on developer comments page
if (window.location.pathname.includes('developer-comments')) {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDeveloperCommentsPage();
    });
}


function renderComments(container, comments) {
    container.innerHTML = '';

    comments.forEach(comment => {
        const formattedDate = formatCommentDateTime(comment.comment_date);
        const tagsHtml = comment.tag && Array.isArray(comment.tag) ? comment.tag.map(tag => `<span class="comment-tag">${tag}</span>`).join('') : '';

        let sourceDisplay = '';
        const urlPattern = /^(https?:\/\/[^\s]+)$/i;

        if (comment.source && urlPattern.test(comment.source)) {
            sourceDisplay = `
                <a href="${comment.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
                    <i class="fas fa-external-link-alt"></i> Original Source
                </a>
            `;
        } else if (comment.source) {
            sourceDisplay = `<span class="comment-source">Source: ${comment.source}</span>`;
        }

        let formattedDateForData = '';
        if (comment.comment_date) {
            try {
                const dateObj = new Date(comment.comment_date);
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                formattedDateForData = `${year}-${month}-${day}`;
            } catch (e) {
                formattedDateForData = comment.comment_date || '';
            }
        }
        const authorType = comment.author_type || 'default';
        const authorColor = authorRoleColors[authorType] || authorRoleColors['default'];

        const rawCommentContent = comment.content || '';
        const markdownHtml = marked.parse(rawCommentContent);

        const sanitizedHtmlContent = DOMPurify.sanitize(markdownHtml);

        const tagDataAttribute = comment.tag && Array.isArray(comment.tag) ? JSON.stringify(comment.tag) : '[]';

        const commentHtml = `
            <div class="${container.id === 'recent-comments-home' ? 'col-lg-6 col-md-6 item' : 'col-md-6 mb-4 dev-comment-item'}"
                data-author="${comment.author || ''}"
                data-tag='${tagDataAttribute}'
                data-date="${formattedDateForData}">
                <div class="${container.id === 'recent-comments-home' ? 'item' : ''}">
                    <div class="down-content">
                        <h6>
                            <span class="comment-author-name" style="color: ${authorColor};">${comment.author || 'Unknown'}</span> -
                            <span class="comment-date">${formattedDate}</span>
                        </h6>
                        <div class="comment-content-text text-base">${sanitizedHtmlContent}</div>
                        ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', commentHtml);
    });
}

