import { questState } from './questStateManager.js';
import { createBoardQuest, getBoardQuestById, updateBoardQuest } from './boardQuestService.js';

const el = {};
let goalCounter = 0;
let editingPost = null;

const PROOF_MODE_HELP = {
    self_complete: 'The accepting character can mark this contract complete themselves. Best for simple goodwill tasks, guide runs, and low-risk help requests.',
    submit_for_confirmation: 'The accepting character submits completion, then the poster confirms it. Best for deliveries, paid work, or contracts where you need to verify the result.',
};

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getValue(id) {
    return document.getElementById(id)?.value.trim() || '';
}

function showError(message = '') {
    el.error.textContent = message;
    el.error.classList.toggle('hidden', !message);
}

function getActiveCharacter() {
    return questState.getActiveCharacter();
}

function getCharacterRegion(character = {}) {
    const source = character || {};
    return source.region || source.region_name || '';
}

function formatLocationPart(value = '') {
    return value || 'Not set';
}

function uniqueSorted(values = []) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function getRegionRows() {
    return questState.getRegions() || [];
}

function setSelectOptions(select, values = [], placeholder = 'Select...', selectedValue = '') {
    if (!select) return;
    const options = values.map((value) => `
        <option value="${escapeHtml(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(value)}</option>
    `).join('');
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${options}`;
    select.disabled = values.length === 0;
    if (selectedValue && values.includes(selectedValue)) {
        select.value = selectedValue;
    }
}

function populateDestinationRegions(selectedValue = '') {
    const regions = uniqueSorted(getRegionRows().map((row) => row.region_name));
    setSelectOptions(el.destinationRegion, regions, 'Select Region', selectedValue);
}

function populateDestinationShards(selectedValue = '') {
    const region = el.destinationRegion.value;
    const shards = uniqueSorted(getRegionRows()
        .filter((row) => row.region_name === region)
        .map((row) => row.shard));
    setSelectOptions(el.destinationShard, shards, region ? 'Select Shard' : 'Select Region First', selectedValue);
}

function populateDestinationProvinces(selectedValue = '') {
    const region = el.destinationRegion.value;
    const shard = el.destinationShard.value;
    const provinces = uniqueSorted(getRegionRows()
        .filter((row) => row.region_name === region && row.shard === shard)
        .map((row) => row.province));
    setSelectOptions(el.destinationProvince, provinces, shard ? 'Select Province' : 'Select Shard First', selectedValue);
}

function populateDestinationHomeValleys(selectedValue = '') {
    const region = el.destinationRegion.value;
    const shard = el.destinationShard.value;
    const province = el.destinationProvince.value;
    const homeValleys = uniqueSorted(getRegionRows()
        .filter((row) => row.region_name === region && row.shard === shard && row.province === province)
        .map((row) => row.home_valley));
    setSelectOptions(el.destinationHomeValley, homeValleys, province ? 'Select Home Valley' : 'Select Province First', selectedValue);
}

function resetDestinationAfter(level) {
    if (level === 'region') {
        populateDestinationShards();
        populateDestinationProvinces();
        populateDestinationHomeValleys();
    } else if (level === 'shard') {
        populateDestinationProvinces();
        populateDestinationHomeValleys();
    } else if (level === 'province') {
        populateDestinationHomeValleys();
    }
}

function fillLocationDefaults() {
    const character = getActiveCharacter();
    const region = getCharacterRegion(character);
    const shard = character?.shard || '';
    const province = character?.province || '';
    const homeValley = character?.home_valley || '';

    populateDestinationRegions(region);
    populateDestinationShards(shard);
    populateDestinationProvinces(province);
    populateDestinationHomeValleys(homeValley);
}

function renderCharacterPanel() {
    const characters = questState.getCharacters() || [];
    const activeCharacter = getActiveCharacter();

    if (!el.characterSelect || !el.characterCard) return;

    if (!characters.length) {
        el.characterSelectWrap?.classList.add('hidden');
        el.characterCard.innerHTML = `
            <div class="post-contract-character-empty">
                <strong>No character found.</strong>
                <span>Create or select a character before posting a player contract.</span>
            </div>
        `;
        return;
    }

    el.characterSelectWrap?.classList.remove('hidden');
    el.characterSelect.innerHTML = characters.map((character) => `
        <option value="${escapeHtml(character.character_id)}"${character.character_id === activeCharacter?.character_id ? ' selected' : ''}>
            ${escapeHtml(character.character_name)}
        </option>
    `).join('');

    if (!activeCharacter) {
        el.characterCard.innerHTML = `
            <div class="post-contract-character-empty">
                <strong>No active character.</strong>
                <span>Choose who is posting this contract.</span>
            </div>
        `;
        return;
    }

    const canEdit = !editingPost || activeCharacter.character_id === editingPost.author_character_id;
    const location = [
        { label: 'Region', value: getCharacterRegion(activeCharacter) },
        { label: 'Shard', value: activeCharacter.shard },
        { label: 'Province', value: activeCharacter.province },
        { label: 'Home Valley', value: activeCharacter.home_valley },
    ];

    el.characterCard.innerHTML = `
        <div class="post-contract-character-name">
            <i class="fa-solid fa-user"></i>
            <span>${escapeHtml(activeCharacter.character_name || 'Selected Character')}</span>
        </div>
        <div class="post-contract-character-location-grid">
            ${location.map((item) => `
                <div class="post-contract-character-fact">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(formatLocationPart(item.value))}</strong>
                </div>
            `).join('')}
        </div>
        ${canEdit ? '' : `
            <p class="post-contract-character-warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                Only the posting character can save changes to this contract.
            </p>
        `}
    `;
}

async function switchPostingCharacter(characterId, options = {}) {
    if (!characterId) return;
    el.characterSelect.disabled = true;
    showError('');

    try {
        await questState.setActiveCharacter(characterId);
        renderCharacterPanel();
        if (!editingPost && options.updateDefaults !== false) {
            fillLocationDefaults();
        }
    } catch (error) {
        console.error('[PostContract] Character switch failed:', error);
        showError(error.message || 'Failed to switch characters.');
        renderCharacterPanel();
    } finally {
        el.characterSelect.disabled = false;
    }
}

function bindCharacterSelect() {
    if (!el.characterSelect) return;
    el.characterSelect.addEventListener('change', async () => {
        await switchPostingCharacter(el.characterSelect.value);
    });
}

function bindDestinationLocation() {
    el.destinationRegion.addEventListener('change', () => resetDestinationAfter('region'));
    el.destinationShard.addEventListener('change', () => resetDestinationAfter('shard'));
    el.destinationProvince.addEventListener('change', () => resetDestinationAfter('province'));
}

function updateProofModeHelp() {
    if (!el.proofModeHelp) return;
    el.proofModeHelp.textContent = PROOF_MODE_HELP[el.proofMode.value] || '';
}

function getEditPostId() {
    return new URL(window.location.href).searchParams.get('edit');
}

function buildGoalRow(goal = {}) {
    goalCounter += 1;
    const rowId = `contract-goal-${goalCounter}`;
    return `
        <div class="post-contract-goal-row" data-goal-row id="${rowId}">
            <div class="board-field">
                <label class="board-label">Type</label>
                <select class="board-select" data-goal-type>
                    <option value="checkbox"${goal.type === 'checkbox' ? ' selected' : ''}>Checkbox</option>
                    <option value="counter"${goal.type === 'counter' ? ' selected' : ''}>Counter</option>
                </select>
            </div>
            <div class="board-field">
                <label class="board-label">Goal</label>
                <input class="board-input" data-goal-label value="${escapeHtml(goal.label || '')}" placeholder="Deliver the crate to the forge steward">
            </div>
            <div class="board-field">
                <label class="board-label">Target</label>
                <input class="board-input" data-goal-target type="number" min="1" value="${escapeHtml(goal.target || '')}" placeholder="1">
            </div>
            <div class="board-field">
                <label class="board-label">Unit</label>
                <input class="board-input" data-goal-unit value="${escapeHtml(goal.unit || '')}" placeholder="items">
            </div>
            <button type="button" class="board-btn board-btn-danger" data-remove-goal aria-label="Remove goal">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

function addGoal(goal = {}) {
    el.goalsList.insertAdjacentHTML('beforeend', buildGoalRow(goal));
}

function resetGoals(goals = []) {
    goalCounter = 0;
    el.goalsList.innerHTML = '';
    const normalizedGoals = goals.length ? goals : [{ type: 'checkbox', label: '' }];
    normalizedGoals.forEach((goal) => addGoal(goal));
}

function bindGoals() {
    el.addGoal.addEventListener('click', () => addGoal({ type: 'checkbox' }));
    el.goalsList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-remove-goal]');
        if (!removeButton) return;
        removeButton.closest('[data-goal-row]')?.remove();
    });
}

