import { supabase } from '../supabaseClient.js';
import { replaceEmojiShortcodes, slugify } from '../utils.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';

const CHRONICLE_SECTIONS = [
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
  'Enemy Spotlights',
  'Combat Spotlights',
  'Dungeon Spotlights',
  'Classifieds',
];
const ENTRY_PREVIEW_DEBOUNCE_MS = 750;

let activePublication = null;
let activeEntries = [];
let editingEntryId = null;
let publicationList = [];
let carryOverEntries = [];
let entryPreviewDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await requirePublicationEditorAccess();
  if (!hasAccess) return;

  const elements = getElements();
  populateSectionSelect(elements.entrySectionSelect);
  updateEntryFieldRequirements(elements);
  resetPublicationFields(elements);
  setupMarkdownEditor(elements);

  elements.entryTitleInput.addEventListener('input', () => {
    setEntrySlug(elements, slugify(elements.entryTitleInput.value));
  });

  elements.loadPublicationButton.addEventListener('click', () => loadPublicationByIssue(elements));
  elements.loadSelectedPublicationButton.addEventListener('click', () => loadSelectedPublication(elements));
  elements.newPublicationButton.addEventListener('click', () => startNewPublication(elements));
  elements.clearPublicationButton.addEventListener('click', () => clearLoadedPublication(elements));
  elements.savePublicationButton.addEventListener('click', () => savePublicationDraft(elements));
  elements.publishButton.addEventListener('click', () => publishActivePublication(elements));
  elements.carryOverEntryButton.addEventListener('click', () => carryOverSelectedEntry(elements));
  elements.form.addEventListener('submit', event => saveEntryToDraft(event, elements));
  elements.entrySectionSelect.addEventListener('change', () => updateEntryFieldRequirements(elements));

  elements.issueNumberInput.addEventListener('input', () => resetActivePublication(elements, { clearPublicationFields: true }));

  await loadPublicationList(elements);
  await loadMostRecentPublication(elements);
});

function getElements() {
  return {
    form: document.getElementById('addArticleForm'),
    entryFieldset: document.getElementById('entryEditorFieldset'),
    activeNotice: document.getElementById('activePublicationNotice'),
    existingPublicationSelect: document.getElementById('existingPublicationSelect'),
    issueNumberInput: document.getElementById('publicationIssueNumber'),
    publicationTitleInput: document.getElementById('publicationTitle'),
    releaseDateInput: document.getElementById('publicationReleaseDate'),
    statusSelect: document.getElementById('publicationStatus'),
    loadPublicationButton: document.getElementById('loadPublicationButton'),
    loadSelectedPublicationButton: document.getElementById('loadSelectedPublicationButton'),
    newPublicationButton: document.getElementById('newPublicationButton'),
    clearPublicationButton: document.getElementById('clearPublicationButton'),
    savePublicationButton: document.getElementById('savePublicationButton'),
    entryTitleInput: document.getElementById('entryTitle'),
    entrySlugInput: document.getElementById('entrySlug'),
    entrySlugPreview: document.getElementById('entrySlugPreview'),
    entrySummaryInput: document.getElementById('entrySummary'),
    entryImageUrlInput: document.getElementById('entryImageUrl'),
    entryThumbnailUrlField: document.getElementById('entryThumbnailUrlField'),
    entryThumbnailUrlInput: document.getElementById('entryThumbnailUrl'),
    entryContentInput: document.getElementById('entryContent'),
    entryFullPreview: document.getElementById('entryFullPreview'),
    entryAuthorInput: document.getElementById('entryAuthor'),
    entrySectionSelect: document.getElementById('entrySection'),
    carryOverEntrySelect: document.getElementById('carryOverEntrySelect'),
    carryOverEntryButton: document.getElementById('carryOverEntryButton'),
    messageEl: document.getElementById('publicationEditorMessage'),
    draftTitle: document.getElementById('draftPublicationTitle'),
    draftMeta: document.getElementById('draftPublicationMeta'),
    draftStatus: document.getElementById('draftPublicationStatus'),
    draftEntryList: document.getElementById('draftEntryList'),
    publishButton: document.getElementById('publishPublicationButton'),
  };
}

