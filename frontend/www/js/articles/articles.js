import { supabase } from '../supabaseClient.js';
import { formatCommentDateTime, replaceEmojiShortcodes, slugify } from '../utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const ARTICLE_LIST_CACHE_KEY = 'paxDeiArticleList';
const ARTICLE_LIST_CACHE_EXPIRY_MS = 10 * 60 * 1000;

let allArticles = [];
let filteredArticles = [];
let activeCategory = 'All';

export async function fetchAndRenderArticles(containerId, searchTerm = null, limit = null) {
  const shouldUseCache = !searchTerm && !limit;
  let articlesData = [];

  if (shouldUseCache) {
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

  if (articlesData.length === 0 || searchTerm || limit) {
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

      articlesData = (data || []).map(normalizeArticle);

      if (shouldUseCache) {
        sessionStorage.setItem(ARTICLE_LIST_CACHE_KEY, JSON.stringify({ data: articlesData, timestamp: Date.now() }));
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
  } else {
    articlesData = articlesData.map(normalizeArticle);
  }

  if (searchTerm) {
    return articlesData;
  }

  allArticles = articlesData;
  filteredArticles = [...allArticles];

  if (containerId) {
    renderArticlesPage(filteredArticles);
  }

  return articlesData;
}

function normalizeArticle(article) {
  const content = article.content || '';
  const summary = article.summary || createExcerpt(content, 180);
  const category = article.category?.trim() || 'Uncategorized';
  const slug = article.slug || (article.title ? slugify(article.title) : '');
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 220));

  return {
    ...article,
    content,
    summary,
    category,
    slug,
    readTime,
  };
}

function renderArticlesPage(articles) {
  renderStats(articles);
  renderFeaturedArticle(articles[0] || null);
  renderCategoryBar(allArticles, activeCategory);
  renderSpotlightSections(articles);
  renderArchiveList(articles);
  updateResultsMeta(articles);
  attachReadHandlers();
}

function renderStats(articles) {
  const articleCount = document.getElementById('articleCountStat');
  const categoryCount = document.getElementById('categoryCountStat');
  const latestDate = document.getElementById('latestDateStat');
  const categories = new Set(allArticles.map(article => article.category));

  if (articleCount) articleCount.textContent = String(allArticles.length);
  if (categoryCount) categoryCount.textContent = String(categories.size);
  if (latestDate) latestDate.textContent = articles[0]?.publication_date ? formatCommentDateTime(articles[0].publication_date) : 'No entries';
}

function renderFeaturedArticle(article) {
  const panel = document.getElementById('featuredArticlePanel');
  if (!panel) return;

  if (!article) {
    panel.innerHTML = '<div class="empty-articles-state">No articles are available yet.</div>';
    return;
  }

  panel.innerHTML = `
    <div class="featured-article-content">
      <span class="article-category-tag">${escapeHtml(article.category)}</span>
      <h2 class="featured-article-title">${escapeHtml(article.title)}</h2>
      <div class="article-meta-row">
        <span><i class="fa fa-user"></i> ${escapeHtml(article.author || 'Unknown')}</span>
        <span><i class="fa fa-calendar"></i> ${formatArticleDate(article.publication_date)}</span>
        <span><i class="fa-regular fa-clock"></i> ${article.readTime} min read</span>
      </div>
      <p class="featured-article-summary">${escapeHtml(article.summary)}</p>
      <div class="featured-article-actions">
        <button class="article-cta js-read-article" data-slug="${escapeHtml(article.slug)}">
          <i class="fa-solid fa-book-open"></i> Read Featured Story
        </button>
        <button class="article-cta secondary js-filter-category" data-category="${escapeHtml(article.category)}">
          <i class="fa-solid fa-layer-group"></i> More In ${escapeHtml(article.category)}
        </button>
      </div>
    </div>
  `;

  panel.querySelector('.js-filter-category')?.addEventListener('click', () => {
    setActiveCategory(article.category);
    document.getElementById('articlesBrowserSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderCategoryBar(sourceArticles, selectedCategory) {
  const categoryBar = document.getElementById('articleCategoryBar');
  if (!categoryBar) return;

  const categories = ['All', ...new Set(sourceArticles.map(article => article.category))];
  categoryBar.innerHTML = categories.map(category => `
    <button
      class="article-category-chip ${category === selectedCategory ? 'active' : ''}"
      type="button"
      data-category="${escapeHtml(category)}"
    >
      ${escapeHtml(category)}
    </button>
  `).join('');

  categoryBar.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      setActiveCategory(button.dataset.category || 'All');
    });
  });
}

