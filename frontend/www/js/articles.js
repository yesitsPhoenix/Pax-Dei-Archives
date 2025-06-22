import { supabase } from './supabaseClient.js';
import { formatCommentDateTime } from './utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const ARTICLE_LIST_CACHE_KEY = 'paxDeiArticleList';
const ARTICLE_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;

const ARTICLE_CATEGORIES_CACHE_KEY = 'paxDeiArticleCategories';
const ARTICLE_CATEGORIES_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function fetchAndRenderArticleCategories(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return [];
    }

    const cachedData = localStorage.getItem(ARTICLE_CATEGORIES_CACHE_KEY);
    if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < ARTICLE_CATEGORIES_CACHE_EXPIRY_MS) {
            renderCategoryButtons(container, data);
            return data;
        } else {
            localStorage.removeItem(ARTICLE_CATEGORIES_CACHE_KEY);
        }
    }

    try {
        const { data, error } = await supabase
            .from('articles')
            .select('category')
            .not('category', 'is', null);

        if (error) {
            console.error('Error fetching article categories from Supabase:', error.message);
            return [];
        }

        const uniqueCategories = [...new Set(data.map(item => item.category))].sort();
        

        localStorage.setItem(ARTICLE_CATEGORIES_CACHE_KEY, JSON.stringify({ data: uniqueCategories, timestamp: Date.now() }));
        renderCategoryButtons(container, uniqueCategories);
        return uniqueCategories;

    } catch (e) {
        console.error('Unexpected error fetching article categories:', e);
        return [];
    }
}

export async function fetchAndRenderArticles(containerId, selectedCategory = null, searchTerm = null, limit = null) {
    const container = document.getElementById(containerId);
    if (!container && !searchTerm) return [];

    if (!searchTerm && container) {
        container.innerHTML = '<div class="loading-indicator">Loading articles...</div>';
    }

    let articlesData = [];
    let error = null;

    if (!searchTerm && !selectedCategory) {
        const cachedData = sessionStorage.getItem(ARTICLE_LIST_CACHE_KEY);
        if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            if (Date.now() - parsedCache.timestamp < ARTICLE_LIST_CACHE_EXPIRY_MS) {
                articlesData = parsedCache.data;
            } else {
                sessionStorage.removeItem(ARTICLE_LIST_CACHE_KEY);
            }
        }
    }

    if (articlesData.length === 0 || searchTerm || selectedCategory) {
        try {
            let query = supabase
                .from('articles')
                .select('*');

            if (selectedCategory) {
                query = query.eq('category', selectedCategory);
            }

            if (searchTerm) {
                query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
            }

            query = query.order('publication_date', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            const supabaseResponse = await query;
            articlesData = supabaseResponse.data;
            error = supabaseResponse.error;

            if (error) {
                if (!searchTerm && container) {
                    container.innerHTML = '<div class="error-message">Failed to load articles. Please try again later.</div>';
                }
                return [];
            }

            if (!searchTerm && !selectedCategory) {
                sessionStorage.setItem(ARTICLE_LIST_CACHE_KEY, JSON.stringify({ data: articlesData, timestamp: Date.now() }));
            }

        } catch (e) {
            if (!searchTerm && container) {
                container.innerHTML = '<div class="error-message">An unexpected error occurred.</div>';
            }
            return [];
        }
    }

    if (container && !searchTerm) {
        renderArticleCards(container, articlesData);
    }
    return articlesData;
}

export async function fetchSingleArticle(slug) {
    if (!slug) {
        return null;
    }
    try {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            return null;
        }
        return data;

    } catch (e) {
        return null;
    }
}

function renderCategoryButtons(container, categories) {
    container.innerHTML = '';
    if (categories.length === 0) {
        return;
    }
    categories.forEach(category => {
        const button = $(`<span class="category-button" data-category="${category}">${category}</span>`);
        button.on('click', function() {
            $('.category-button').removeClass('selected');
            $(this).addClass('selected');
            $(document).trigger('articleCategorySelected', category);
        });
        $(container).append(button);
    });
}

function renderArticleCards(container, articles) {
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = '<div class="col-lg-12 no-articles-found"><p>No articles found matching your criteria.</p></div>';
        return;
    }

    articles.forEach(article => {
        const formattedDate = article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date';
        const articleHtml = `
            <div class="article-card" data-slug="${article.slug}">
                <h4>${article.title}</h4>
                <div class="meta-info">
                    <span><i class="fa fa-user"></i> ${article.author || 'Unknown'}</span>
                    <span><i class="fa fa-calendar"></i> ${formattedDate}</span>
                    ${article.category ? `<span><i class="fa fa-tag"></i> ${article.category}</span>` : ''}
                </div>
                <p>${article.summary || (article.content ? article.content.substring(0, 150) + '...' : '')}</p>
                <div class="main-button">
                    <a href="#" class="read-article-link" data-slug="${article.slug}">Read Article</a>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', articleHtml);
    });

    $(container).find('.read-article-link').on('click', function(event) {
        event.preventDefault();
        const slug = $(this).data('slug');
        displayFullArticle(slug);
    });
}

async function displayFullArticle(slug) {
    const article = await fetchSingleArticle(slug);
    if (article) {
        $('#articleModalTitle').text(article.title);
        $('#articleModalAuthor').text(`By ${article.author || 'Unknown'}`);
        $('#articleModalDate').text(article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date');

        const markdownHtml = marked.parse(article.content || '');
        const sanitizedHtmlContent = DOMPurify.sanitize(markdownHtml);
        $('#articleModalContent').html(sanitizedHtmlContent);

        const sourceLinkElement = $('#articleModalSourceLink');
        if (article.source && article.source.startsWith('http')) {
            sourceLinkElement.attr('href', article.source).show();
        } else {
            sourceLinkElement.hide();
        }

        $('#fullArticleModalOverlay').addClass('active');
        $('body').addClass('modal-open');
    }
}

export function setupArticleModalListeners() {
    $('#closeArticleModal').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $('#fullArticleModalOverlay').removeClass('active');
        $('body').removeClass('modal-open');
    });

    $('#fullArticleModalOverlay').on('click', function(event) {
        if ($(event.target).is('#fullArticleModalOverlay')) {
            event.stopPropagation();
            $('#fullArticleModalOverlay').removeClass('active');
            $('body').removeClass('modal-open');
        }
    });

    $(document).on('keydown', function(event) {
        if (event.key === 'Escape' && $('#fullArticleModalOverlay').hasClass('active')) {
            $('#fullArticleModalOverlay').removeClass('active');
            $('body').removeClass('modal-open');
        }
    });
}
