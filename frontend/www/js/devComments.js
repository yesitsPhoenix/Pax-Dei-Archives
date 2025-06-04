// // devComments.js
// import { supabase } from './supabaseClient.js';
// import { authorRoleColors, formatCommentDateTime } from './utils.js';
// import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

// export async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null) {
//     const container = document.getElementById(containerId);
//     if (!container && !searchTerm) return [];

//     if (!searchTerm && container) {
//         container.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
//     }

//     try {
//         let query = supabase
//             .from('developer_comments')
//             .select('*');

//         if (searchTerm) {
//             query = query.or(`content.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
//         }

//         query = query.order('comment_date', { ascending: false });

//         if (limit) {
//             query = query.limit(limit);
//         }

//         const { data, error } = await query;

//         if (error) {
//             console.error('Error fetching developer comments:', error.message);
//             if (!searchTerm && container) {
//                 container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
//             }
//             return [];
//         }

//         if (data.length === 0 && !searchTerm && container) {
//             container.innerHTML = '<div class="no-content-message">No developer comments found.</div>';
//             return [];
//         }

//         if (!searchTerm && container) {
//             container.innerHTML = '';
//             data.forEach(comment => {
//                 let sourceDisplay = '';
//                 const urlPattern = /^(https?:\/\/[^\s]+)$/i;

//                 if (comment.source && urlPattern.test(comment.source)) {
//                     sourceDisplay = `
//                                 <a href="${comment.source}" target="_blank" rel="noopener noreferrer" class="source-link-button">
//                                     <i class="fas fa-external-link-alt"></i> Source
//                                 </a>
//                             `;
//                 } else if (comment.source) {
//                     sourceDisplay = comment.source;
//                 }

//                 let formattedDateForData = '';
//                 if (comment.comment_date) {
//                     try {
//                         const dateObj = new Date(comment.comment_date);
//                         const year = dateObj.getFullYear();
//                         const month = String(dateObj.getMonth() + 1).padStart(2, '0');
//                         const day = String(dateObj.getDate()).padStart(2, '0');
//                         formattedDateForData = `${year}-${month}-${day}`;
//                     } catch (e) {
//                         console.warn('Could not parse comment_date for data attribute:', comment.comment_date, e);
//                     }
//                 }
//                 const authorType = comment.author_type || 'default';
//                 const authorColor = authorRoleColors[authorType] || authorRoleColors['default'];

//                 const rawCommentContent = comment.content || '';
//                 const markdownHtml = marked.parse(rawCommentContent);

//                 const sanitizedHtmlContent = DOMPurify.sanitize(markdownHtml);

//                 // MODIFICATION HERE: Use JSON.stringify for the 'tag' array
//                 const tagDataAttribute = comment.tag ? JSON.stringify(comment.tag) : '[]';

//                 const commentHtml = `
//                         <div class="${containerId === 'recent-comments-home' ? 'col-lg-6 col-md-6 item' : 'col-md-6 mb-4 dev-comment-item'}"
//                             data-author="${comment.author || ''}"
//                             data-tag='${tagDataAttribute}'
//                             data-date="${formattedDateForData}">
//                             <div class="${containerId === 'recent-comments-home' ? 'item' : ''}"> <div class="down-content">
//                                 <h6>
//                                     <span class="comment-author-name" style="color: ${authorColor};">${comment.author}</span> -
//                                     <span class="comment-date">${formatCommentDateTime(comment.comment_date)}</span>
//                                 </h6>
//                                 <div class="comment-content-text">${sanitizedHtmlContent}</div>
//                                 ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''} </div>
//                         </div>
//                 `;
//                 container.insertAdjacentHTML('beforeend', commentHtml);
//             });
//         }
//         return data;
//     } catch (error) {
//         console.error('Unexpected error in fetchAndRenderDeveloperComments:', error);
//         if (!searchTerm && container) {
//             container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
//         }
//         return [];
//     }
// }

// devComments.js
import { supabase } from './supabaseClient.js';
import { authorRoleColors, formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

export async function fetchAndRenderDeveloperComments(containerId, limit = null, searchTerm = null, cacheKey = null, cacheExpiryMs = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return []; 

    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading comments...</div>';
    }

    let data = [];
    let error = null;

    // --- Caching Logic ---
    if (!searchTerm && cacheKey && cacheExpiryMs) {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            if (Date.now() - parsedCache.timestamp < cacheExpiryMs) {
                console.log(`Fetching developer comments from session storage cache for ${containerId}.`);
                data = parsedCache.data;
            } else {
                console.log(`Cached developer comments expired for ${containerId}, refetching.`);
                sessionStorage.removeItem(cacheKey);
            }
        }
    }

    if (data.length === 0) {
        console.log(`Fetching developer comments from Supabase for ${containerId}.`);
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

            const supabaseResponse = await query;
            data = supabaseResponse.data;
            error = supabaseResponse.error;

            if (error) {
                console.error('Error fetching developer comments:', error.message);
                if (!searchTerm && container) {
                    container.innerHTML = '<div class="error-message">Failed to load comments. Please try again later.</div>';
                }
                return [];
            }

            if (!searchTerm && cacheKey && cacheExpiryMs) {
                sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
            }

        } catch (e) {
            console.error('Unexpected error fetching developer comments from Supabase:', e);
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
            }
            return [];
        }
    }

    if (!searchTerm && container) {
        if (data.length === 0) {
            container.innerHTML = '<div class="no-content-message">No developer comments found.</div>';
            $(container).trigger('commentsRendered');
            return [];
        }

        container.innerHTML = '';
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
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    formattedDateForData = `${year}-${month}-${day}`;
                } catch (e) {
                    console.warn('Could not parse comment_date for data attribute:', comment.comment_date, e);
                }
            }
            const authorType = comment.author_type || 'default';
            const authorColor = authorRoleColors[authorType] || authorRoleColors['default'];

            const rawCommentContent = comment.content || '';
            const markdownHtml = marked.parse(rawCommentContent);

            const sanitizedHtmlContent = DOMPurify.sanitize(markdownHtml);

            const tagDataAttribute = comment.tag ? JSON.stringify(comment.tag) : '[]';

            const commentHtml = `
                    <div class="${containerId === 'recent-comments-home' ? 'col-lg-6 col-md-6 item' : 'col-md-6 mb-4 dev-comment-item'}"
                        data-author="${comment.author || ''}"
                        data-tag='${tagDataAttribute}'
                        data-date="${formattedDateForData}">
                        <div class="${containerId === 'recent-comments-home' ? 'item' : ''}"> <div class="down-content">
                            <h6>
                                <span class="comment-author-name" style="color: ${authorColor};">${comment.author}</span> -
                                <span class="comment-date">${formatCommentDateTime(comment.comment_date)}</span>
                            </h6>
                            <div class="comment-content-text">${sanitizedHtmlContent}</div>
                            ${sourceDisplay ? `<span class="comment-source">${sourceDisplay}</span>` : ''} </div>
                        </div>
                    </div>
                `;
            container.insertAdjacentHTML('beforeend', commentHtml);
        });
        $(container).trigger('commentsRendered');
    }
    return data;
}