function readGoals() {
    return Array.from(el.goalsList.querySelectorAll('[data-goal-row]'))
        .map((row, index) => {
            const type = row.querySelector('[data-goal-type]')?.value || 'checkbox';
            const label = row.querySelector('[data-goal-label]')?.value.trim() || '';
            const target = Number(row.querySelector('[data-goal-target]')?.value || 1);
            const unit = row.querySelector('[data-goal-unit]')?.value.trim() || '';

            return {
                sort_order: index,
                type,
                label,
                target: type === 'counter' ? Math.max(1, target || 1) : null,
                unit: type === 'counter' && unit ? unit : null,
            };
        })
        .filter((goal) => goal.label);
}

function buildExpiresAt() {
    const days = Number(el.expiresDays.value);
    if (!days) return null;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt.toISOString();
}

function getExpiresDaysValue(expiresAt) {
    if (!expiresAt) return '';
    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(expiresDate.getTime())) return '7';

    const msRemaining = expiresDate.getTime() - Date.now();
    const daysRemaining = Math.max(1, Math.round(msRemaining / 86400000));
    const supported = [3, 7, 14, 30];
    return String(supported.reduce((best, candidate) => (
        Math.abs(candidate - daysRemaining) < Math.abs(best - daysRemaining) ? candidate : best
    ), 7));
}

