import { questState } from './questStateManager.js';
import { createBoardQuest } from './boardQuestService.js';

const el = {};
let goalCounter = 0;

const PROOF_MODE_HELP = {
    self_complete: 'The accepting character can mark this contract complete themselves. Best for simple goodwill tasks, guide runs, and low-risk help requests.',
    submit_for_confirmation: 'The accepting character submits completion, then the poster confirms it. Best for deliveries, paid work, or contracts where you need to verify the result.',
    external_proof_note: 'The accepting character should include a proof note or link. Best for hunts, scouting, screenshots, or work completed away from the poster.',
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
    const region = character?.region || character?.region_name || '';
    const shard = character?.shard || '';
    const province = character?.province || '';
    const homeValley = character?.home_valley || '';

    populateDestinationRegions(region);
    populateDestinationShards(shard);
    populateDestinationProvinces(province);
    populateDestinationHomeValleys(homeValley);
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

function buildPayload() {
    const character = getActiveCharacter();
    const goals = readGoals();

    if (!character) {
        throw new Error('Choose a character before posting a contract.');
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
        capacity: Math.max(1, Number(el.capacity.value || 1)),
        expires_at: buildExpiresAt(),
        visibility_scope: 'public',
        posting_region: character.region || character.region_name || null,
        posting_shard: character.shard || null,
        posting_province: character.province || null,
        posting_home_valley: character.home_valley || null,
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

async function handleSubmit(event) {
    event.preventDefault();
    showError('');
    el.submit.disabled = true;
    el.submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Posting...';

    try {
        const created = await createBoardQuest(buildPayload());
        window.location.href = `contracts.html?post=${encodeURIComponent(created.id)}`;
    } catch (error) {
        console.error('[PostContract] Failed:', error);
        showError(error.message || 'Failed to post contract.');
        el.submit.disabled = false;
        el.submit.innerHTML = '<i class="fa-solid fa-thumbtack"></i>Post Contract';
    }
}

function cacheElements() {
    el.form = document.getElementById('post-contract-form');
    el.category = document.getElementById('contract-category');
    el.proofMode = document.getElementById('contract-proof-mode');
    el.proofModeHelp = document.getElementById('contract-proof-mode-help');
    el.capacity = document.getElementById('contract-capacity');
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

    fillLocationDefaults();
    addGoal({ type: 'checkbox', label: '' });
    bindGoals();
    bindDestinationLocation();
    updateProofModeHelp();
    el.proofMode.addEventListener('change', updateProofModeHelp);
    el.form.addEventListener('submit', handleSubmit);
}

document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
        console.error('[PostContract] Init failed:', error);
        showError(error.message || 'Failed to initialize post contract page.');
    });
});
