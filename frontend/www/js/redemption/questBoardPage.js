import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.3/dist/purify.es.min.js';
import { questState } from './questStateManager.js';
import { boardQuestState } from './boardQuestState.js';
import {
    acceptBoardQuest,
    cancelBoardQuest,
    confirmBoardQuestCompletion,
    rejectBoardQuestCompletion,
    reportBoardQuest,
    submitBoardQuestCompletion,
    validateBoardQuestAcceptance,
    withdrawBoardQuestAcceptance,
} from './boardQuestService.js';
import { isBoardQuestExpired } from './boardQuestFilters.js';

const el = {};
const PAGE_SIZE = 12;
let currentBoardTab = 'available';
let currentPage = 1;
let pendingActionModalResolve = null;
const ACTION_MODAL_CANCELLED = Symbol('action-modal-cancelled');
let filterOptionCacheKey = '';
let filterOptionCache = createFilterOptionCache();

function createFilterOptionCache() {
    return {
        categories: new Set(),
        provinces: new Set(),
        homeValleysByProvince: new Map(),
    };
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
    if (!value) return 'No expiry';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function formatStatusLabel(status = '') {
    if (status === 'filled') return 'Filled';
    return status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function isBoardQuestFilled(post) {
    if (post?.participation_mode === 'open') return false;
    return !post?.currentCharacterAcceptance && Number(post?.activeAcceptanceCount || 0) > 0;
}

function isOpenParticipation(post) {
    return post?.participation_mode === 'open';
}

function getParticipationLabel(post) {
    const count = Number(post?.activeAcceptanceCount || 0);
    if (isOpenParticipation(post)) {
        return count === 1 ? '1 participating' : `${count} participating`;
    }
    return count === 1 ? '1 accepted' : 'Single participant';
}

function getBoardQuestDisplayStatus(post) {
    if (isBoardQuestExpired(post)) return 'expired';
    if (post?.currentCharacterAcceptance?.status) return post.currentCharacterAcceptance.status;
    if (isBoardQuestFilled(post)) return 'filled';
    return post?.status || 'posted';
}

function showToast(message, type = '') {
    if (!el.toastWrap) return;
    const toast = document.createElement('div');
    toast.className = `board-toast ${type}`.trim();
    toast.textContent = message;
    el.toastWrap.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4200);
}

function getActiveCharacter() {
    return questState.getActiveCharacter();
}

function getActiveUser() {
    return questState.getUser();
}

function isSignedIn() {
    return Boolean(getActiveUser());
}

function getCharacterRegion(character) {
    return character?.region || character?.region_name || '';
}

function buildCharacterLocationLine(character) {
    return [
        getCharacterRegion(character),
        character?.shard || '',
        character?.province || '',
    ].filter(Boolean).join(' / ');
}

function updateUrlForPost(postId = null) {
    const url = new URL(window.location.href);
    if (postId) url.searchParams.set('post', postId);
    else url.searchParams.delete('post');
    window.history.replaceState({}, '', url);
}

function toSafeExternalUrl(value = '') {
    try {
        const url = new URL(String(value).trim());
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function getPostsForTab(tab, posts = boardQuestState.getSnapshot().boardPosts) {
    const activeCharacter = getActiveCharacter();

    switch (tab) {
        case 'completed':
            return boardQuestState.getSnapshot().completedContracts || [];
        case 'accepted':
            return posts.filter((post) => Boolean(post.currentCharacterAcceptance));
        case 'posted':
            if (!activeCharacter?.character_id) return [];
            return posts.filter((post) => post.author_character_id === activeCharacter.character_id);
        case 'available':
        default:
            return posts.filter((post) => {
                const isOwnPost = activeCharacter?.character_id && post.author_character_id === activeCharacter.character_id;
                return !post.currentCharacterAcceptance && !isOwnPost;
            });
    }
}

function getVisiblePosts(posts = boardQuestState.getSnapshot().boardPosts) {
    return getPostsForTab(currentBoardTab, posts);
}

function getTabLabel() {
    switch (currentBoardTab) {
        case 'completed':
            return 'completed contracts';
        case 'accepted':
            return 'accepted contracts';
        case 'posted':
            return 'posted contracts';
        case 'available':
        default:
            return 'available contracts';
    }
}

function getTabTitle() {
    switch (currentBoardTab) {
        case 'completed':
            return 'Completed Contracts';
        case 'accepted':
            return 'Accepted Contracts';
        case 'posted':
            return 'Posted Contracts';
        case 'available':
        default:
            return 'Available Contracts';
    }
}

function syncBoardTabs() {
    el.tabButtons.forEach((button) => {
        const isActive = button.getAttribute('data-board-tab') === currentBoardTab;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (el.feedTitle) {
        el.feedTitle.innerHTML = `<i class="fa-solid fa-thumbtack"></i>${escapeHtml(getTabTitle())}`;
    }
}

function resetPagination() {
    currentPage = 1;
}

function renderPagination(totalItems = 0) {
    if (!el.pagination) return;

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) {
        el.pagination.innerHTML = '';
        return;
    }

    el.pagination.innerHTML = `
        <button type="button" class="board-page-btn" data-page-action="prev" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i> Previous
        </button>
        <span class="board-page-status">Page ${currentPage} of ${totalPages}</span>
        <button type="button" class="board-page-btn" data-page-action="next" ${currentPage === totalPages ? 'disabled' : ''}>
            Next <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    el.pagination.querySelectorAll('[data-page-action]').forEach((button) => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-page-action');
            currentPage = action === 'next'
                ? Math.min(totalPages, currentPage + 1)
                : Math.max(1, currentPage - 1);
            renderFeed(boardQuestState.getSnapshot().boardPosts);
        });
    });
}

function inferTabForPost(post) {
    const activeCharacter = getActiveCharacter();
    if (!post) return currentBoardTab;
    if (post.currentCharacterAcceptance) return 'accepted';
    if (activeCharacter?.character_id && post.author_character_id === activeCharacter.character_id) return 'posted';
    return 'available';
}

function getContractCardTitle(contract = {}) {
    return contract.quest_name || contract.title || contract.contract_title || 'Untitled Contract';
}

function getContractCardCategory(contract = {}) {
    return contract.category || contract.player_contract_category || contract.contract_category || 'Player Contract';
}

function getContractCardPostId(contract = {}) {
    return contract.board_quest_id || null;
}

function getContractFamilyVisual(category = '') {
    const normalized = String(category || '').toLowerCase();

    if (normalized.includes('settlement')) {
        return { key: 'settlement', icon: 'fa-hammer', label: 'Settlement Work' };
    }
    if (normalized.includes('hunt') || normalized.includes('expedition')) {
        return { key: 'hunts', icon: 'fa-paw', label: 'Hunts & Expeditions' };
    }
    if (normalized.includes('trade') || normalized.includes('delivery')) {
        return { key: 'trade', icon: 'fa-cart-flatbed', label: 'Trade & Delivery' };
    }
    if (normalized.includes('request') || normalized.includes('help')) {
        return { key: 'requests', icon: 'fa-handshake-angle', label: 'Requests & Help' };
    }
    if (normalized.includes('event') || normalized.includes('gather')) {
        return { key: 'events', icon: 'fa-champagne-glasses', label: 'Events & Gatherings' };
    }

    return { key: 'general', icon: 'fa-scroll', label: category || 'Player Contract' };
}

function renderContractFamilyVisual(category = '') {
    const visual = getContractFamilyVisual(category);
    return `
        <div class="notice-family-strip family-${escapeHtml(visual.key)}">
            <div class="notice-family-icon"><i class="fa-solid ${escapeHtml(visual.icon)}"></i></div>
            <div class="notice-family-copy">
                <div class="notice-card-kicker">Contract Family</div>
                <div class="notice-family-label">${escapeHtml(visual.label)}</div>
            </div>
        </div>
    `;
}

function renderCharacterCard() {
    const user = getActiveUser();
    const activeCharacter = getActiveCharacter();
    const characters = questState.getCharacters();

    if (!user) {
        el.characterCard.innerHTML = `
            <div class="board-char-name">Traveler Required</div>
            <p class="board-char-meta" style="margin-top:0.55rem;">Sign in with Discord to accept contracts, report posts, and filter the board around one of your characters.</p>
        `;
        el.characterSelectWrap.classList.add('hidden');
        return;
    }

    el.characterSelectWrap.classList.remove('hidden');
    el.characterSelect.innerHTML = characters.map((character) => `
        <option value="${escapeHtml(character.character_id)}"${character.character_id === activeCharacter?.character_id ? ' selected' : ''}>
            ${escapeHtml(character.character_name)}
        </option>
    `).join('');

    if (!activeCharacter) {
        el.characterCard.innerHTML = `
            <div class="board-char-name">No Active Character</div>
            <p class="board-char-meta" style="margin-top:0.55rem;">Choose a character before reviewing contracts.</p>
        `;
        return;
    }

    el.characterCard.innerHTML = `
        <p class="board-char-meta" style="margin-bottom:0.55rem;">Contracts are filtered to reachable region and shard.</p>
    `;
}

function renderBanner() {
    const activeCharacter = getActiveCharacter();

    if (el.bannerCharacterName) {
        el.bannerCharacterName.textContent = activeCharacter?.character_name || 'Contracts';
    }

    if (el.bannerCharacterSubtitle) {
        el.bannerCharacterSubtitle.textContent = activeCharacter
            ? 'Contract Board'
            : 'Choose a character to view reachable contracts';
    }
}

function renderAcceptedContracts() {
    const contracts = boardQuestState.getSnapshot().acceptedContracts || [];
    el.heroAcceptedCount.textContent = String(contracts.length);

    if (!el.acceptedContracts) return;
    el.acceptedContracts.innerHTML = '';

    if (!contracts.length) {
        el.acceptedContracts.innerHTML = `<div class="board-muted-copy">No accepted contracts for the current character yet.</div>`;
        return;
    }

    el.acceptedContracts.innerHTML = `<div class="board-contract-list">${contracts.slice(0, 4).map((contract) => `
        <div class="board-contract-item">
            <button type="button" data-post-link="${escapeHtml(contract.board_quest_id)}">
                <div style="display:flex;justify-content:space-between;gap:0.75rem;align-items:start;">
                    <div>
                        <div style="font-weight:700;color:#f7ead7;">${escapeHtml(contract.quest_name)}</div>
                        <div class="board-muted-copy" style="margin-top:0.25rem;">${escapeHtml(contract.category || 'Player Contract')}</div>
                    </div>
                    <span class="board-status-pill board-status-${escapeHtml(contract.status)}">${escapeHtml(formatStatusLabel(contract.status))}</span>
                </div>
            </button>
        </div>
    `).join('')}</div>`;

    el.acceptedContracts.querySelectorAll('[data-post-link]').forEach((button) => {
        button.addEventListener('click', async () => {
            await selectPost(button.getAttribute('data-post-link'));
        });
    });
}

function buildPostLocation(post) {
    return [post.posting_region, post.posting_shard, post.posting_province, post.posting_home_valley]
        .filter(Boolean)
        .join(' / ') || 'Anywhere';
}

function renderFeed(posts = []) {
    const visiblePosts = getVisiblePosts(posts);
    const isCompletedTab = currentBoardTab === 'completed';
    el.feedCount.textContent = `${visiblePosts.length} ${getTabLabel()}`;
    el.heroOpenCount.textContent = String(getPostsForTab('available', posts).filter((post) => !isBoardQuestFilled(post)).length);
    syncBoardTabs();
    renderBanner();

    const totalPages = Math.max(1, Math.ceil(visiblePosts.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = visiblePosts.slice(pageStart, pageStart + PAGE_SIZE);

    if (!visiblePosts.length) {
        const emptyLabel = currentBoardTab === 'completed'
            ? 'No completed contracts in this character history yet.'
            : currentBoardTab === 'accepted'
                ? 'No accepted contracts match the current filters.'
                : currentBoardTab === 'posted'
                    ? 'No posted contracts match the current filters.'
                    : 'No contracts match the current filters.';
        el.feedGrid.innerHTML = `
            <div class="board-empty-state">
                <i class="fa-solid fa-scroll"></i>
                ${emptyLabel}
            </div>
        `;
        renderPagination(0);
        return;
    }

    const snapshot = boardQuestState.getSnapshot();
    const activePostId = snapshot.activePostId;
    if (isCompletedTab) {
        el.feedGrid.innerHTML = pagePosts.map((contract) => {
            const postId = getContractCardPostId(contract);
            const title = getContractCardTitle(contract);
            const category = getContractCardCategory(contract);
            const completedAt = contract.completed_at || contract.confirmed_at;
            const status = contract.status || 'completed';
            const subtitle = contract.completion_note || contract.reward_note || 'Completed contract history for this character.';
            return `
                <button type="button" class="notice-card completed-history-card ${postId === activePostId ? 'is-active' : ''}" ${postId ? `data-completed-post-id="${escapeHtml(postId)}"` : 'aria-disabled="true"'}>
                    ${renderContractFamilyVisual(category)}
                    <div class="notice-card-head">
                        <div class="notice-card-kicker">Completed</div>
                        <h3 class="notice-card-title">${escapeHtml(title)}</h3>
                        <p class="notice-card-subtitle">${escapeHtml(subtitle.slice(0, 160))}</p>
                    </div>
                    <div class="notice-card-meta">
                        <span class="notice-paper-pill">${escapeHtml(category)}</span>
                        <span class="notice-paper-pill"><i class="fa-solid fa-calendar-check"></i>${escapeHtml(formatDateTime(completedAt))}</span>
                    </div>
                    <div class="notice-card-footer">
                        <div>
                            <div class="notice-card-kicker">Posted By</div>
                            <div class="notice-master">${escapeHtml(contract.author_character_name || contract.poster_character_name || 'Unknown')}</div>
                        </div>
                        <div class="notice-card-status">
                            <span class="board-status-pill board-status-${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');

        el.feedGrid.querySelectorAll('[data-completed-post-id]').forEach((button) => {
            button.addEventListener('click', async () => {
                await selectCompletedPost(button.getAttribute('data-completed-post-id'));
            });
        });
        renderPagination(visiblePosts.length);
        return;
    }

    el.feedGrid.innerHTML = pagePosts.map((post) => {
        const status = getBoardQuestDisplayStatus(post);
        const subtitle = post.summary || post.body_markdown || 'Pinned by a fellow traveler looking for hands, supplies, or steel.';
        const pendingCount = Number(post.pendingConfirmationCount || 0);
        const needsPosterReview = currentBoardTab === 'posted' && pendingCount > 0;
        const category = post.player_contract_category || 'Player Contract';
        return `
            <button type="button" class="notice-card ${post.id === activePostId ? 'is-active' : ''} ${needsPosterReview ? 'needs-review' : ''}" data-post-id="${escapeHtml(post.id)}">
                ${needsPosterReview ? `
                    <div class="notice-review-badge">
                        <i class="fa-solid fa-bell"></i>
                        ${pendingCount} completion${pendingCount === 1 ? '' : 's'} to review
                    </div>
                ` : ''}
                ${renderContractFamilyVisual(category)}
                <div class="notice-card-head">
                    <div class="notice-card-kicker">${escapeHtml(post.post_type.replace(/_/g, ' '))}</div>
                    <h3 class="notice-card-title">${escapeHtml(post.title)}</h3>
                    <p class="notice-card-subtitle">${escapeHtml(subtitle.slice(0, 160))}</p>
                </div>
                <div class="notice-card-meta">
                    <span class="notice-paper-pill">${escapeHtml(category)}</span>
                    <span class="notice-paper-pill"><i class="fa-solid fa-users"></i>${escapeHtml(getParticipationLabel(post))}</span>
                    <span class="notice-paper-pill"><i class="fa-solid fa-location-dot"></i>${escapeHtml(buildPostLocation(post))}</span>
                </div>
                <div class="notice-card-footer">
                    <div>
                        <div class="notice-card-kicker">Posted By</div>
                        <div class="notice-master">${escapeHtml(post.author_character_name || 'Unknown')}</div>
                    </div>
                    <div class="notice-card-status">
                        <span class="board-status-pill board-status-${escapeHtml(status)}">${escapeHtml(formatStatusLabel(status))}</span>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    el.feedGrid.querySelectorAll('[data-post-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            await selectPost(button.getAttribute('data-post-id'));
        });
    });
    renderPagination(visiblePosts.length);
}

function renderGoals(post) {
    if (!post.tracking_goals?.length) {
        return `<div class="board-muted-copy">This contract has no tracked checklist items yet.</div>`;
    }

    return `
        <div class="board-goal-list">
            ${post.tracking_goals.map((goal) => `
                <div class="board-goal-item">
                    <div class="board-goal-icon"><i class="fa-solid ${goal.type === 'checkbox' ? 'fa-check' : 'fa-list-ol'}"></i></div>
                    <div>
                        <div style="font-weight:700;color:#f7ead7;">${escapeHtml(goal.label)}</div>
                        <div class="board-muted-copy">${goal.type === 'checkbox'
                            ? 'Single completion objective'
                            : `Target ${escapeHtml(goal.target || 1)}${goal.unit ? ` ${escapeHtml(goal.unit)}` : ''}`}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPendingConfirmations(post) {
    const pending = Array.isArray(post.pendingConfirmations) ? post.pendingConfirmations : [];
    if (!pending.length) return '';

    return `
        <div class="board-modal-section">
            <div class="board-section-title"><i class="fa-solid fa-stamp"></i>Awaiting Poster Confirmation</div>
            <div class="board-confirmation-list">
                ${pending.map((acceptance) => {
                    const proofUrl = toSafeExternalUrl(acceptance.proof_url);
                    return `
                        <div class="board-confirmation-item">
                            <div class="board-confirmation-main">
                                <div class="board-confirmation-title">${escapeHtml(acceptance.character_name || 'Unknown Character')}</div>
                                <div class="board-muted-copy">Submitted ${escapeHtml(formatDateTime(acceptance.submitted_at))}</div>
                                ${acceptance.completion_note ? `<p>${escapeHtml(acceptance.completion_note)}</p>` : ''}
                                ${acceptance.proof_note ? `<p class="board-muted-copy">${escapeHtml(acceptance.proof_note)}</p>` : ''}
                                ${proofUrl ? `<a class="board-confirmation-link" href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener noreferrer">View proof link</a>` : ''}
                            </div>
                            <div class="board-confirmation-actions">
                                <button class="board-btn board-btn-primary" data-board-action="confirm-completion" data-acceptance-id="${escapeHtml(acceptance.id)}">
                                    <i class="fa-solid fa-check-double"></i>Confirm Completion
                                </button>
                                <button class="board-btn board-btn-danger" data-board-action="reject-completion" data-acceptance-id="${escapeHtml(acceptance.id)}">
                                    <i class="fa-solid fa-circle-xmark"></i>Reject Completion
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderAcceptanceReviewNotice(post) {
    const acceptance = post.currentCharacterAcceptance;
    if (!acceptance?.completion_rejection_reason) return '';

    return `
        <div class="board-review-notice">
            <div class="board-section-title"><i class="fa-solid fa-triangle-exclamation"></i>Completion Needs Revision</div>
            <p>${escapeHtml(acceptance.completion_rejection_reason)}</p>
            <div class="board-muted-copy">Rejected ${escapeHtml(formatDateTime(acceptance.completion_rejected_at))}. Update your completion note and submit again when ready.</div>
        </div>
    `;
}

function renderMarkdown(markdown = '') {
    if (!markdown) return '<p class="board-muted-copy">No additional details were posted on this notice.</p>';
    const parsed = window.marked ? window.marked.parse(markdown) : escapeHtml(markdown).replace(/\n/g, '<br>');
    return DOMPurify.sanitize(parsed);
}

function renderActionButtons(post) {
    const acceptance = post.currentCharacterAcceptance;
    const signedIn = isSignedIn();
    const expired = isBoardQuestExpired(post);
    const filled = isBoardQuestFilled(post);
    const isOwnPost = getActiveCharacter()?.character_id && getActiveCharacter().character_id === post.author_character_id;
    const canManagePost = signedIn && isOwnPost && post.status === 'posted';
    const buttons = [];

    if (acceptance) {
        if (acceptance.status === 'accepted' || acceptance.status === 'in_progress') {
            buttons.push(`<button class="board-btn board-btn-primary" data-board-action="submit" data-acceptance-id="${escapeHtml(acceptance.id)}"><i class="fa-solid fa-flag-checkered"></i>Submit Completion</button>`);
            buttons.push(`<button class="board-btn board-btn-danger" data-board-action="withdraw" data-acceptance-id="${escapeHtml(acceptance.id)}"><i class="fa-solid fa-arrow-rotate-left"></i>Withdraw</button>`);
        }
    } else if (isOwnPost) {
        buttons.push(`<button class="board-btn board-btn-primary" data-board-action="edit" data-post-id="${escapeHtml(post.id)}" ${canManagePost ? '' : 'disabled'}><i class="fa-solid fa-pen-to-square"></i>Edit Contract</button>`);
        buttons.push(`<button class="board-btn board-btn-danger" data-board-action="cancel-post" data-post-id="${escapeHtml(post.id)}" ${canManagePost ? '' : 'disabled'}><i class="fa-solid fa-ban"></i>Cancel Contract</button>`);
    } else {
        const acceptDisabled = !signedIn || expired || filled;
        const acceptLabel = !signedIn ? 'Login To Accept' : expired ? 'Expired' : filled ? 'Filled' : 'Accept Contract';
        buttons.push(`<button class="board-btn board-btn-primary" data-board-action="accept" data-post-id="${escapeHtml(post.id)}" ${acceptDisabled ? 'disabled' : ''}><i class="fa-solid fa-handshake-angle"></i>${escapeHtml(acceptLabel)}</button>`);
    }

    buttons.push(`<button class="board-btn" data-board-action="share" data-post-id="${escapeHtml(post.id)}"><i class="fa-solid fa-link"></i>Copy Link</button>`);
    if (!isOwnPost) {
        buttons.push(`<button class="board-btn" data-board-action="report" data-post-id="${escapeHtml(post.id)}" ${signedIn ? '' : 'disabled'}><i class="fa-solid fa-flag"></i>Report</button>`);
    }
    return `<div class="board-action-row">${buttons.join('')}</div>`;
}

function closeActionModal(result = ACTION_MODAL_CANCELLED) {
    if (!el.actionModal) return;
    el.actionModal.classList.remove('is-open');
    el.actionModal.setAttribute('aria-hidden', 'true');
    el.actionFields.innerHTML = '';

    if (pendingActionModalResolve) {
        pendingActionModalResolve(result);
        pendingActionModalResolve = null;
    }
}

function openActionModal(config = {}) {
    return new Promise((resolve) => {
        pendingActionModalResolve = resolve;
        el.actionTitle.textContent = config.title || 'Contract Action';
        el.actionCopy.textContent = config.copy || '';
        el.actionSubmit.textContent = config.submitLabel || 'Submit';
        el.actionFields.innerHTML = (config.fields || []).map((field) => `
            <div class="board-field">
                <label class="board-label" for="board-action-field-${escapeHtml(field.name)}">${escapeHtml(field.label)}</label>
                ${field.type === 'textarea'
                    ? `<textarea id="board-action-field-${escapeHtml(field.name)}" class="board-input board-action-textarea" data-action-field="${escapeHtml(field.name)}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(field.placeholder || '')}"></textarea>`
                    : `<input id="board-action-field-${escapeHtml(field.name)}" class="board-input" data-action-field="${escapeHtml(field.name)}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(field.placeholder || '')}">`}
            </div>
        `).join('');
        el.actionModal.classList.add('is-open');
        el.actionModal.setAttribute('aria-hidden', 'false');
        el.actionFields.querySelector('[data-action-field]')?.focus();
    });
}

function collectActionModalValues() {
    return Array.from(el.actionFields.querySelectorAll('[data-action-field]')).reduce((values, field) => {
        values[field.getAttribute('data-action-field')] = field.value.trim();
        return values;
    }, {});
}

function attachDetailActions(post) {
    const root = el.modalBody || el.feedGrid;
    root.querySelectorAll('[data-board-action]').forEach((button) => {
        button.addEventListener('click', async () => {
            const action = button.getAttribute('data-board-action');
            const postId = button.getAttribute('data-post-id') || post.id;
            const acceptanceId = button.getAttribute('data-acceptance-id');

            try {
                if (action === 'accept') {
                    const validation = await validateBoardQuestAcceptance(postId);
                    if (!validation.can_accept) {
                        showToast(`This contract can't be accepted right now: ${validation.reason}.`, 'error');
                        return;
                    }
                    await acceptBoardQuest(postId);
                    showToast('Contract accepted.');
                } else if (action === 'edit') {
                    window.location.href = `post_contract.html?edit=${encodeURIComponent(postId)}`;
                    return;
                } else if (action === 'cancel-post') {
                    const values = await openActionModal({
                        title: 'Cancel Contract',
                        copy: 'Cancel this posted contract. Existing acceptances will no longer appear as active board work.',
                        submitLabel: 'Cancel Contract',
                    });
                    if (values === ACTION_MODAL_CANCELLED) return;
                    await cancelBoardQuest(postId);
                    showToast('Contract cancelled.');
                } else if (action === 'withdraw') {
                    const values = await openActionModal({
                        title: 'Withdraw Contract',
                        copy: 'Optionally leave a short note for your records or the poster.',
                        submitLabel: 'Withdraw',
                        fields: [
                            { name: 'reason', label: 'Withdrawal Note', type: 'textarea', placeholder: 'Optional reason...' },
                        ],
                    });
                    if (values === ACTION_MODAL_CANCELLED) return;
                    const reason = values.reason || null;
                    await withdrawBoardQuestAcceptance(acceptanceId, reason);
                    showToast('Acceptance withdrawn.');
                } else if (action === 'submit') {
                    const values = await openActionModal({
                        title: 'Submit Completion',
                        copy: post.proof_mode === 'self_complete'
                            ? 'Mark this contract complete and leave a short completion note for your records.'
                            : 'Send the poster a completion note. The poster can confirm or reject it from their Posted tab.',
                        submitLabel: 'Submit Completion',
                        fields: [
                            { name: 'completionNote', label: 'Completion Note', type: 'textarea', required: true, placeholder: 'What did you complete?' },
                        ],
                    });
                    if (values === ACTION_MODAL_CANCELLED) return;
                    await submitBoardQuestCompletion(acceptanceId, {
                        completionNote: values.completionNote || '',
                    });
                    showToast('Completion submitted.');
                } else if (action === 'confirm-completion') {
                    const values = await openActionModal({
                        title: 'Confirm Completion',
                        copy: 'Mark this submitted contract as complete. This records your confirmation as the poster.',
                        submitLabel: 'Confirm Completion',
                    });
                    if (values === ACTION_MODAL_CANCELLED) return;
                    await confirmBoardQuestCompletion(acceptanceId);
                    showToast('Completion confirmed.');
                } else if (action === 'reject-completion') {
                    const values = await openActionModal({
                        title: 'Reject Completion',
                        copy: 'Send the contract back for revision. The reason will be visible to the character who submitted it.',
                        submitLabel: 'Reject Completion',
                        fields: [
                            { name: 'reason', label: 'Rejection Reason', type: 'textarea', required: true, placeholder: 'What needs to be fixed before this can be completed?' },
                        ],
                    });
                    if (values === ACTION_MODAL_CANCELLED || !values?.reason) return;
                    await rejectBoardQuestCompletion(acceptanceId, values.reason);
                    showToast('Completion rejected.');
                } else if (action === 'share') {
                    const shareUrl = new URL(window.location.href);
                    shareUrl.searchParams.set('post', postId);
                    await navigator.clipboard.writeText(shareUrl.toString());
                    showToast('Share link copied.');
                    return;
                } else if (action === 'report') {
                    const values = await openActionModal({
                        title: 'Report Contract',
                        copy: 'Tell us what looks wrong. Reports are visible to moderators for review.',
                        submitLabel: 'Submit Report',
                        fields: [
                            { name: 'reason', label: 'Reason', required: true, placeholder: 'Brief reason...' },
                            { name: 'details', label: 'Details', type: 'textarea', placeholder: 'Optional extra context...' },
                        ],
                    });
                    if (values === ACTION_MODAL_CANCELLED || !values?.reason) return;
                    await reportBoardQuest(postId, values.reason, values.details || null);
                    showToast('Report submitted.');
                }

                await boardQuestState.refreshAll();
                await selectPost(postId);
            } catch (error) {
                console.error('[QuestBoard] Action failed:', error);
                showToast(error.message || 'That action failed.', 'error');
            }
        });
    });
}

async function closeContractModal({ clearUrl = true } = {}) {
    if (!el.contractModal) return;
    el.contractModal.classList.remove('is-open');
    el.contractModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('board-modal-open');
    if (clearUrl) {
        updateUrlForPost(null);
        await boardQuestState.loadPost(null);
        renderFeed(boardQuestState.getSnapshot().boardPosts);
    }
}

function openContractModal(post) {
    if (!el.contractModal || !el.modalBody || !post) return;
    el.modalBody.innerHTML = buildDetailHtml(post);
    el.contractModal.classList.add('is-open');
    el.contractModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('board-modal-open');
    attachDetailActions(post);
}

function buildDetailHtml(post) {
    const acceptance = post.currentCharacterAcceptance;
    const displayStatus = getBoardQuestDisplayStatus(post);
    const bodyHtml = renderMarkdown(post.body_markdown || post.summary || '');

    return `
        <div class="board-detail-scroll">
            <div class="board-modal-header">
                <div class="board-chip-row">
                    <span class="board-status-pill board-status-${escapeHtml(displayStatus)}">${escapeHtml(formatStatusLabel(displayStatus))}</span>
                    <span class="board-chip">${escapeHtml(post.player_contract_category || 'Player Contract')}</span>
                    <span class="board-chip">${escapeHtml(post.post_type.replace(/_/g, ' '))}</span>
                </div>
                <h2 class="board-detail-title" id="board-contract-modal-title">${escapeHtml(post.title)}</h2>
                <p class="board-char-meta" style="margin-top:0.65rem;">Posted by ${escapeHtml(post.author_character_name || 'Unknown')}</p>
                <div class="board-modal-action-line">
                    ${renderActionButtons(post)}
                    <div class="board-modal-expires">
                        <span>Participation</span>
                        <strong>${escapeHtml(getParticipationLabel(post))}</strong>
                    </div>
                    <div class="board-modal-expires">
                        <span>Expires</span>
                        <strong>${escapeHtml(formatDateTime(post.expires_at))}</strong>
                    </div>
                </div>
            </div>
            <div class="board-modal-content">
                <div class="board-modal-summary-grid">
                    <div>
                        ${renderAcceptanceReviewNotice(post)}
                        <div class="board-section-title"><i class="fa-solid fa-feather-pointed"></i>Notice</div>
                        <div class="board-detail-body">${bodyHtml}</div>
                        <div class="board-modal-section">
                            <div class="board-section-title"><i class="fa-solid fa-list-check"></i>Contract Goals</div>
                            ${renderGoals(post)}
                        </div>
                        ${renderPendingConfirmations(post)}
                    </div>
                    <div class="board-modal-side">
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Board Location</div>
                            <div class="board-detail-fact-value">${escapeHtml(buildPostLocation(post))}</div>
                        </div>
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Reward</div>
                            <div class="board-detail-fact-value">${escapeHtml(post.reward_note || 'Reward to be arranged')}</div>
                        </div>
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Proof Mode</div>
                            <div class="board-detail-fact-value">${escapeHtml(formatStatusLabel(post.proof_mode))}</div>
                        </div>
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Destination</div>
                            <div class="board-detail-fact-value">${escapeHtml([post.destination_region, post.destination_shard, post.destination_province, post.destination_home_valley].filter(Boolean).join(' / ') || 'No destination listed')}</div>
                        </div>
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Delivery Rules</div>
                            <div class="board-detail-fact-value">${post.remote_delivery_allowed ? 'Drop-off allowed' : 'Meet in person'}${post.travel_required ? ' / Travel required' : ''}</div>
                        </div>
                        <div class="board-detail-fact">
                            <div class="board-detail-fact-label">Contact Note</div>
                            <div class="board-detail-fact-value">${escapeHtml(post.contact_note || 'No contact note provided')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDetail(post) {
    if (post) openContractModal(post);
    else closeContractModal({ clearUrl: false });
}

async function selectPost(postId = null) {
    const post = postId ? await boardQuestState.loadPost(postId) : null;
    updateUrlForPost(postId);
    renderFeed(boardQuestState.getSnapshot().boardPosts);
    const visiblePosts = getVisiblePosts(boardQuestState.getSnapshot().boardPosts);
    const selectedVisiblePost = post && visiblePosts.some((item) => item.id === post.id) ? post : null;
    renderDetail(selectedVisiblePost);
}

async function selectCompletedPost(postId = null) {
    if (!postId) return;
    const post = await boardQuestState.loadPost(postId);
    updateUrlForPost(postId);
    renderFeed(boardQuestState.getSnapshot().boardPosts);
    renderDetail(post);
}

function syncFilterControls() {
    const filters = boardQuestState.getFilters();
    el.searchInput.value = filters.search || '';
    el.statusSelect.value = filters.status || 'active';
    el.categorySelect.value = filters.category || '';
    el.provinceSelect.value = filters.province || '';
    el.homeValleySelect.value = filters.homeValley || '';
    el.proofModeSelect.value = filters.proofMode || '';
    if (el.postTypeSelect) {
        el.postTypeSelect.value = filters.postType || '';
    }
    el.includeRemote.checked = filters.includeRemote === true;
    if (el.mineOnly) {
        el.mineOnly.checked = filters.mineOnly === true;
    }
}

function getFilterOptionCacheKey() {
    const activeCharacter = getActiveCharacter();
    return [
        getCharacterRegion(activeCharacter),
        activeCharacter?.shard || '',
    ].join('|');
}

function updateFilterOptionCache(posts = []) {
    const nextKey = getFilterOptionCacheKey();
    if (nextKey !== filterOptionCacheKey) {
        filterOptionCacheKey = nextKey;
        filterOptionCache = createFilterOptionCache();
    }

    posts.forEach((post) => {
        if (post.player_contract_category) {
            filterOptionCache.categories.add(post.player_contract_category);
        }

        const province = post.posting_province || '';
        const homeValley = post.posting_home_valley || '';
        if (province) {
            filterOptionCache.provinces.add(province);
            if (!filterOptionCache.homeValleysByProvince.has(province)) {
                filterOptionCache.homeValleysByProvince.set(province, new Set());
            }
            if (homeValley) {
                filterOptionCache.homeValleysByProvince.get(province).add(homeValley);
            }
        } else if (homeValley) {
            if (!filterOptionCache.homeValleysByProvince.has('')) {
                filterOptionCache.homeValleysByProvince.set('', new Set());
            }
            filterOptionCache.homeValleysByProvince.get('').add(homeValley);
        }
    });
}

function hydrateCategoryOptions(posts = []) {
    updateFilterOptionCache(posts);
    const categories = [...filterOptionCache.categories].sort();
    el.categorySelect.innerHTML = `<option value="">All Contract Families</option>${categories.map((category) => `
        <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join('')}`;
}

function hydrateLocationOptions(posts = []) {
    updateFilterOptionCache(posts);
    const filters = boardQuestState.getFilters();
    const provinces = [...filterOptionCache.provinces].sort();
    const homeValleys = filters.province
        ? [...(filterOptionCache.homeValleysByProvince.get(filters.province) || new Set())].sort()
        : [...new Set([...filterOptionCache.homeValleysByProvince.values()].flatMap((set) => [...set]))].sort();

    el.provinceSelect.innerHTML = `<option value="">All Provinces</option>${provinces.map((province) => `
        <option value="${escapeHtml(province)}">${escapeHtml(province)}</option>
    `).join('')}`;

    el.homeValleySelect.innerHTML = `<option value="">All Home Valleys</option>${homeValleys.map((homeValley) => `
        <option value="${escapeHtml(homeValley)}">${escapeHtml(homeValley)}</option>
    `).join('')}`;
}

async function refreshBoard() {
    await boardQuestState.refreshBoardPosts();
    await boardQuestState.refreshAcceptedContracts();
    await boardQuestState.refreshCompletedContracts();
    const snapshot = boardQuestState.getSnapshot();
    hydrateCategoryOptions(snapshot.boardPosts);
    hydrateLocationOptions(snapshot.boardPosts);
    syncFilterControls();
    renderCharacterCard();
    renderAcceptedContracts();
    renderFeed(snapshot.boardPosts);

    const sharePostId = new URL(window.location.href).searchParams.get('post');
    if (sharePostId) {
        const sharedPost = snapshot.boardPosts.find((post) => post.id === sharePostId);
        currentBoardTab = inferTabForPost(sharedPost);
    }
    const visiblePosts = getVisiblePosts(snapshot.boardPosts);
    const preferredActiveId = visiblePosts.some((post) => post.id === snapshot.activePostId) ? snapshot.activePostId : null;
    const targetPostId = sharePostId || preferredActiveId || null;
    await selectPost(targetPostId);
}

function bindFilters() {
    let searchDebounce = 0;
    el.searchInput.addEventListener('input', () => {
        window.clearTimeout(searchDebounce);
        searchDebounce = window.setTimeout(async () => {
            await boardQuestState.setFilters({ search: el.searchInput.value.trim() });
            resetPagination();
            await refreshBoard();
        }, 180);
    });

    [
        [el.statusSelect, 'status'],
        [el.categorySelect, 'category'],
        [el.provinceSelect, 'province'],
        [el.homeValleySelect, 'homeValley'],
        [el.proofModeSelect, 'proofMode'],
        [el.postTypeSelect, 'postType'],
    ].filter(([node]) => Boolean(node)).forEach(([node, key]) => {
        node.addEventListener('change', async () => {
            const patch = { [key]: node.value };
            if (key === 'province') {
                patch.homeValley = '';
            }
            await boardQuestState.setFilters(patch);
            resetPagination();
            await refreshBoard();
        });
    });

    el.includeRemote.addEventListener('change', async () => {
        await boardQuestState.setFilters({ includeRemote: el.includeRemote.checked });
        resetPagination();
        await refreshBoard();
    });

    el.clearFilters.addEventListener('click', async () => {
        await boardQuestState.resetFilters();
        resetPagination();
        await refreshBoard();
    });

    if (el.mineOnly) {
        el.mineOnly.addEventListener('change', async () => {
            await boardQuestState.setFilters({ mineOnly: el.mineOnly.checked });
            resetPagination();
            await refreshBoard();
        });
    }
}

function bindCharacterSelect() {
    el.characterSelect.addEventListener('change', async () => {
        const characterId = el.characterSelect.value;
        if (!characterId) return;
        el.characterSelect.disabled = true;
        try {
            await questState.setActiveCharacter(characterId);
            currentBoardTab = 'available';
            resetPagination();
            await closeContractModal({ clearUrl: true });
            await boardQuestState.resetFilters();
            syncFilterControls();
            await refreshBoard();
        } catch (error) {
            console.error('[QuestBoard] Character switch failed:', error);
            showToast(error.message || 'Failed to switch characters.', 'error');
        } finally {
            el.characterSelect.disabled = false;
        }
    });
}

function bindTabs() {
    el.tabButtons.forEach((button) => {
        button.addEventListener('click', async () => {
            const nextTab = button.getAttribute('data-board-tab') || 'available';
            if (nextTab === currentBoardTab) return;
            currentBoardTab = nextTab;
            resetPagination();
            await closeContractModal({ clearUrl: true });
            renderFeed(boardQuestState.getSnapshot().boardPosts);
        });
    });
}

function bindContractModal() {
    if (!el.contractModal) return;
    el.modalClose.addEventListener('click', () => closeContractModal());
    el.contractModal.addEventListener('click', (event) => {
        if (event.target === el.contractModal) {
            closeContractModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && el.contractModal.classList.contains('is-open')) {
            closeContractModal();
        }
    });
}

function bindActionModal() {
    if (!el.actionModal) return;

    el.actionCancel.addEventListener('click', () => closeActionModal());
    el.actionClose.addEventListener('click', () => closeActionModal());
    el.actionModal.addEventListener('click', (event) => {
        if (event.target === el.actionModal) {
            closeActionModal();
        }
    });
    el.actionForm.addEventListener('submit', (event) => {
        event.preventDefault();
        closeActionModal(collectActionModalValues());
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && el.actionModal.classList.contains('is-open')) {
            closeActionModal();
        }
    });
}

function cacheElements() {
    el.characterCard = document.getElementById('board-character-card');
    el.characterSelectWrap = document.getElementById('board-character-select-wrap');
    el.characterSelect = document.getElementById('board-character-select');
    el.searchInput = document.getElementById('board-search');
    el.statusSelect = document.getElementById('board-status');
    el.categorySelect = document.getElementById('board-category');
    el.provinceSelect = document.getElementById('board-province');
    el.homeValleySelect = document.getElementById('board-home-valley');
    el.proofModeSelect = document.getElementById('board-proof-mode');
    el.postTypeSelect = document.getElementById('board-post-type');
    el.includeRemote = document.getElementById('board-include-remote');
    el.mineOnly = document.getElementById('board-mine-only');
    el.clearFilters = document.getElementById('board-clear-filters');
    el.feedGrid = document.getElementById('board-feed-grid');
    el.feedCount = document.getElementById('board-feed-count');
    el.feedTitle = document.getElementById('board-feed-title');
    el.pagination = document.getElementById('board-pagination');
    el.bannerCharacterName = document.getElementById('board-banner-character-name');
    el.bannerCharacterSubtitle = document.getElementById('board-banner-character-subtitle');
    el.contractModal = document.getElementById('board-contract-modal');
    el.modalBody = document.getElementById('board-contract-modal-body');
    el.modalClose = document.getElementById('board-contract-modal-close');
    el.actionModal = document.getElementById('board-action-modal');
    el.actionForm = document.getElementById('board-action-modal-form');
    el.actionClose = document.getElementById('board-action-modal-close');
    el.actionCancel = document.getElementById('board-action-modal-cancel');
    el.actionSubmit = document.getElementById('board-action-modal-submit');
    el.actionTitle = document.getElementById('board-action-modal-title');
    el.actionCopy = document.getElementById('board-action-modal-copy');
    el.actionFields = document.getElementById('board-action-modal-fields');
    el.acceptedContracts = document.getElementById('board-accepted-contracts');
    el.heroOpenCount = document.getElementById('board-hero-open-count');
    el.heroAcceptedCount = document.getElementById('board-hero-accepted-count');
    el.toastWrap = document.getElementById('board-toast-wrap');
    el.tabButtons = Array.from(document.querySelectorAll('[data-board-tab]'));
}

async function init() {
    cacheElements();
    await questState.initialize();
    if (!questState.getUser()) {
        return;
    }
    await boardQuestState.initialize();
    renderCharacterCard();
    bindFilters();
    bindCharacterSelect();
    bindTabs();
    bindContractModal();
    bindActionModal();
    await refreshBoard();
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        console.error('[QuestBoard] Init failed:', error);
        showToast(error.message || 'Failed to load the quest board.', 'error');
    });
});