function renderSpotlightSections(articles) {
  const primaryContainer = document.getElementById('spotlightPrimaryContainer');
  const gridContainer = document.getElementById('spotlightGridContainer');
  if (!primaryContainer || !gridContainer) return;

  const spotlightPrimary = articles[1] || articles[0] || null;
  const spotlightGrid = articles.slice(spotlightPrimary ? 2 : 0, spotlightPrimary ? 5 : 4);

  if (spotlightPrimary) {
    primaryContainer.innerHTML = `
      <article class="spotlight-primary-card">
        <div class="spotlight-primary-content">
          <span class="article-category-tag">${escapeHtml(spotlightPrimary.category)}</span>
          <h3 class="spotlight-primary-title">${escapeHtml(spotlightPrimary.title)}</h3>
          <div class="article-meta-row">
            <span><i class="fa fa-user"></i> ${escapeHtml(spotlightPrimary.author || 'Unknown')}</span>
            <span><i class="fa fa-calendar"></i> ${formatArticleDate(spotlightPrimary.publication_date)}</span>
          </div>
          <p class="spotlight-primary-summary">${escapeHtml(spotlightPrimary.summary)}</p>
          <div class="featured-article-actions">
            <button class="article-cta js-read-article" data-slug="${escapeHtml(spotlightPrimary.slug)}">
              <i class="fa-solid fa-feather-pointed"></i> Open Story
            </button>
          </div>
        </div>
      </article>
    `;
  } else {
    primaryContainer.innerHTML = '<div class="empty-articles-state">Nothing to spotlight yet.</div>';
  }

  if (!spotlightGrid.length) {
    gridContainer.innerHTML = '';
    return;
  }

  gridContainer.innerHTML = spotlightGrid.map(article => `
    <article class="spotlight-card">
      <div class="spotlight-card-content">
        <span class="article-category-tag">${escapeHtml(article.category)}</span>
        <h4 class="spotlight-card-title">${escapeHtml(article.title)}</h4>
        <div class="article-meta-row">
          <span><i class="fa fa-calendar"></i> ${formatArticleDate(article.publication_date)}</span>
          <span><i class="fa-regular fa-clock"></i> ${article.readTime} min</span>
        </div>
        <p class="spotlight-card-summary">${escapeHtml(createExcerpt(article.summary, 120))}</p>
        <div class="featured-article-actions">
          <button class="article-cta secondary js-read-article" data-slug="${escapeHtml(article.slug)}">
            Read
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderArchiveList(articles) {
  const archiveContainer = document.getElementById('articlesArchiveContainer');
  if (!archiveContainer) return;

  const archiveArticles = articles.slice(spotlightOffset(articles));

  if (!archiveArticles.length) {
    archiveContainer.innerHTML = '<div class="empty-articles-state">No entries match this category yet.</div>';
    return;
  }

  archiveContainer.innerHTML = archiveArticles.map(article => `
    <article class="archive-item">
      <div class="archive-item-content">
        <div class="archive-item-header">
          <div>
            <span class="article-category-tag">${escapeHtml(article.category)}</span>
            <h4 class="archive-item-title">${escapeHtml(article.title)}</h4>
            <div class="article-meta-row">
              <span><i class="fa fa-user"></i> ${escapeHtml(article.author || 'Unknown')}</span>
              <span><i class="fa fa-calendar"></i> ${formatArticleDate(article.publication_date)}</span>
            </div>
          </div>
          <button class="archive-item-button js-read-article" type="button" data-slug="${escapeHtml(article.slug)}">
            Open
          </button>
        </div>
        <p class="archive-item-summary">${escapeHtml(createExcerpt(article.summary, 150))}</p>
      </div>
    </article>
  `).join('');
}

function updateResultsMeta(articles) {
  const activeCategoryLabel = document.getElementById('activeCategoryLabel');
  const resultCountLabel = document.getElementById('resultCountLabel');

  if (activeCategoryLabel) {
    activeCategoryLabel.textContent = activeCategory === 'All' ? 'All categories' : activeCategory;
  }

  if (resultCountLabel) {
    const label = articles.length === 1 ? 'entry' : 'entries';
    resultCountLabel.textContent = `${articles.length} ${label}`;
  }
}

function spotlightOffset(articles) {
  if (!articles.length) return 0;
  if (articles.length === 1) return 1;
  return Math.min(5, articles.length);
}

function attachReadHandlers() {
  document.querySelectorAll('.js-read-article').forEach(button => {
    button.addEventListener('click', () => {
      const slug = button.dataset.slug;
      if (slug) displayFullArticle(slug);
    });
  });
}

function setActiveCategory(category) {
  activeCategory = category;
  filteredArticles = category === 'All'
    ? [...allArticles]
    : allArticles.filter(article => article.category === category);

  renderArticlesPage(filteredArticles);
}

export async function displayFullArticle(slug) {
  let article = allArticles.find(entry => entry.slug === slug);

  if (!article) {
    const { data } = await supabase.from('articles').select('*').eq('slug', slug).single();
    article = data ? normalizeArticle(data) : null;
  }

  if (!article) return;

  $('#articleModalTitle').text(article.title);
  $('#articleModalAuthor').html(`<i class="fa fa-user text-[#FFD700]"></i> ${escapeHtml(article.author || 'Unknown')}`);
  $('#articleModalDate').html(`<i class="fa fa-calendar text-[#FFD700]"></i> ${formatArticleDate(article.publication_date)}`);

  const categoryEl = $('#articleModalCategory');
  if (article.category) {
    categoryEl.text(article.category).removeClass('hidden');
  } else {
    categoryEl.addClass('hidden').text('');
  }

  const readTimeEl = $('#articleModalReadTime');
  readTimeEl.html(`<i class="fa-regular fa-clock text-[#FFD700]"></i> ${article.readTime} min read`).removeClass('hidden');

  const markdownHtml = marked.parse(replaceEmojiShortcodes(article.content || ''));
  $('#articleModalContent').html(DOMPurify.sanitize(markdownHtml));

  const sourceLink = $('#articleModalSourceLink');
  if (article.source?.startsWith('http')) {
    sourceLink.attr('href', article.source).removeClass('hidden');
  } else {
    sourceLink.addClass('hidden').removeAttr('href');
  }

  syncModalNavigation(article.slug);
  $('#fullArticleModalOverlay').removeClass('hidden').addClass('flex');
  $('body').css('overflow', 'hidden');
}

function syncModalNavigation(slug) {
  const prevButton = document.getElementById('articleModalPrev');
  const nextButton = document.getElementById('articleModalNext');
  const activeList = filteredArticles.length ? filteredArticles : allArticles;
  const index = activeList.findIndex(article => article.slug === slug);
  const previousArticle = index > 0 ? activeList[index - 1] : null;
  const nextArticle = index >= 0 && index < activeList.length - 1 ? activeList[index + 1] : null;

  if (prevButton) {
    prevButton.disabled = !previousArticle;
    prevButton.dataset.slug = previousArticle?.slug || '';
  }

  if (nextButton) {
    nextButton.disabled = !nextArticle;
    nextButton.dataset.slug = nextArticle?.slug || '';
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

  $('#articleModalPrev, #articleModalNext').on('click', function() {
    const slug = this.dataset.slug;
    if (slug) displayFullArticle(slug);
  });

  $(document).on('keydown', (e) => {
    if ($('#fullArticleModalOverlay').hasClass('hidden')) return;

    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') {
      const previousSlug = document.getElementById('articleModalPrev')?.dataset.slug;
      if (previousSlug) displayFullArticle(previousSlug);
    }
    if (e.key === 'ArrowRight') {
      const nextSlug = document.getElementById('articleModalNext')?.dataset.slug;
      if (nextSlug) displayFullArticle(nextSlug);
    }
  });
}

export async function handleArticlePageLogic() {
  const urlParams = new URLSearchParams(window.location.search);
  const articleSlug = urlParams.get('item');

  setupArticleModalListeners();
  await fetchAndRenderArticles('featuredArticlePanel');

  if (articleSlug) {
    await displayFullArticle(articleSlug);
  }
}

function formatArticleDate(dateValue) {
  return dateValue ? formatCommentDateTime(dateValue) : 'No Date';
}

function createExcerpt(content, maxLength) {
  const plainContent = content.replace(/[#_*`>\-\[\]\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plainContent) return '';
  if (plainContent.length <= maxLength) return plainContent;
  return `${plainContent.slice(0, maxLength).trim()}...`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