function setupMarkdownEditor(elements) {
  if (window.marked?.setOptions) {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  const schedulePreviewUpdate = () => scheduleEntryPreviewUpdate(elements);

  [
    elements.entryTitleInput,
    elements.entrySummaryInput,
    elements.entryImageUrlInput,
    elements.entryThumbnailUrlInput,
    elements.entryContentInput,
    elements.entryAuthorInput,
    elements.entrySectionSelect,
  ].forEach(input => {
    input.addEventListener('input', schedulePreviewUpdate);
    input.addEventListener('change', () => updateEntryPreview(elements));
  });

  elements.entryImageUrlInput.addEventListener('input', () => updateThumbnailFieldVisibility(elements));
  elements.entryImageUrlInput.addEventListener('change', () => updateThumbnailFieldVisibility(elements));
  updateThumbnailFieldVisibility(elements);
  updateEntryPreview(elements);
}

function updateMarkdownPreview(elements) {
  updateEntryPreview(elements);
}

function scheduleEntryPreviewUpdate(elements) {
  window.clearTimeout(entryPreviewDebounceTimer);
  entryPreviewDebounceTimer = window.setTimeout(() => {
    updateEntryPreview(elements);
  }, ENTRY_PREVIEW_DEBOUNCE_MS);
}

function setEntrySlug(elements, slug) {
  const normalizedSlug = slug || '';
  elements.entrySlugInput.value = normalizedSlug;

  if (elements.entrySlugPreview) {
    elements.entrySlugPreview.textContent = normalizedSlug
      ? `Slug: ${normalizedSlug}`
      : 'Slug will generate from the title.';
  }
}

function updateEntryPreview(elements) {
  if (!elements.entryFullPreview) return;

  const title = elements.entryTitleInput.value.trim();
  const section = elements.entrySectionSelect.value || CHRONICLE_SECTIONS[0];
  const author = elements.entryAuthorInput.value.trim();
  const summary = elements.entrySummaryInput.value.trim();
  const mediaUrl = elements.entryImageUrlInput.value.trim();
  const thumbnailUrl = elements.entryThumbnailUrlInput.value.trim();
  const content = elements.entryContentInput.value;
  const bodyHtml = renderMarkdownPreview(content);
  const hasAnyContent = title || summary || mediaUrl || thumbnailUrl || content.trim();

  if (!hasAnyContent) {
    elements.entryFullPreview.innerHTML = '<p class="publication-preview-empty">Entry preview will appear here.</p>';
    return;
  }

  elements.entryFullPreview.innerHTML = `
    <article class="publication-preview-article">
      ${renderEntryPreviewMedia(mediaUrl, title || 'Publication entry', thumbnailUrl)}
      <div class="publication-preview-article-body">
        <div class="publication-preview-article-meta">
          <span>${escapeHtml(section)}</span>
          ${author ? `<span>${escapeHtml(author)}</span>` : ''}
        </div>
        <h3>${escapeHtml(title || 'Untitled Entry')}</h3>
        ${summary ? `<p class="publication-preview-summary">${escapeHtml(summary)}</p>` : ''}
        <div class="publication-preview-content markdown-content">${bodyHtml}</div>
      </div>
    </article>
  `;
}

function renderMarkdownPreview(content) {
  const source = normalizeMarkdownInput(replaceEmojiShortcodes(content || ''));
  if (!source.trim()) {
    return '<p class="publication-preview-empty">Markdown preview will appear here.</p>';
  }

  const parsed = window.marked ? marked.parse(source) : escapeHtml(source).replace(/\n/g, '<br>');
  return DOMPurify.sanitize(parsed);
}

function renderEntryPreviewMedia(url, title, thumbnailUrl = '') {
  const media = getMediaInfo(url);
  if (media.type === 'none') return '';

  if (media.type === 'youtube') {
    return `
      <figure class="publication-preview-media publication-preview-media-video">
        <iframe
          src="${escapeHtml(media.embedUrl)}"
          title="${escapeHtml(title)}"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </figure>
    `;
  }

  if (media.type === 'video') {
    const posterAttr = thumbnailUrl ? ` poster="${escapeHtml(thumbnailUrl)}"` : '';
    return `
      <figure class="publication-preview-media publication-preview-media-video">
        <video controls preload="metadata"${posterAttr}>
          <source src="${escapeHtml(media.url)}" type="${escapeHtml(media.mimeType)}">
        </video>
      </figure>
    `;
  }

  return `
    <figure class="publication-preview-media">
      <img src="${escapeHtml(media.url)}" alt="${escapeHtml(title)}" loading="lazy">
    </figure>
  `;
}

function getMediaInfo(url) {
  const mediaUrl = String(url || '').trim();
  if (!mediaUrl) return { type: 'none' };

  const youtubeId = getYouTubeVideoId(mediaUrl);
  if (youtubeId) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
    };
  }

  const cleanUrl = mediaUrl.split(/[?#]/)[0].toLowerCase();
  if (cleanUrl.endsWith('.mp4')) return { type: 'video', url: mediaUrl, mimeType: 'video/mp4' };
  if (cleanUrl.endsWith('.webm')) return { type: 'video', url: mediaUrl, mimeType: 'video/webm' };
  if (cleanUrl.endsWith('.ogg') || cleanUrl.endsWith('.ogv')) return { type: 'video', url: mediaUrl, mimeType: 'video/ogg' };

  return { type: 'image', url: mediaUrl };
}

function getYouTubeVideoId(url) {
  const directMatch = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?[^#\s]*v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);
  if (directMatch?.[1]) return directMatch[1];

  try {
    const parsedUrl = new URL(url, window.location.href);
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsedUrl.pathname.startsWith('/embed/')) return parsedUrl.pathname.split('/').filter(Boolean)[1] || '';
      if (parsedUrl.pathname.startsWith('/shorts/')) return parsedUrl.pathname.split('/').filter(Boolean)[1] || '';
      return parsedUrl.searchParams.get('v') || '';
    }
  } catch (error) {
    return '';
  }

  return '';
}