function buildPayload() {
    const character = getActiveCharacter();
    const goals = readGoals();

    if (!character) {
        throw new Error('Choose a character before posting a contract.');
    }
    if (editingPost && character.character_id !== editingPost.author_character_id) {
        throw new Error('Only the posting character can save changes to this contract.');
    }
    if (!getValue('contract-title')) {
        throw new Error('Contract title is required.');
    }
    if (!getValue('contract-summary')) {
        throw new Error('Contract summary is required.');
    }
    if (!getValue('contract-body')) {
        throw new Error('Contract details are required.');
    }
    if (!goals.length) {
        throw new Error('Add at least one goal.');
    }

    return {
        title: getValue('contract-title'),
        summary: getValue('contract-summary'),
        body_markdown: getValue('contract-body'),
        reward_note: getValue('contract-reward') || null,
        player_contract_category: el.category.value,
        post_type: 'contract',
        proof_mode: el.proofMode.value,
        capacity: 1,
        expires_at: buildExpiresAt(),
        visibility_scope: 'public',
        posting_region: editingPost?.posting_region || getCharacterRegion(character) || null,
        posting_shard: editingPost?.posting_shard || character.shard || null,
        posting_province: editingPost?.posting_province || character.province || null,
        posting_home_valley: editingPost?.posting_home_valley || character.home_valley || null,
        destination_region: getValue('contract-destination-region') || null,
        destination_shard: getValue('contract-destination-shard') || null,
        destination_province: getValue('contract-destination-province') || null,
        destination_home_valley: getValue('contract-destination-home-valley') || null,
        travel_required: el.travelRequired.checked,
        remote_delivery_allowed: el.remoteDelivery.checked,
        contact_note: getValue('contract-contact') || null,
        is_renewable: true,
        goals,
    };
}

function setFieldValue(id, value = '') {
    const node = document.getElementById(id);
    if (node) node.value = value || '';
}

