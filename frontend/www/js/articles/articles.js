import { supabase } from '../supabaseClient.js';
import { formatCommentDateTime, replaceEmojiShortcodes, slugify } from '../utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const PUBLICATION_CACHE_KEY = 'paxDeiPublications:v2';
const PUBLICATION_CACHE_EXPIRY_MS = 10 * 60 * 1000;
const FALLBACK_IMAGE = 'frontend/www/assets/banner.png';

if (window.marked?.setOptions) {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
}

const SECTION_DEFINITIONS = [
  'Weekly News & Updates',
  'Dev Updates',
  'Community Outreach',
  'Community Reminder',
  'Exploration',
  'Scholarly News',
  'Map Updates',
  'Economic Impact',
  'Expert Tips',
  'Building Highlights',
  'Clan Highlights',
  'Community Events',
  'For Trade',
  'Thaumaturgy',
  'Crafting & Metallurgy',
];

const SECTION_ALIASES = new Map([
  ['updates', 'Weekly News & Updates'],
  ['game updates', 'Weekly News & Updates'],
  ['news', 'Weekly News & Updates'],
  ['main game updates', 'Weekly News & Updates'],
  ['buildings', 'Building Highlights'],
  ['building highlights', 'Building Highlights'],
  ['trading', 'For Trade'],
  ['trade', 'For Trade'],
  ['crafting', 'Crafting & Metallurgy'],
  ['metallurgy', 'Crafting & Metallurgy'],
  ['magic', 'Thaumaturgy'],
]);

let allPublications = [];
let allEntries = [];
let filteredEntries = [];
let activeCategory = 'All';
let activePublicationKey = null;
let isLegacyArchive = false;

export async function fetchAndRenderArticles(containerId, searchTerm = null, limit = null) {
  if (searchTerm) {
    return searchPublicationEntries(searchTerm, limit);
  }

  const publicationLimit = limit ?? (getPublicationPageMode() === 'latest' ? 1 : null);

  try {
    allPublications = await fetchPublications(publicationLimit);
    isLegacyArchive = false;
    if (!allPublications.length) {
      allPublications = await fetchArchivedPublications(publicationLimit);
      isLegacyArchive = allPublications.length > 0;
    }
  } catch (error) {
    console.warn('Publication tables unavailable; using legacy article archive fallback.', error);
    allPublications = await fetchLegacyPublications(publicationLimit);
    isLegacyArchive = true;
  }

  allEntries = allPublications.flatMap(publication => publication.entries);
  activePublicationKey = getInitialPublicationKey();
  filteredEntries = getActivePublicationEntries();

  if (containerId) {
    renderArticlesPage(filteredEntries);
  }

  return allEntries;
}