async function savePublicationDraft(elements) {
  showMessage(elements.messageEl, '', '');
  const issueNumber = Number(elements.issueNumberInput.value);
  const releaseDate = elements.releaseDateInput.value;
  const title = getPublicationTitle(elements);
  const status = elements.statusSelect.value || 'draft';

  try {
    validatePublication(issueNumber, releaseDate);
    await requireAuthenticatedUser();
    activePublication = await upsertPublication(issueNumber, releaseDate, title, status);
    clearPublicationCache();
    await loadPublicationList(elements);
    await loadPublicationByIssue(elements, { silent: true });
    showMessage(elements.messageEl, `Issue ${issueNumber} saved as ${status}.`, 'success');
  } catch (error) {
    console.error(error);
    showMessage(elements.messageEl, `Unable to save publication draft: ${error.message}`, 'error');
  }
}

async function loadPublicationList(elements) {
  const { data, error } = await supabase
    .from('publications')
    .select('id, issue_number, title, release_date, status, publication_entries(*)')
    .order('issue_number', { ascending: false });

  if (error) {
    console.error(error);
    elements.existingPublicationSelect.innerHTML = '<option value="">Unable to load publications</option>';
    return;
  }

  publicationList = data || [];
  refreshCarryOverOptions(elements);
  if (!publicationList.length) {
    elements.existingPublicationSelect.innerHTML = '<option value="">No publications yet</option>';
    return;
  }

  elements.existingPublicationSelect.innerHTML = [
    '<option value="">Select a publication</option>',
    ...publicationList.map(publication => `
      <option value="${escapeHtml(publication.id)}">
        Issue ${escapeHtml(publication.issue_number)} - ${escapeHtml(publication.title || 'Untitled')} (${escapeHtml(publication.status)})
      </option>
    `),
  ].join('');
}

async function loadMostRecentPublication(elements) {
  const mostRecentPublication = publicationList[0];

  if (!mostRecentPublication) {
    elements.issueNumberInput.value = await getNextIssueNumber();
    return;
  }

  elements.issueNumberInput.value = mostRecentPublication.issue_number;
  await loadPublicationByIssue(elements, { silent: true });
}

async function loadSelectedPublication(elements) {
  const publicationId = elements.existingPublicationSelect.value;
  const selected = publicationList.find(publication => publication.id === publicationId);
  if (!selected) {
    showMessage(elements.messageEl, 'Select a publication to load.', 'warning');
    return;
  }

  elements.issueNumberInput.value = selected.issue_number;
  await loadPublicationByIssue(elements);
}

async function startNewPublication(elements) {
  activePublication = null;
  activeEntries = [];
  editingEntryId = null;
  elements.existingPublicationSelect.value = '';
  elements.issueNumberInput.value = await getNextIssueNumber();
  elements.publicationTitleInput.value = '';
  elements.releaseDateInput.value = getLocalDateValue(new Date());
  elements.statusSelect.value = 'draft';
  clearEntryFields(elements);
  renderDraftPanel(elements, null, []);
  refreshCarryOverOptions(elements);
  showMessage(elements.messageEl, 'New publication ready. Save it before adding entries.', 'info');
}

async function clearLoadedPublication(elements) {
  resetActivePublication(elements, { clearPublicationFields: true });
  elements.issueNumberInput.value = await getNextIssueNumber();
  showMessage(elements.messageEl, 'Loaded publication cleared. Select another publication or start a new one.', 'info');
}

