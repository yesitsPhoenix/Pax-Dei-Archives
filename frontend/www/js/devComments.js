// devComments.js

import { supabase } from './supabaseClient.js';
import { authorRoleColors, formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';


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
                // If parsing fails, use original date or empty string
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
                        <div class="comment-content-text">${sanitizedHtmlContent}</div>
                        ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', commentHtml);
    });
}
