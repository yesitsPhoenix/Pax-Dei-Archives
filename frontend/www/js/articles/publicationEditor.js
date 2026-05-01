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
];

let activePublication = null;
let activeEntries = [];
let editingEntryId = null;
let publicationList = [];
let carryOverEntries = [];

document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await requirePublicationEditorAccess();
  if (!hasAccess) return;

  const elements = getElements();
  populateSectionSelect(elements.entrySectionSelect);
  resetPublicationFields(elements);
  setupMarkdownEditor(elements);

  elements.entryTitleInput.addEventListener('input', () => {
    elements.entrySlugInput.value = slugify(elements.entryTitleInput.value);
  });

  elements.loadPublicationButton.addEventListener('click', () => loadPublicationByIssue(elements));
  elements.loadSelectedPublicationButton.addEventListener('click', () => loadSelectedPublication(elements));
  elements.newPublicationButton.addEventListener('click', () => startNewPublication(elements));
  elements.clearPublicationButton.addEventListener('click', () => clearLoadedPublication(elements));
  elements.savePublicationButton.addEventListener('click', () => savePublicationDraft(elements));
  elements.publishButton.addEventListener('click', () => publishActivePublication(elements));
  elements.carryOverEntryButton.addEventListener('click', () => carryOverSelectedEntry(elements));
  elements.form.addEventListener('submit', event => saveEntryToDraft(event, elements));

  elements.issueNumberInput.addEventListener('input', () => resetActivePublication(elements, { clearPublicationFields: true }));

  elements.issueNumberInput.value = await getNextIssueNumber();
  await loadPublicationList(elements);
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
    entrySummaryInput: document.getElementById('entrySummary'),
    entryImageUrlInput: document.getElementById('entryImageUrl'),
    entryContentInput: document.getElementById('entryContent'),
    entryContentSplitInput: document.getElementById('entryContentSplit'),
    markdownTabs: document.querySelectorAll('[data-markdown-mode]'),
    markdownEditMode: document.getElementById('entryMarkdownEditMode'),
    markdownPreviewMode: document.getElementById('entryMarkdownPreviewMode'),
    markdownSplitMode: document.getElementById('entryMarkdownSplitMode'),
    markdownPreview: document.getElementById('entryMarkdownPreview'),
    markdownPreviewSplit: document.getElementById('entryMarkdownPreviewSplit'),
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

  elements.markdownTabs.forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      switchMarkdownMode(elements, button.dataset.markdownMode || 'edit');
    });
  });

  elements.entryContentInput.addEventListener('input', () => {
    if (!elements.markdownSplitMode.hidden) {
      elements.entryContentSplitInput.value = elements.entryContentInput.value;
    }
    updateMarkdownPreview(elements);
  });

  elements.entryContentSplitInput.addEventListener('input', () => {
    elements.entryContentInput.value = elements.entryContentSplitInput.value;
    updateMarkdownPreview(elements);
  });

  updateMarkdownPreview(elements);
}

function switchMarkdownMode(elements, mode) {
  elements.markdownTabs.forEach(button => {
    button.classList.toggle('active', button.dataset.markdownMode === mode);
    button.setAttribute('aria-selected', String(button.dataset.markdownMode === mode));
  });

  setMarkdownPanelVisible(elements.markdownEditMode, mode === 'edit');
  setMarkdownPanelVisible(elements.markdownPreviewMode, mode === 'preview');
  setMarkdownPanelVisible(elements.markdownSplitMode, mode === 'split');

  if (mode === 'split') {
    elements.entryContentSplitInput.value = elements.entryContentInput.value;
  } else if (mode === 'edit') {
    elements.entryContentInput.focus();
  }

  updateMarkdownPreview(elements);
}

function setMarkdownPanelVisible(panel, isVisible) {
  panel.hidden = !isVisible;
  panel.classList.toggle('hidden', !isVisible);
}

function updateMarkdownPreview(elements) {
  const html = renderMarkdownPreview(elements.entryContentInput.value);
  elements.markdownPreview.innerHTML = html;
  elements.markdownPreviewSplit.innerHTML = html;
}