async function loadPublicationByIssue(elements, options = {}) {
  showMessage(elements.messageEl, '', '');
  const issueNumber = Number(elements.issueNumberInput.value);

  try {
    validateIssueNumber(issueNumber);

    const { data, error } = await supabase
      .from('publications')
      .select('*, publication_entries(*)')
      .eq('issue_number', issueNumber)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      resetActivePublication(elements);
      if (!options.silent) {
        showMessage(elements.messageEl, `Issue ${issueNumber} does not exist yet. Save it as a draft first.`, 'warning');
      }
      return;
    }

    activePublication = data;
    activeEntries = (data.publication_entries || []).sort(sortEntries);
    elements.releaseDateInput.value = data.release_date || elements.releaseDateInput.value;
    elements.publicationTitleInput.value = data.title || '';
    elements.statusSelect.value = data.status || 'draft';
    elements.existingPublicationSelect.value = data.id;
    editingEntryId = null;
    clearEntryFields(elements);
    renderDraftPanel(elements, activePublication, activeEntries);
    refreshCarryOverOptions(elements);

    if (!options.silent) {
      showMessage(elements.messageEl, `Issue ${issueNumber} loaded.`, 'success');
    }
  } catch (error) {
    console.error(error);
    showMessage(elements.messageEl, `Unable to load publication: ${error.message}`, 'error');
  }
}

