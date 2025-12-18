import { supabase } from '../supabaseClient.js';
import { formatCommentDateTime, slugify } from '../utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const ARTICLE_LIST_CACHE_KEY = 'paxDeiArticleList';
const ARTICLE_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;

export async function fetchAndRenderArticles(containerId, searchTerm = null, limit = null) {
  const container = document.getElementById(containerId);
  if (!container && !searchTerm) return [];

  if (!searchTerm && container) {
    container.innerHTML = '<div class="col-span-full py-20 text-center text-[#FFD700] text-xl font-bold uppercase animate-pulse">Loading articles...</div>';
  }

  let articlesData = [];
  if (!searchTerm) {
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

  if (articlesData.length === 0 || searchTerm) {
    try {
      let query = supabase
        .from('articles')
        .select('*')
        .order('publication_date', { ascending: false });

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      articlesData = data;

      if (!searchTerm) {
        sessionStorage.setItem(ARTICLE_LIST_CACHE_KEY, JSON.stringify({ data: articlesData, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
  }

  if (container && !searchTerm) {
    renderArticleCards(container, articlesData);
  }

  return articlesData;
}

function renderArticleCards(container, articles) {
  container.innerHTML = '';
  if (!articles.length) {
    container.innerHTML = '<div class="col-span-full py-20 text-center text-gray-500 text-xl font-medium">No articles found.</div>';
    return;
  }

  articles.forEach(article => {
    const slug = article.slug || (article.title ? slugify(article.title) : '');
    const formattedDate = article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date';

    const articleHtml = `
      <div class="bg-gray-700 rounded-[25px] p-8 border border-[#333] hover:border-[#FFD700] transition-all duration-500 hover:-translate-y-2 flex flex-col h-full group">
        <h4 class="text-2xl font-bold text-white mb-3 group-hover:text-[#FFD700] transition-colors duration-300 leading-tight">${article.title}</h4>
        <div class="flex flex-wrap gap-4 text-[11px] text-gray-200 uppercase tracking-widest mb-6 font-semibold">
          <span class="flex items-center gap-2"><i class="fa fa-user text-[#FFD700]"></i> ${article.author || 'Unknown'}</span>
          <span class="flex items-center gap-2"><i class="fa fa-calendar text-[#FFD700]"></i> ${formattedDate}</span>
        </div>
        <p class="text-gray-200 text-base leading-relaxed mb-8 flex-grow">
          ${article.summary || (article.content ? article.content.substring(0, 150) + '...' : '')}
        </p>
        <div class="mt-auto">
          <button class="read-article-link bg-[#FFD700] text-black px-8 py-3 rounded-full text-sm font-bold hover:bg-white transition-all duration-300 w-full md:w-auto" data-slug="${slug}">
            Read Article
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', articleHtml);
  });

  $(container).find('.read-article-link').on('click', function(e) {
    const slug = $(this).data('slug');
    displayFullArticle(slug);
  });
}

export async function displayFullArticle(slug) {
  const { data: article } = await supabase.from('articles').select('*').eq('slug', slug).single();
  
  if (article) {
    $('#articleModalTitle').text(article.title);
    $('#articleModalAuthor').html(`<i class="fa fa-user text-[#FFD700]"></i> ${article.author || 'Unknown'}`);
    $('#articleModalDate').html(`<i class="fa fa-calendar text-[#FFD700]"></i> ${article.publication_date ? formatCommentDateTime(article.publication_date) : 'No Date'}`);

    const markdownHtml = marked.parse(article.content || '');
    $('#articleModalContent').html(DOMPurify.sanitize(markdownHtml));

    const sourceLink = $('#articleModalSourceLink');
    if (article.source?.startsWith('http')) {
      sourceLink.attr('href', article.source).removeClass('hidden').addClass('inline-block');
    } else {
      sourceLink.addClass('hidden').removeClass('inline-block');
    }

    $('#fullArticleModalOverlay').removeClass('hidden').addClass('flex');
    $('body').css('overflow', 'hidden');
  }
}

export function setupArticleModalListeners() {
  const closeModal = () => {
    $('#fullArticleModalOverlay').addClass('hidden').removeClass('flex');
    $('body').css('overflow', '');
  };

  $('#closeArticleModal, #fullArticleModalOverlay').on('click', function(e) {
    if (e.target === this || e.target.id === 'closeArticleModal') closeModal();
  });

  $(document).on('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

export async function handleArticlePageLogic() {
  const urlParams = new URLSearchParams(window.location.search);
  const articleSlug = urlParams.get('item');

  setupArticleModalListeners();
  if (articleSlug) await displayFullArticle(articleSlug);
  await fetchAndRenderArticles('articlesListContainer');
}