async function fetchPublications(limit = null) {
  const cachedData = sessionStorage.getItem(PUBLICATION_CACHE_KEY);
  if (!limit && cachedData) {
    const parsedCache = JSON.parse(cachedData);
    if (Date.now() - parsedCache.timestamp < PUBLICATION_CACHE_EXPIRY_MS) {
      return parsedCache.data.map(normalizePublication);
    }
    sessionStorage.removeItem(PUBLICATION_CACHE_KEY);
  }

  let query = supabase
    .from('publications')
    .select('*, publication_entries(*)')
    .eq('status', 'published')
    .order('release_date', { ascending: false })
    .order('issue_number', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const publications = (data || []).map(normalizePublication);
  if (!limit) {
    sessionStorage.setItem(PUBLICATION_CACHE_KEY, JSON.stringify({ data: publications, timestamp: Date.now() }));
  }
  return publications;
}

async function fetchLegacyPublications(limit = null) {
  let query = supabase
    .from('articles')
    .select('*')
    .order('publication_date', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const groups = new Map();
  (data || []).forEach(article => {
    const key = getPublicationKey(article.publication_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, articles]) => ({
      id: key,
      key,
      issueNumber: null,
      title: 'Legacy Article Archive',
      releaseDate: key,
      displayDate: formatPublicationDate(key),
      status: 'legacy',
      entries: articles.map(normalizeLegacyArticleEntry).sort(sortEntries),
    }));
}

async function fetchArchivedPublications(limit = null) {
  let query = supabase
    .from('article_archive')
    .select('*')
    .order('publication_date', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const groups = new Map();
  (data || []).forEach(article => {
    const key = getPublicationKey(article.publication_date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, articles]) => ({
      id: `archive-${key}`,
      key: `archive-${key}`,
      issueNumber: null,
      title: 'Legacy Article Archive',
      releaseDate: key,
      displayDate: formatPublicationDate(key),
      status: 'legacy',
      entries: articles.map(normalizeLegacyArticleEntry).sort(sortEntries),
    }));
}

async function searchPublicationEntries(searchTerm, limit = null) {
  try {
    let query = supabase
      .from('publication_entries')
      .select('*, publications(issue_number, release_date, title, status)')
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    if (data?.length) {
      return data.map(entry => normalizeEntry(entry, entry.publications || {}));
    }

    const { data: archiveData, error: archiveError } = await supabase
      .from('article_archive')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
    if (!archiveError) return (archiveData || []).map(normalizeLegacyArticleEntry);
    return [];
  } catch (error) {
    let query = supabase
      .from('articles')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);

    if (limit) query = query.limit(limit);

    const { data, error: articleError } = await query;
    if (!articleError) return (data || []).map(normalizeLegacyArticleEntry);

    const { data: archiveData } = await supabase
      .from('article_archive')
      .select('*')
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
    return (archiveData || []).map(normalizeLegacyArticleEntry);
  }
}

function normalizePublication(publication) {
  const releaseKey = publication.release_date || publication.releaseDate || getPublicationKey(publication.created_at);
  const publicationShell = {
    id: publication.id,
    key: publication.key || String(publication.id),
    issueNumber: publication.issue_number ?? publication.issueNumber ?? null,
    title: publication.title || `Issue ${publication.issue_number ?? publication.issueNumber ?? ''}`.trim(),
    releaseDate: releaseKey,
    displayDate: formatPublicationDate(releaseKey),
    status: publication.status || 'draft',
  };
  const sourceEntries = publication.publication_entries || publication.entries || [];

  return {
    ...publicationShell,
    entries: sourceEntries
      .map(entry => normalizeEntry(entry, publicationShell))
      .sort(sortEntries),
  };
}

function normalizeEntry(entry, publication) {
  const content = entry.content || '';
  const section = matchKnownSection(entry.section_key || entry.category || 'Weekly News & Updates');
  const summary = entry.summary || createExcerpt(stripImages(content), 180);
  const slug = entry.slug || slugify(`${publication.issueNumber || publication.releaseDate || 'publication'}-${section}-${entry.title || entry.id}`);
  const releaseDate = publication.releaseDate || publication.release_date || entry.releaseDate || entry.publication_date || getPublicationKey(entry.created_at);
  const heroImage = entry.image_url || entry.heroImage || entry.image || extractFirstImage(content) || '';

  return {
    id: entry.id,
    title: entry.title || section,
    slug,
    author: entry.author || 'Unknown',
    category: section,
    sectionKey: section,
    summary,
    content,
    publication_date: releaseDate,
    releaseDate,
    issueNumber: publication.issueNumber || publication.issue_number || null,
    publicationTitle: publication.title || null,
    sortOrder: entry.sort_order ?? entry.sortOrder ?? sectionSortIndex(section),
    heroImage,
    source: entry.source || '',
    readTime: entry.readTime || estimateReadTime(content),
  };
}

function normalizeLegacyArticleEntry(article) {
  const content = article.content || '';
  const category = matchKnownSection(article.category || 'Weekly News & Updates');
  const releaseDate = getPublicationKey(article.publication_date);

  return {
    ...article,
    title: article.title || category,
    slug: article.slug || slugify(article.title || article.id),
    author: article.author || 'Unknown',
    category,
    sectionKey: category,
    summary: article.summary || createExcerpt(stripImages(content), 180),
    content,
    publication_date: releaseDate,
    releaseDate,
    issueNumber: null,
    publicationTitle: 'Legacy Article Archive',
    sortOrder: sectionSortIndex(category),
    heroImage: article.image_url || article.image || extractFirstImage(content) || '',
    readTime: estimateReadTime(content),
  };
}

function renderArticlesPage(entries) {
  renderPublicationHeader();
  renderPublicationSelect();
  renderCategoryBar(getActivePublicationEntries(), activeCategory);
  renderPublicationGrid(entries);
  renderPublicationArchive();
  updateResultsMeta(entries);
  attachReadHandlers();
}

function renderPublicationHeader() {
  const pageMode = getPublicationPageMode();
  const publication = getActivePublication();
  const titleEl = document.getElementById('latestPublicationTitle');
  const metaEl = document.getElementById('latestPublicationMeta');
  const eyebrowEl = document.getElementById('latestPublicationEyebrow');
  if (!titleEl && !metaEl && !eyebrowEl) return;

  if (!publication) {
    if (eyebrowEl) eyebrowEl.textContent = pageMode === 'archive' ? 'Publications Archive' : 'Latest Publication';
    if (titleEl) titleEl.textContent = pageMode === 'archive' ? 'Browse Past Issues' : 'Most Recent Issue';
    if (metaEl) metaEl.textContent = '';
    return;
  }

  if (eyebrowEl) eyebrowEl.textContent = pageMode === 'archive' ? 'Selected Publication' : 'Latest Publication';
  if (titleEl) {
    const issuePrefix = publication.issueNumber
      ? `Issue ${publication.issueNumber}`
      : (pageMode === 'archive' ? 'Legacy Archive' : 'Current Issue');
    titleEl.innerHTML = publication.title
      ? `<span class="latest-publication-issue">${escapeHtml(issuePrefix)}</span><span class="latest-publication-title-separator">:</span> ${escapeHtml(publication.title)}`
      : `<span class="latest-publication-issue">${escapeHtml(issuePrefix)}</span>`;
  }

  if (metaEl) {
    const dateLabel = publication.displayDate || formatPublicationDate(publication.releaseDate);
    metaEl.textContent = dateLabel;
  }
}

function renderPublicationSelect() {
  const select = document.getElementById('publicationSelect');
  if (!select) return;
  const selectablePublications = getSelectablePublications();

  if (!selectablePublications.length) {
    select.innerHTML = '<option>No publications yet</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = selectablePublications.map(publication => `
    <option value="${escapeHtml(publication.key)}" ${publication.key === activePublicationKey ? 'selected' : ''}>
      ${escapeHtml(formatPublicationLabel(publication))}
    </option>
  `).join('');

  select.onchange = () => {
    activePublicationKey = select.value;
    activeCategory = 'All';
    filteredEntries = getActivePublicationEntries();
    renderArticlesPage(filteredEntries);
    updatePublicationUrl();
  };
}

function renderCategoryBar(sourceEntries, selectedCategory) {
  const categoryBar = document.getElementById('articleCategoryBar');
  if (!categoryBar) return;

  const availableSections = new Set(sourceEntries.map(entry => entry.category));
  const knownSections = SECTION_DEFINITIONS.filter(section => availableSections.has(section));
  const extraSections = [...availableSections]
    .filter(section => !SECTION_DEFINITIONS.includes(section))
    .sort((a, b) => a.localeCompare(b));
  const categories = ['All', ...knownSections, ...extraSections];

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
    button.addEventListener('click', () => setActiveCategory(button.dataset.category || 'All'));
  });
}

function renderPublicationGrid(entries) {
  const grid = document.getElementById('chronicleGrid');
  if (!grid) return;

  const publicationEntries = getActivePublicationEntries();
  if (!publicationEntries.length) {
    grid.innerHTML = '<div class="empty-articles-state">No publication entries are available yet.</div>';
    return;
  }

  const activeEntries = activeCategory === 'All'
    ? publicationEntries
    : publicationEntries.filter(entry => entry.category === activeCategory);

  grid.innerHTML = activeEntries.length
    ? activeEntries.map((entry, index) => renderPublicationCard(entry, index === 0 ? 'lead' : '')).join('')
    : '<div class="empty-articles-state">No entries match this section in the selected publication.</div>';
}

function renderPublicationCard(entry, modifier = '') {
  const imageMarkup = entry.heroImage
    ? `<img src="${escapeHtml(entry.heroImage)}" alt="${escapeHtml(entry.title)}" loading="lazy">`
    : `<img src="${FALLBACK_IMAGE}" alt="">`;
  const isPublicationIssueView = ['latest', 'archive'].includes(getPublicationPageMode());
  const summaryLimit = modifier === 'lead'
    ? (isPublicationIssueView ? 1200 : 420)
    : (isPublicationIssueView ? 720 : 260);
  const previewText = entry.content || entry.summary || '';
  const excerptHtml = DOMPurify.sanitize(renderMarkdownExcerpt(previewText, summaryLimit));

  return `
    <article class="chronicle-card ${modifier ? `chronicle-card-${modifier}` : ''}">
      <header class="chronicle-card-header">
        <h2>${escapeHtml(entry.category)}</h2>
      </header>
      <button class="chronicle-image js-read-article" type="button" data-slug="${escapeHtml(entry.slug)}">
        ${imageMarkup}
      </button>
      <div class="chronicle-card-body">
        <h3>
          <button class="chronicle-title-link js-read-article" type="button" data-slug="${escapeHtml(entry.slug)}">
            ${escapeHtml(entry.title)}
          </button>
        </h3>
        <div class="article-meta-row">
          <span><i class="fa fa-user"></i> ${escapeHtml(entry.author)}</span>
          <span><i class="fa fa-calendar"></i> ${formatPublicationDate(entry.releaseDate)}</span>
        </div>
        <div class="chronicle-excerpt markdown-content">${excerptHtml}</div>
        <button class="chronicle-read-link js-read-article" type="button" data-slug="${escapeHtml(entry.slug)}">
          Read entry
        </button>
      </div>
    </article>
  `;
}

function renderPublicationArchive() {
  const archive = document.getElementById('publicationArchiveList');
  if (!archive) return;

  const archivedPublications = getSelectablePublications();

  if (!archivedPublications.length) {
    archive.innerHTML = '<div class="empty-articles-state">No past publications are available yet.</div>';
    return;
  }

  archive.innerHTML = archivedPublications.map(publication => {
    const categories = [...new Set(publication.entries.map(entry => entry.category))].slice(0, 4);
    return `
      <button class="publication-archive-item ${publication.key === activePublicationKey ? 'active' : ''}" type="button" data-publication="${escapeHtml(publication.key)}">
        <span>${publication.issueNumber ? `Issue ${escapeHtml(publication.issueNumber)}` : 'Legacy Archive'}</span>
        <strong>${escapeHtml(publication.title || publication.displayDate)}</strong>
        <small>${escapeHtml(publication.displayDate)} - ${publication.entries.length} ${publication.entries.length === 1 ? 'entry' : 'entries'}${categories.length ? ` - ${escapeHtml(categories.join(', '))}` : ''}</small>
      </button>
    `;
  }).join('');

  archive.querySelectorAll('[data-publication]').forEach(button => {
    button.addEventListener('click', () => {
      activePublicationKey = button.dataset.publication;
      activeCategory = 'All';
      filteredEntries = getActivePublicationEntries();
      renderArticlesPage(filteredEntries);
      updatePublicationUrl();
      document.querySelector('.chronicle-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function updateResultsMeta(entries) {
  const activeCategoryLabel = document.getElementById('activeCategoryLabel');
  const resultCountLabel = document.getElementById('resultCountLabel');

  if (activeCategoryLabel) {
    activeCategoryLabel.textContent = isLegacyArchive ? 'Legacy archive' : (activeCategory === 'All' ? 'All sections' : activeCategory);
  }

  if (resultCountLabel) {
    const label = entries.length === 1 ? 'entry' : 'entries';
    resultCountLabel.textContent = `${entries.length} ${label}`;
  }
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
  const publicationEntries = getActivePublicationEntries();
  filteredEntries = category === 'All'
    ? [...publicationEntries]
    : publicationEntries.filter(entry => entry.category === category);

  renderArticlesPage(filteredEntries);
}

export async function displayFullArticle(slug) {
  let entry = allEntries.find(item => item.slug === slug);

  if (!entry) {
    entry = await fetchSingleEntry(slug);
  }

  if (!entry) return;

  $('#articleModalTitle').text(entry.title);
  $('#articleModalAuthor').html(`<i class="fa fa-user text-[#FFD700]"></i> ${escapeHtml(entry.author || 'Unknown')}`);
  $('#articleModalDate').html(`<i class="fa fa-calendar text-[#FFD700]"></i> ${formatPublicationDate(entry.releaseDate || entry.publication_date)}`);

  const categoryEl = $('#articleModalCategory');
  if (entry.category) {
    categoryEl.text(entry.category).removeClass('hidden');
  } else {
    categoryEl.addClass('hidden').text('');
  }

  const readTimeEl = $('#articleModalReadTime');
  readTimeEl.html(`<i class="fa-regular fa-clock text-[#FFD700]"></i> ${entry.readTime} min read`).removeClass('hidden');

  const heroImageHtml = entry.heroImage
    ? `<figure class="article-modal-hero-image"><img src="${escapeHtml(entry.heroImage)}" alt="${escapeHtml(entry.title)}"></figure>`
    : '';
  const markdownHtml = renderMarkdown(entry.content || '');
  $('#articleModalContent').html(DOMPurify.sanitize(heroImageHtml + markdownHtml));

  const sourceLink = $('#articleModalSourceLink');
  if (entry.source?.startsWith('http')) {
    sourceLink.attr('href', entry.source).removeClass('hidden');
  } else {
    sourceLink.addClass('hidden').removeAttr('href');
  }

  syncModalNavigation(entry.slug);
  $('#fullArticleModalOverlay').removeClass('hidden').addClass('flex');
  $('body').css('overflow', 'hidden');
}

async function fetchSingleEntry(slug) {
  const { data, error } = await supabase
    .from('publication_entries')
    .select('*, publications(issue_number, release_date, title, status)')
    .eq('slug', slug)
    .single();

  if (!error && data) {
    return normalizeEntry(data, data.publications || {});
  }

  const { data: legacyData } = await supabase.from('articles').select('*').eq('slug', slug).single();
  return legacyData ? normalizeLegacyArticleEntry(legacyData) : null;
}

function syncModalNavigation(slug) {
  const prevButton = document.getElementById('articleModalPrev');
  const nextButton = document.getElementById('articleModalNext');
  const activeList = filteredEntries.length ? filteredEntries : getActivePublicationEntries();
  const index = activeList.findIndex(entry => entry.slug === slug);
  const previousEntry = index > 0 ? activeList[index - 1] : null;
  const nextEntry = index >= 0 && index < activeList.length - 1 ? activeList[index + 1] : null;

  if (prevButton) {
    prevButton.disabled = !previousEntry;
    prevButton.dataset.slug = previousEntry?.slug || '';
  }

  if (nextButton) {
    nextButton.disabled = !nextEntry;
    nextButton.dataset.slug = nextEntry?.slug || '';
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
  const entrySlug = urlParams.get('item');

  setupArticleModalListeners();
  await fetchAndRenderArticles('chronicleGrid');

  if (entrySlug) {
    await displayFullArticle(entrySlug);
  }
}

function getPublicationPageMode() {
  return document.querySelector('[data-publication-mode]')?.dataset.publicationMode || 'archive';
}

function getActivePublication() {
  const selectablePublications = getSelectablePublications();
  return selectablePublications.find(publication => publication.key === activePublicationKey) || selectablePublications[0] || null;
}

function getActivePublicationEntries() {
  return getActivePublication()?.entries || [];
}

function getInitialPublicationKey() {
  const urlParams = new URLSearchParams(window.location.search);
  const publicationKey = urlParams.get('publication');
  const selectablePublications = getSelectablePublications();
  if (publicationKey && selectablePublications.some(publication => publication.key === publicationKey)) return publicationKey;
  return selectablePublications[0]?.key || null;
}

function getSelectablePublications() {
  return getPublicationPageMode() === 'archive' ? allPublications.slice(1) : allPublications;
}

function updatePublicationUrl() {
  if (!activePublicationKey) return;
  const url = new URL(window.location.href);
  url.searchParams.set('publication', activePublicationKey);
  window.history.replaceState({}, '', url);
}

function formatPublicationLabel(publication) {
  const issueLabel = publication.issueNumber ? `Issue ${publication.issueNumber}` : publication.title;
  return `${issueLabel} - ${publication.displayDate} (${publication.entries.length})`;
}

function getPublicationKey(dateValue) {
  if (!dateValue) return 'undated';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'undated';
  return date.toISOString().slice(0, 10);
}

function formatPublicationDate(dateValue) {
  const key = dateValue?.length > 10 ? getPublicationKey(dateValue) : dateValue;
  if (!key || key === 'undated') return 'Undated';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${key}T12:00:00`));
}

function matchKnownSection(category) {
  const alias = SECTION_ALIASES.get(String(category).toLowerCase());
  if (alias) return alias;

  const known = SECTION_DEFINITIONS.find(section => section.toLowerCase() === String(category).toLowerCase());
  return known || category;
}

function sectionSortIndex(section) {
  const index = SECTION_DEFINITIONS.indexOf(section);
  return index === -1 ? SECTION_DEFINITIONS.length : index;
}

function sortEntries(a, b) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title);
}