async function saveEntryToDraft(event, elements) {
  event.preventDefault();
  showMessage(elements.messageEl, '', '');

  if (!activePublication) {
    showMessage(elements.messageEl, 'Create or load a publication before saving entries.', 'warning');
    return;
  }

  const submitButton = elements.form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = editingEntryId ? 'Updating...' : 'Saving...';

  try {
    const input = readEntryInput(elements);
    validateEntryInput(input);
    await requireAuthenticatedUser();

    await upsertPublicationEntry({
      id: editingEntryId,
      publicationId: activePublication.id,
      issueNumber: activePublication.issue_number,
      ...input,
    });

    clearPublicationCache();
  showMessage(elements.messageEl, editingEntryId ? 'Publication entry updated.' : 'Entry saved to the publication.', 'success');
    editingEntryId = null;
    clearEntryFields(elements);
    await loadPublicationByIssue(elements, { silent: true });
  } catch (error) {
    console.error(error);
    showMessage(elements.messageEl, `Unable to save publication entry: ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
    resetSubmitButton(submitButton);
  }
}

async function publishActivePublication(elements) {
  showMessage(elements.messageEl, '', '');

  if (!activePublication || !activeEntries.length) {
    showMessage(elements.messageEl, 'Add at least one entry before publishing.', 'warning');
    return;
  }

  if (activePublication.status === 'published') {
    showMessage(elements.messageEl, 'This publication is already published.', 'info');
    return;
  }

  elements.publishButton.disabled = true;
  elements.publishButton.textContent = 'Publishing...';

  try {
    await requireAuthenticatedUser();
    const { error } = await supabase
      .from('publications')
      .update({
        status: 'published',
        release_date: elements.releaseDateInput.value,
        title: getPublicationTitle(elements),
      })
      .eq('id', activePublication.id);

    if (error) throw error;

    clearPublicationCache();
    showMessage(
      elements.messageEl,
      `Issue ${activePublication.issue_number} published. Run python3 scripts/generate_publication_pages.py before sharing Discord links.`,
      'success',
    );
    await loadPublicationByIssue(elements, { silent: true });
  } catch (error) {
    console.error(error);
    showMessage(elements.messageEl, `Unable to publish this issue: ${error.message}`, 'error');
  } finally {
    elements.publishButton.innerHTML = '<i class="fas fa-upload"></i> Publish Publication';
  }
}

async function upsertPublication(issueNumber, releaseDate, title, status) {
  const { data: existing, error: existingError } = await supabase
    .from('publications')
    .select('*')
    .eq('issue_number', issueNumber)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase
      .from('publications')
      .update({ release_date: releaseDate, title, status })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('publications')
    .insert([{ issue_number: issueNumber, release_date: releaseDate, title, status }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function upsertPublicationEntry(entry) {
  const payload = {
    publication_id: entry.publicationId,
    section_key: entry.sectionKey,
    title: entry.title,
    slug: `${entry.issueNumber}-${entry.slug}`,
    summary: entry.summary,
    image_url: entry.imageUrl || null,
    thumbnail_url: entry.thumbnailUrl || null,
    content: entry.content,
    author: entry.author || 'Classifieds',
    sort_order: CHRONICLE_SECTIONS.indexOf(entry.sectionKey),
  };

  const query = entry.id
    ? supabase.from('publication_entries').update(payload).eq('id', entry.id)
    : supabase.from('publication_entries').insert([payload]);

  const { error } = await query;
  if (error) throw error;
}

async function getNextIssueNumber() {
  const { data, error } = await supabase
    .from('publications')
    .select('issue_number')
    .order('issue_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return 18;
  return Math.max(18, (data?.issue_number || 17) + 1);
}

async function requireAuthenticatedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Please log in before making publication changes.');
  const { data: role, error: roleError } = await supabase
    .from('admin_users')
    .select('is_admin, can_post_articles')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError || !(role?.is_admin === true || role?.can_post_articles === true)) {
    throw new Error('You need the can_post_articles role to make publication changes.');
  }

  return user;
}

async function requirePublicationEditorAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    window.location.href = 'index.html';
    return false;
  }

  const { data: role, error: roleError } = await supabase
    .from('admin_users')
    .select('is_admin, can_post_articles')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError || !(role?.is_admin === true || role?.can_post_articles === true)) {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

function resetActivePublication(elements, options = {}) {
  activePublication = null;
  activeEntries = [];
  editingEntryId = null;
  if (options.clearPublicationFields) {
    resetPublicationFields(elements);
  }
  clearEntryFields(elements);
  renderDraftPanel(elements, null, []);
  refreshCarryOverOptions(elements);
}

function renderDraftPanel(elements, publication, entries) {
  const issueNumber = Number(elements.issueNumberInput.value);
  const title = publication?.title || getPublicationTitle(elements);
  const releaseDate = publication?.release_date || elements.releaseDateInput.value;
  const status = publication?.status || 'none';
  const canEditEntries = Boolean(publication) && status !== 'archived';

  elements.entryFieldset.classList.toggle('entry-editor-disabled', !canEditEntries);
  elements.activeNotice.textContent = canEditEntries
    ? `Adding or editing entries for Issue ${publication.issue_number}: ${title}`
    : status === 'archived'
      ? 'This issue is archived. Change it back to draft or published before editing entries.'
      : 'Create or load a draft publication before adding entries.';

  elements.draftTitle.innerHTML = publication
    ? `<span class="latest-publication-issue">Issue ${escapeHtml(publication.issue_number)}</span><span class="latest-publication-title-separator">:</span> ${escapeHtml(title)}`
    : 'No Publication Loaded';
  elements.draftMeta.textContent = publication
    ? `${formatDate(releaseDate)} - ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} queued`
    : 'Create or load an issue to begin.';
  elements.draftStatus.textContent = status;
  elements.draftStatus.className = `publication-status-pill ${status}`;

  if (!entries.length) {
    elements.draftEntryList.className = 'draft-entry-list is-empty';
    elements.draftEntryList.innerHTML = '<div class="empty-draft-state">Saved entries for the selected issue will appear here.</div>';
  } else {
    elements.draftEntryList.className = 'draft-entry-list draft-publication-preview';
    elements.draftEntryList.innerHTML = renderDraftPublicationPreview(entries, canEditEntries, releaseDate);

    elements.draftEntryList.querySelectorAll('.draft-entry-edit').forEach(button => {
      button.addEventListener('click', () => loadEntryForEditing(button.dataset.entryId, elements));
    });
  }

  elements.publishButton.disabled = !publication || !entries.length || status === 'published' || status === 'archived';
  elements.savePublicationButton.innerHTML = publication
    ? '<i class="fas fa-save"></i> Save Publication'
    : '<i class="fas fa-save"></i> Save Publication Draft';
}

function renderDraftPublicationPreview(entries, canEditEntries, releaseDate) {
  if (entries.length === 1) {
    return renderDraftPublicationCard(entries[0], 'lead', canEditEntries, releaseDate);
  }

  const [leadEntry, ...secondaryEntries] = entries;
  const leadColumnEntries = secondaryEntries.filter(entry => isClassifiedSection(entry.section_key));
  const flowEntries = secondaryEntries.filter(entry => !isClassifiedSection(entry.section_key));

  return `
    <div class="chronicle-frontpage draft-chronicle-frontpage">
      <div class="chronicle-frontpage-lead">
        ${renderDraftPublicationCard(leadEntry, 'lead', canEditEntries, releaseDate)}
        ${renderDraftLeadColumnClassifieds(leadColumnEntries, canEditEntries, releaseDate)}
      </div>
      <div class="chronicle-frontpage-flow">
        ${renderDraftFrontpageFlow(flowEntries, canEditEntries, releaseDate)}
      </div>
    </div>
  `;
}

function updateThumbnailFieldVisibility(elements) {
  if (!elements.entryThumbnailUrlField) return;

  const media = getMediaInfo(elements.entryImageUrlInput.value);
  elements.entryThumbnailUrlField.classList.toggle('hidden', media.type !== 'video');
}

function renderDraftLeadColumnClassifieds(entries, canEditEntries, releaseDate) {
  if (!entries.length) return '';

  return `
    <div class="chronicle-classifieds-stack chronicle-lead-classifieds-stack">
      ${entries.map(entry => renderDraftPublicationCard(entry, 'secondary-classified', canEditEntries, releaseDate)).join('')}
    </div>
  `;
}

function renderDraftFrontpageFlow(entries, canEditEntries, releaseDate) {
  const articleEntries = entries.filter(entry => !isClassifiedSection(entry.section_key));
  const flowItems = buildDraftFrontpageFlowItems(entries);
  const columns = distributeDraftFrontpageFlowItems(flowItems);
  const orderedFlowItems = buildOrderedDraftFrontpageFlowItems(entries);

  return `
    ${columns.map(column => `
      <div class="chronicle-flow-column">
        ${column.map(item => renderDraftFrontpageFlowItem(item, articleEntries, canEditEntries, releaseDate)).join('')}
      </div>
    `).join('')}
    <div class="chronicle-frontpage-flow-mobile">
      ${orderedFlowItems.map(item => renderDraftFrontpageFlowItem(item, articleEntries, canEditEntries, releaseDate)).join('')}
    </div>
  `;
}

function buildDraftFrontpageFlowItems(entries) {
  const articleItems = entries
    .filter(entry => !isClassifiedSection(entry.section_key))
    .map(entry => ({ type: 'entry', entry }));
  const classifiedEntries = entries.filter(entry => isClassifiedSection(entry.section_key));

  if (!classifiedEntries.length) return articleItems;
  return [...articleItems, { type: 'classifieds', entries: classifiedEntries }];
}

function buildOrderedDraftFrontpageFlowItems(entries) {
  const articleItems = entries
    .filter(entry => !isClassifiedSection(entry.section_key))
    .map(entry => ({ type: 'entry', entry }));
  const classifiedEntries = entries.filter(entry => isClassifiedSection(entry.section_key));

  if (!classifiedEntries.length) return articleItems;
  return [...articleItems, { type: 'classifieds', entries: classifiedEntries }];
}

function distributeDraftFrontpageFlowItems(items) {
  const columns = [[], []];
  const weights = [0, 0];

  items.forEach(item => {
    const columnIndex = getNextDraftFrontpageColumn(item, columns, weights);
    columns[columnIndex].push(item);
    weights[columnIndex] += getDraftFrontpageFlowWeight(item);
  });

  return columns.filter(column => column.length);
}

function getNextDraftFrontpageColumn(item, columns, weights) {
  if (item.type === 'entry' && !columns[0].some(columnItem => columnItem.type === 'entry')) return 0;
  if (item.type === 'entry' && !columns[1].some(columnItem => columnItem.type === 'entry')) return 1;
  return weights[0] <= weights[1] ? 0 : 1;
}

function getDraftFrontpageFlowWeight(item) {
  if (item.type === 'classifieds') {
    return Math.max(0.45, item.entries.length * 0.38);
  }

  const entry = item.entry;
  const plainTextLength = createPlainExcerpt(stripImages(entry.content || entry.summary || ''), 2000).length;
  const hasMedia = Boolean(entry.image_url);
  const textWeight = Math.min(1.15, plainTextLength / 850);
  return 0.65 + textWeight + (hasMedia ? 0.55 : 0);
}

function renderDraftFrontpageFlowItem(item, articleEntries, canEditEntries, releaseDate) {
  if (item.type === 'classifieds') {
    return `
      <div class="chronicle-classifieds-stack">
        ${item.entries.map(entry => renderDraftPublicationCard(entry, 'secondary-classified', canEditEntries, releaseDate)).join('')}
      </div>
    `;
  }

  const articleIndex = articleEntries.findIndex(entry => entry === item.entry);
  return renderDraftPublicationCard(
    item.entry,
    getDraftSecondaryCardModifier(item.entry, articleIndex, articleEntries),
    canEditEntries,
    releaseDate,
  );
}

function getDraftSecondaryCardModifier(entry, index, entries) {
  if (isClassifiedSection(entry.section_key)) return 'secondary-classified';

  const articleEntries = entries.filter(item => !isClassifiedSection(item.section_key));
  const articleIndex = articleEntries.findIndex(item => item === entry);
  const previewLength = createPlainExcerpt(stripImages(entry.content || entry.summary || ''), 2000).length;

  if (articleEntries.length === 1) return 'secondary-full';
  if (articleIndex < 2) return 'secondary-major';
  if (previewLength > 700) return 'secondary-wide';
  return index % 2 === 0 ? 'secondary-standard' : 'secondary-narrow';
}

function renderDraftPublicationCard(entry, modifier, canEditEntries, releaseDate) {
  const isClassified = isClassifiedSection(entry.section_key);
  const previewText = entry.content || entry.summary || '';
  const excerptHtml = DOMPurify.sanitize(renderMarkdownPreview(stripImages(previewText)));

  return `
    <article class="chronicle-card ${modifier ? `chronicle-card-${modifier}` : ''} ${isClassified ? 'chronicle-card-classified' : ''}">
      <header class="chronicle-card-header">
        <h2>${escapeHtml(entry.section_key)}</h2>
      </header>
      <div class="chronicle-card-body">
        <h3>
          <span class="chronicle-title-link">${escapeHtml(entry.title)}</span>
        </h3>
        ${isClassified ? '' : `
          <div class="article-meta-row">
            <span><i class="fa fa-user"></i> ${escapeHtml(entry.author || 'Unknown')}</span>
            <span><i class="fa fa-calendar"></i> ${formatDate(releaseDate)}</span>
          </div>
        `}
        <div class="chronicle-excerpt markdown-content">${excerptHtml}</div>
      </div>
      ${canEditEntries ? `
        <button type="button" class="draft-entry-edit" data-entry-id="${escapeHtml(entry.id)}">
          <i class="fas fa-pen"></i>
          Edit
        </button>
      ` : ''}
    </article>
  `;
}

function loadEntryForEditing(entryId, elements) {
  const entry = activeEntries.find(item => item.id === entryId);
  if (!entry) return;

  editingEntryId = entry.id;
  elements.entrySectionSelect.value = entry.section_key;
  updateEntryFieldRequirements(elements);
  elements.entryTitleInput.value = entry.title || '';
  setEntrySlug(elements, stripIssuePrefix(entry.slug || '', activePublication.issue_number));
  elements.entrySummaryInput.value = entry.summary || '';
  elements.entryImageUrlInput.value = entry.image_url || '';
  elements.entryThumbnailUrlInput.value = entry.thumbnail_url || '';
  updateThumbnailFieldVisibility(elements);
  elements.entryContentInput.value = entry.content || '';
  elements.entryAuthorInput.value = entry.author || 'Phoenix';
  updateEntryPreview(elements);

  const submitButton = elements.form.querySelector('button[type="submit"]');
  submitButton.innerHTML = '<i class="fas fa-save"></i> Update Entry';
  showMessage(elements.messageEl, `Editing "${entry.title}". Save to update this entry.`, 'info');
}

function refreshCarryOverOptions(elements) {
  if (!elements.carryOverEntrySelect || !elements.carryOverEntryButton) return;

  carryOverEntries = publicationList
    .filter(publication => !activePublication || publication.id !== activePublication.id)
    .flatMap(publication => (publication.publication_entries || []).map(entry => ({ ...entry, publication })))
    .sort((a, b) => {
      const issueSort = (b.publication.issue_number ?? 0) - (a.publication.issue_number ?? 0);
      return issueSort || sortEntries(a, b);
    });

  if (!activePublication) {
    elements.carryOverEntrySelect.innerHTML = '<option value="">Load a publication first</option>';
    elements.carryOverEntryButton.disabled = true;
    return;
  }

  if (!carryOverEntries.length) {
    elements.carryOverEntrySelect.innerHTML = '<option value="">No previous entries available</option>';
    elements.carryOverEntryButton.disabled = true;
    return;
  }

  elements.carryOverEntrySelect.innerHTML = [
    '<option value="">Select an entry to carry over</option>',
    ...carryOverEntries.map(entry => `
      <option value="${escapeHtml(entry.id)}">
        Issue ${escapeHtml(entry.publication.issue_number)} - ${escapeHtml(entry.section_key)} - ${escapeHtml(entry.title)}
      </option>
    `),
  ].join('');
  elements.carryOverEntryButton.disabled = false;
}

function carryOverSelectedEntry(elements) {
  if (!activePublication) {
    showMessage(elements.messageEl, 'Load or create the target publication before carrying over an entry.', 'warning');
    return;
  }

  const sourceEntry = carryOverEntries.find(entry => entry.id === elements.carryOverEntrySelect.value);
  if (!sourceEntry) {
    showMessage(elements.messageEl, 'Select an entry to carry over.', 'warning');
    return;
  }

  editingEntryId = null;
  elements.entrySectionSelect.value = sourceEntry.section_key || CHRONICLE_SECTIONS[0];
  updateEntryFieldRequirements(elements);
  elements.entryTitleInput.value = sourceEntry.title || '';
  setEntrySlug(elements, stripIssuePrefix(sourceEntry.slug || slugify(sourceEntry.title || ''), sourceEntry.publication.issue_number));
  elements.entrySummaryInput.value = sourceEntry.summary || '';
  elements.entryImageUrlInput.value = sourceEntry.image_url || '';
  elements.entryThumbnailUrlInput.value = sourceEntry.thumbnail_url || '';
  updateThumbnailFieldVisibility(elements);
  elements.entryContentInput.value = sourceEntry.content || '';
  elements.entryAuthorInput.value = sourceEntry.author || 'Phoenix';
  updateEntryPreview(elements);
  resetSubmitButton(elements.form.querySelector('button[type="submit"]'));

  showMessage(
    elements.messageEl,
    `Carried over "${sourceEntry.title}" from Issue ${sourceEntry.publication.issue_number}. Review it, then save it to Issue ${activePublication.issue_number}.`,
    'info',
  );
}

function readEntryInput(elements) {
  const title = elements.entryTitleInput.value.trim();
  const content = elements.entryContentInput.value.trim();
  const sectionKey = elements.entrySectionSelect.value;
  return {
    sectionKey,
    title,
    slug: elements.entrySlugInput.value.trim() || slugify(title),
    summary: elements.entrySummaryInput.value.trim() || (isClassifiedSection(sectionKey) ? createPlainExcerpt(content, 180) : ''),
    imageUrl: elements.entryImageUrlInput.value.trim(),
    thumbnailUrl: elements.entryThumbnailUrlInput.value.trim(),
    content,
    author: elements.entryAuthorInput.value.trim() || (isClassifiedSection(sectionKey) ? 'Classifieds' : ''),
  };
}

function validatePublication(issueNumber, releaseDate) {
  validateIssueNumber(issueNumber);
  if (!releaseDate) throw new Error('Publication release date is required.');
}

function validateIssueNumber(issueNumber) {
  if (!issueNumber || issueNumber < 18) throw new Error('Issue number must be 18 or higher.');
}

function validateEntryInput(input) {
  if (!input.sectionKey || !input.title || !input.content) {
    throw new Error('Please fill in all required entry fields.');
  }

  if (!isClassifiedSection(input.sectionKey) && (!input.summary || !input.author)) {
    throw new Error('Please fill in all required entry fields.');
  }
}

function clearEntryFields(elements) {
  elements.entryTitleInput.value = '';
  setEntrySlug(elements, '');
  elements.entrySummaryInput.value = '';
  elements.entryImageUrlInput.value = '';
  elements.entryThumbnailUrlInput.value = '';
  updateThumbnailFieldVisibility(elements);
  elements.entryContentInput.value = '';
  elements.entryAuthorInput.value = 'Phoenix';
  populateSectionSelect(elements.entrySectionSelect);
  updateEntryFieldRequirements(elements);
  updateEntryPreview(elements);
  resetSubmitButton(elements.form.querySelector('button[type="submit"]'));
}

function normalizeMarkdownInput(content) {
  return content
    .replace(/\]\(\((https?:\/\/[^)\s]+)\)\)/g, ']($1)')
    .replace(/\]\(\s+(https?:\/\/[^)\s]+)\s+\)/g, ']($1)');
}

function stripImages(content) {
  return String(content || '').replace(/!\[[^\]]*]\([^)]+\)/g, '').replace(/<img[^>]*>/gi, '');
}

function resetPublicationFields(elements) {
  elements.publicationTitleInput.value = '';
  elements.releaseDateInput.value = '';
  elements.statusSelect.value = '';
  elements.existingPublicationSelect.value = '';
}

function resetSubmitButton(button) {
  if (!button) return;
  button.innerHTML = '<i class="fas fa-plus"></i> Save Entry';
}

function populateSectionSelect(selectElement) {
  selectElement.innerHTML = CHRONICLE_SECTIONS
    .map(section => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`)
    .join('');
}