function renderMarkdownPreview(content) {
  const source = normalizeMarkdownInput(replaceEmojiShortcodes(content || ''));
  if (!source.trim()) {
    return '<p class="publication-preview-empty">Markdown preview will appear here.</p>';
  }

  const parsed = window.marked ? marked.parse(source) : escapeHtml(source).replace(/\n/g, '<br>');
  return DOMPurify.sanitize(parsed);
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
    showMessage(elements.messageEl, `Issue ${activePublication.issue_number} published.`, 'success');
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
    content: entry.content,
    author: entry.author,
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

  elements.draftTitle.textContent = publication ? `Issue ${publication.issue_number}: ${title}` : 'No Publication Loaded';
  elements.draftMeta.textContent = publication
    ? `${formatDate(releaseDate)} - ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} queued`
    : 'Create or load an issue to begin.';
  elements.draftStatus.textContent = status;
  elements.draftStatus.className = `publication-status-pill ${status}`;

  if (!entries.length) {
    elements.draftEntryList.innerHTML = '<div class="empty-draft-state">Saved entries for the selected issue will appear here.</div>';
  } else {
    elements.draftEntryList.innerHTML = entries.map(entry => `
      <article class="draft-entry-item">
        <div>
          <span>${escapeHtml(entry.section_key)}</span>
          <strong>${escapeHtml(entry.title)}</strong>
          <small>${escapeHtml(entry.author || 'Unknown')}</small>
        </div>
        ${canEditEntries ? `
          <button type="button" class="draft-entry-edit" data-entry-id="${escapeHtml(entry.id)}">
            <i class="fas fa-pen"></i>
            Edit
          </button>
        ` : ''}
      </article>
    `).join('');

    elements.draftEntryList.querySelectorAll('.draft-entry-edit').forEach(button => {
      button.addEventListener('click', () => loadEntryForEditing(button.dataset.entryId, elements));
    });
  }

  elements.publishButton.disabled = !publication || !entries.length || status === 'published' || status === 'archived';
  elements.savePublicationButton.innerHTML = publication
    ? '<i class="fas fa-save"></i> Save Publication'
    : '<i class="fas fa-save"></i> Save Publication Draft';
}

function loadEntryForEditing(entryId, elements) {
  const entry = activeEntries.find(item => item.id === entryId);
  if (!entry) return;

  editingEntryId = entry.id;
  elements.entrySectionSelect.value = entry.section_key;
  elements.entryTitleInput.value = entry.title || '';
  elements.entrySlugInput.value = stripIssuePrefix(entry.slug || '', activePublication.issue_number);
  elements.entrySummaryInput.value = entry.summary || '';
  elements.entryImageUrlInput.value = entry.image_url || '';
  elements.entryContentInput.value = entry.content || '';
  elements.entryContentSplitInput.value = entry.content || '';
  elements.entryAuthorInput.value = entry.author || '';
  switchMarkdownMode(elements, 'edit');
  updateMarkdownPreview(elements);

  const submitButton = elements.form.querySelector('button[type="submit"]');
  submitButton.innerHTML = '<i class="fas fa-save"></i> Update Entry';
  elements.entryTitleInput.focus();
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
  elements.entryTitleInput.value = sourceEntry.title || '';
  elements.entrySlugInput.value = stripIssuePrefix(sourceEntry.slug || slugify(sourceEntry.title || ''), sourceEntry.publication.issue_number);
  elements.entrySummaryInput.value = sourceEntry.summary || '';
  elements.entryImageUrlInput.value = sourceEntry.image_url || '';
  elements.entryContentInput.value = sourceEntry.content || '';
  elements.entryContentSplitInput.value = sourceEntry.content || '';
  elements.entryAuthorInput.value = sourceEntry.author || '';
  switchMarkdownMode(elements, 'edit');
  updateMarkdownPreview(elements);
  resetSubmitButton(elements.form.querySelector('button[type="submit"]'));

  showMessage(
    elements.messageEl,
    `Carried over "${sourceEntry.title}" from Issue ${sourceEntry.publication.issue_number}. Review it, then save it to Issue ${activePublication.issue_number}.`,
    'info',
  );
}

function readEntryInput(elements) {
  const title = elements.entryTitleInput.value.trim();
  return {
    sectionKey: elements.entrySectionSelect.value,
    title,
    slug: elements.entrySlugInput.value.trim() || slugify(title),
    summary: elements.entrySummaryInput.value.trim(),
    imageUrl: elements.entryImageUrlInput.value.trim(),
    content: elements.entryContentInput.value.trim(),
    author: elements.entryAuthorInput.value.trim(),
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
  if (!input.sectionKey || !input.title || !input.summary || !input.content || !input.author) {
    throw new Error('Please fill in all required entry fields.');
  }
}

function clearEntryFields(elements) {
  elements.entryTitleInput.value = '';
  elements.entrySlugInput.value = '';
  elements.entrySummaryInput.value = '';
  elements.entryImageUrlInput.value = '';
  elements.entryContentInput.value = '';
  elements.entryContentSplitInput.value = '';
  elements.entryAuthorInput.value = '';
  populateSectionSelect(elements.entrySectionSelect);
  switchMarkdownMode(elements, 'edit');
  updateMarkdownPreview(elements);
  resetSubmitButton(elements.form.querySelector('button[type="submit"]'));
}

function normalizeMarkdownInput(content) {
  return content
    .replace(/\]\(\((https?:\/\/[^)\s]+)\)\)/g, ']($1)')
    .replace(/\]\(\s+(https?:\/\/[^)\s]+)\s+\)/g, ']($1)');
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