function extractFirstImage(markdown) {
  const markdownMatch = markdown.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  if (markdownMatch?.[1]) return markdownMatch[1];

  const htmlMatch = markdown.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (htmlMatch?.[1]) return htmlMatch[1];

  return '';
}

function stripImages(content) {
  return content.replace(/!\[[^\]]*]\([^)]+\)/g, '').replace(/<img[^>]*>/gi, '');
}

function renderMarkdown(content) {
  if (!content) return '';
  return marked.parse(replaceEmojiShortcodes(normalizeMarkdownInput(content)));
}

function normalizeMarkdownInput(content) {
  return content
    .replace(/\]\(\((https?:\/\/[^)\s]+)\)\)/g, ']($1)')
    .replace(/\]\(\s+(https?:\/\/[^)\s]+)\s+\)/g, ']($1)');
}

function estimateReadTime(content) {
  const words = stripImages(content).trim() ? stripImages(content).trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

function createExcerpt(content, maxLength) {
  const plainContent = markdownToPlainText(content);
  if (!plainContent) return '';
  if (plainContent.length <= maxLength) return plainContent;

  const excerpt = plainContent.slice(0, maxLength);
  const lastBreak = Math.max(excerpt.lastIndexOf('. '), excerpt.lastIndexOf('! '), excerpt.lastIndexOf('? '));
  const lastSpace = excerpt.lastIndexOf(' ');
  const cutoff = lastBreak > maxLength * 0.65 ? lastBreak + 1 : lastSpace;
  return `${excerpt.slice(0, cutoff > 0 ? cutoff : maxLength).trim()}...`;
}

function renderMarkdownExcerpt(content, maxLength) {
  const markdownContent = normalizeMarkdownInput(stripImages(content || '')).trim();
  if (!markdownContent) return '';
  return renderMarkdown(truncateMarkdown(markdownContent, maxLength));
}

function truncateMarkdown(content, maxLength) {
  if (content.length <= maxLength) return content;

  const excerpt = content.slice(0, maxLength);
  const lastParagraphBreak = excerpt.lastIndexOf('\n\n');
  const lastSentenceBreak = Math.max(excerpt.lastIndexOf('. '), excerpt.lastIndexOf('! '), excerpt.lastIndexOf('? '));
  const lastSpace = excerpt.lastIndexOf(' ');
  const cutoff = lastParagraphBreak > maxLength * 0.55
    ? lastParagraphBreak
    : (lastSentenceBreak > maxLength * 0.65 ? lastSentenceBreak + 1 : lastSpace);

  return `${excerpt.slice(0, cutoff > 0 ? cutoff : maxLength).trim()}...`;
}

function markdownToPlainText(content) {
  const normalizedContent = normalizeMarkdownInput(stripImages(content || ''))
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?|```/g, '\n'))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*\|?[-: ]+\|[-|: ]+$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~]+/g, '')
    .replace(/[ \t]*\n+[ \t]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return decodeHtmlEntities(normalizedContent);
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