function updateEntryFieldRequirements(elements) {
  const isClassified = isClassifiedSection(elements.entrySectionSelect.value);
  elements.entrySummaryInput.required = !isClassified;
  elements.entryAuthorInput.required = !isClassified;
  elements.entryImageUrlInput.placeholder = isClassified
    ? 'Optional; classifieds usually do not need media'
    : 'Image, YouTube, or video URL';
  elements.entrySummaryInput.placeholder = isClassified
    ? 'Optional; the card uses the classified text directly'
    : '';
}

function isClassifiedSection(section) {
  return String(section).toLowerCase() === 'classifieds';
}

function createPlainExcerpt(content, maxLength) {
  const plainText = normalizeMarkdownInput(content || '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.length > maxLength ? `${plainText.slice(0, maxLength).trim()}...` : plainText;
}

function sortEntries(a, b) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.title || '').localeCompare(b.title || '');
}

function getPublicationTitle(elements) {
  const issueNumber = Number(elements.issueNumberInput.value);
  return elements.publicationTitleInput.value.trim() || `Issue ${issueNumber}`;
}

function getLocalDateValue(date) {
  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().slice(0, 10);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${dateValue}T12:00:00`));
}

function stripIssuePrefix(slug, issueNumber) {
  const prefix = `${issueNumber}-`;
  return slug.startsWith(prefix) ? slug.slice(prefix.length) : slug;
}

function showMessage(messageElement, message, type) {
  messageElement.textContent = message;
  messageElement.className = '';
  if (!message) {
    messageElement.classList.add('hidden');
    return;
  }

  messageElement.classList.add('form-message', type);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clearPublicationCache() {
  sessionStorage.removeItem('paxDeiPublications');
  sessionStorage.removeItem('paxDeiPublications:v2');
}