function fillFormFromPost(post) {
    setFieldValue('contract-title', post.title);
    setFieldValue('contract-category', post.player_contract_category);
    setFieldValue('contract-proof-mode', post.proof_mode === 'external_proof_note' ? 'submit_for_confirmation' : post.proof_mode);
    setFieldValue('contract-expires-days', getExpiresDaysValue(post.expires_at));
    setFieldValue('contract-summary', post.summary);
    setFieldValue('contract-body', post.body_markdown);
    setFieldValue('contract-reward', post.reward_note);
    setFieldValue('contract-contact', post.contact_note);

    populateDestinationRegions(post.destination_region || '');
    populateDestinationShards(post.destination_shard || '');
    populateDestinationProvinces(post.destination_province || '');
    populateDestinationHomeValleys(post.destination_home_valley || '');

    el.travelRequired.checked = post.travel_required === true;
    el.remoteDelivery.checked = post.remote_delivery_allowed === true;
    resetGoals(post.board_quest_goals || post.tracking_goals || []);
    updateProofModeHelp();
}

async function loadEditPostIfNeeded() {
    const editPostId = getEditPostId();
    if (!editPostId) return;

    editingPost = await getBoardQuestById(editPostId);
    const characters = questState.getCharacters() || [];
    const authorCharacter = characters.find((character) => character.character_id === editingPost.author_character_id);
    if (authorCharacter && questState.getActiveCharacterId() !== editingPost.author_character_id) {
        await switchPostingCharacter(editingPost.author_character_id, { updateDefaults: false });
    }

    const activeCharacter = getActiveCharacter();
    if (!activeCharacter?.character_id || activeCharacter.character_id !== editingPost.author_character_id) {
        renderCharacterPanel();
        throw new Error('Only the posting character can edit this contract.');
    }

    document.querySelector('#post-contract-main-content h1').textContent = 'Edit Contract';
    el.submit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Save Contract';
    fillFormFromPost(editingPost);
}

async function handleSubmit(event) {
    event.preventDefault();
    showError('');
    el.submit.disabled = true;
    el.submit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>${editingPost ? 'Saving...' : 'Posting...'}`;

    try {
        const created = editingPost
            ? await updateBoardQuest(editingPost.id, buildPayload())
            : await createBoardQuest(buildPayload());
        window.location.href = `contracts.html?post=${encodeURIComponent(created.id)}`;
    } catch (error) {
        console.error('[PostContract] Failed:', error);
        showError(error.message || `Failed to ${editingPost ? 'save' : 'post'} contract.`);
        el.submit.disabled = false;
        el.submit.innerHTML = editingPost
            ? '<i class="fa-solid fa-floppy-disk"></i>Save Contract'
            : '<i class="fa-solid fa-thumbtack"></i>Post Contract';
    }
}

function cacheElements() {
    el.form = document.getElementById('post-contract-form');
    el.characterSelectWrap = document.getElementById('post-contract-character-select-wrap');
    el.characterSelect = document.getElementById('post-contract-character-select');
    el.characterCard = document.getElementById('post-contract-character-card');
    el.category = document.getElementById('contract-category');
    el.proofMode = document.getElementById('contract-proof-mode');
    el.proofModeHelp = document.getElementById('contract-proof-mode-help');
    el.expiresDays = document.getElementById('contract-expires-days');
    el.destinationRegion = document.getElementById('contract-destination-region');
    el.destinationShard = document.getElementById('contract-destination-shard');
    el.destinationProvince = document.getElementById('contract-destination-province');
    el.destinationHomeValley = document.getElementById('contract-destination-home-valley');
    el.travelRequired = document.getElementById('contract-travel-required');
    el.remoteDelivery = document.getElementById('contract-remote-delivery');
    el.goalsList = document.getElementById('contract-goals-list');
    el.addGoal = document.getElementById('add-contract-goal');
    el.submit = document.getElementById('post-contract-submit');
    el.error = document.getElementById('post-contract-error');
}

async function init() {
    cacheElements();
    await questState.initialize();
    if (!questState.getUser()) return;

    renderCharacterPanel();
    fillLocationDefaults();
    resetGoals();
    bindCharacterSelect();
    bindGoals();
    bindDestinationLocation();
    updateProofModeHelp();
    await loadEditPostIfNeeded();
    el.proofMode.addEventListener('change', updateProofModeHelp);
    el.form.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        console.error('[PostContract] Init failed:', error);
        showError(error.message || 'Failed to initialize post contract page.');
    });
});
