import { supabase } from './supabaseClient.js';
import { authSession } from './authSessionManager.js';

const state = {
    user: null,
    characters: [],
    selectedCharacter: null,
    listings: [],
    salesByListingId: new Map(),
    selectedListingIds: new Set(),
};

const els = {
    loading: document.getElementById('ledgerAdminLoading'),
    denied: document.getElementById('ledgerAccessDenied'),
    content: document.getElementById('ledgerManagementContent'),
    message: document.getElementById('ledgerManagementMessage'),
    listingsBody: document.getElementById('ledgerListingsBody'),
    deletedCharactersBody: document.getElementById('deletedCharactersBody'),
    characterStateFilter: document.getElementById('characterStateFilter'),
    listingStatusFilter: document.getElementById('listingStatusFilter'),
    characterSelect: document.getElementById('ledgerCharacterSelect'),
    searchInput: document.getElementById('ledgerSearchInput'),
    loadCharacterLedger: document.getElementById('loadCharacterLedgerBtn'),
    refresh: document.getElementById('refreshLedgerManagementBtn'),
    bulkDelete: document.getElementById('bulkDeleteListingsBtn'),
    selectAll: document.getElementById('selectAllListings'),
    listingResultCount: document.getElementById('listingResultCount'),
    deletedCharacterResultCount: document.getElementById('deletedCharacterResultCount'),
    statActiveCharacters: document.getElementById('statActiveCharacters'),
    statDeletedCharacters: document.getElementById('statDeletedCharacters'),
    statMarketStalls: document.getElementById('statMarketStalls'),
    statActiveUnsold: document.getElementById('statActiveUnsold'),
    statCancelledUnsold: document.getElementById('statCancelledUnsold'),
    statSoldProtected: document.getElementById('statSoldProtected'),
};

function setLoading(show) {
    if (els.loading) els.loading.classList.toggle('hidden', !show);
}

function showMessage(message, type = 'info') {
    if (!els.message) return;
    const colors = {
        info: 'text-gray-400',
        success: 'text-emerald-300',
        error: 'text-red-300',
        warning: 'text-amber-300',
    };
    els.message.className = `text-sm ${colors[type] || colors.info}`;
    els.message.textContent = message;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatDate(value) {
    if (!value) return '--';
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getNestedOne(value) {
    return Array.isArray(value) ? value[0] : value;
}

function getItemName(listing) {
    const item = getNestedOne(listing.items);
    return item?.item_name || `Item #${listing.item_id}`;
}

function getCharacter(listing) {
    return getNestedOne(listing.characters) || {};
}

function getStall(listing) {
    return getNestedOne(listing.market_stalls) || {};
}

function getSales(listingId) {
    return state.salesByListingId.get(Number(listingId)) || [];
}

function getListingStatus(listing) {
    const sales = getSales(listing.listing_id);
    if (listing.is_fully_sold || sales.length > 0) return 'sold';
    if (listing.is_cancelled) return 'cancelled';
    return 'active';
}

function isDeletedCharacter(listing) {
    return Boolean(getCharacter(listing).deleted_at);
}

function isDeletableListing(listing) {
    return getListingStatus(listing) !== 'sold';
}

function getFilteredListings() {
    const listingStatus = els.listingStatusFilter?.value || 'active';
    const search = (els.searchInput?.value || '').trim().toLowerCase();

    return state.listings.filter((listing) => {
        const status = getListingStatus(listing);
        const character = getCharacter(listing);
        const stall = getStall(listing);

        if (listingStatus !== 'all' && status !== listingStatus) return false;

        if (search) {
            const haystack = [
                listing.listing_id,
                getItemName(listing),
                character.character_name,
                character.character_id,
                stall.stall_name,
                stall.region,
                stall.province,
                stall.home_valley,
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });
}

async function requireLedgerAdmin() {
    const user = await authSession.getUser();
    if (!user) return false;
    state.user = user;

    const { data, error } = await supabase
        .from('admin_users')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Ledger admin check failed:', error);
        return false;
    }

    return data?.is_admin === true;
}

async function loadOverview() {
    showMessage('Loading ledger overview...');

    const [
        { data: characters, error: charactersError },
        { count: stallCount, error: stallError },
        { count: activeCount, error: activeError },
        { count: cancelledCount, error: cancelledError },
        { count: soldCount, error: soldError },
    ] = await Promise.all([
        supabase
            .from('characters')
            .select('character_id, character_name, user_id, region, shard, province, home_valley, created_at, deleted_at, anonymized_at')
            .order('created_at', { ascending: false }),
        supabase.from('market_stalls').select('id', { count: 'exact', head: true }),
        supabase.from('market_listings').select('listing_id', { count: 'exact', head: true }).eq('is_fully_sold', false).eq('is_cancelled', false),
        supabase.from('market_listings').select('listing_id', { count: 'exact', head: true }).eq('is_fully_sold', false).eq('is_cancelled', true),
        supabase.from('market_listings').select('listing_id', { count: 'exact', head: true }).eq('is_fully_sold', true),
    ]);

    const firstError = charactersError || stallError || activeError || cancelledError || soldError;
    if (firstError) throw firstError;

    state.characters = characters || [];
    renderOverviewStats({
        stallCount,
        activeCount,
        cancelledCount,
        soldCount,
    });
    renderCharacterSelect();
    showMessage('Select a character to load their ledger details.', 'info');
}

function renderOverviewStats({ stallCount, activeCount, cancelledCount, soldCount }) {
    const activeCharacters = state.characters.filter((character) => !character.deleted_at).length;
    const deletedCharacters = state.characters.filter((character) => character.deleted_at).length;

    els.statActiveCharacters.textContent = formatNumber(activeCharacters);
    els.statDeletedCharacters.textContent = formatNumber(deletedCharacters);
    els.statMarketStalls.textContent = formatNumber(stallCount);
    els.statActiveUnsold.textContent = formatNumber(activeCount);
    els.statCancelledUnsold.textContent = formatNumber(cancelledCount);
    els.statSoldProtected.textContent = formatNumber(soldCount);
}

function renderCharacterSelect() {
    const characterState = els.characterStateFilter?.value || 'deleted';
    const characters = state.characters
        .filter((character) => {
            if (characterState === 'deleted') return Boolean(character.deleted_at);
            if (characterState === 'active') return !character.deleted_at;
            return true;
        })
        .sort((a, b) => {
            const deletedDelta = Number(Boolean(b.deleted_at)) - Number(Boolean(a.deleted_at));
            if (deletedDelta !== 0) return deletedDelta;
            return String(a.character_name || '').localeCompare(String(b.character_name || ''));
        });

    const previousValue = els.characterSelect.value;
    els.characterSelect.innerHTML = '<option value="">Select a character...</option>';
    characters.forEach((character) => {
        const option = document.createElement('option');
        option.value = character.character_id;
        option.textContent = `${character.character_name || 'Unknown'}${character.deleted_at ? ' (deleted)' : ''}`;
        els.characterSelect.appendChild(option);
    });

    if (previousValue && characters.some((character) => character.character_id === previousValue)) {
        els.characterSelect.value = previousValue;
    } else {
        state.selectedCharacter = null;
        state.listings = [];
        state.salesByListingId = new Map();
        state.selectedListingIds.clear();
        renderListings();
        renderCharacterSummary();
    }
}

async function loadSelectedCharacterLedger() {
    const characterId = els.characterSelect.value;
    if (!characterId) {
        showMessage('Select a character before loading ledger details.', 'warning');
        return;
    }

    state.selectedCharacter = state.characters.find((character) => character.character_id === characterId) || null;
    await loadListings(characterId);
}

async function loadListings(characterId) {
    showMessage('Loading selected character ledger...');
    state.selectedListingIds.clear();
    if (els.selectAll) els.selectAll.checked = false;
    updateBulkButton();

    const { data: listings, error } = await supabase
        .from('market_listings')
        .select(`
            listing_id,
            item_id,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee,
            listing_date,
            is_fully_sold,
            is_cancelled,
            character_id,
            market_stall_id,
            is_mastercrafted,
            enchantment_tier,
            items ( item_name ),
            characters ( character_id, character_name, user_id, deleted_at, anonymized_at, shard, province, home_valley ),
            market_stalls ( id, stall_name, region, province, home_valley, anonymized_at, character_name )
        `)
        .eq('character_id', characterId)
        .order('listing_date', { ascending: false })
        .limit(1000);

    if (error) throw error;

    state.listings = listings || [];
    await loadSalesForListings(state.listings.map((listing) => listing.listing_id));
    renderAll();
    showMessage(`Loaded ${formatNumber(state.listings.length)} listing records for ${state.selectedCharacter?.character_name || 'selected character'}.`, 'success');
}

async function loadSalesForListings(listingIds) {
    state.salesByListingId = new Map();
    if (!listingIds.length) return;

    const { data, error } = await supabase
        .from('sales')
        .select('sale_id, listing_id, quantity_sold, total_sale_price, sale_date')
        .in('listing_id', listingIds);

    if (error) throw error;

    (data || []).forEach((sale) => {
        const key = Number(sale.listing_id);
        const existing = state.salesByListingId.get(key) || [];
        existing.push(sale);
        state.salesByListingId.set(key, existing);
    });
}

function renderAll() {
    renderListings();
    renderCharacterSummary();
}

function renderListings() {
    const listings = getFilteredListings();
    els.listingResultCount.textContent = state.selectedCharacter
        ? `${formatNumber(listings.length)} shown`
        : 'Select a character';

    if (!state.selectedCharacter) {
        els.listingsBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-8">Select a character to load listings.</td></tr>';
        updateBulkButton();
        return;
    }

    if (!listings.length) {
        els.listingsBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-8">No listings match these filters.</td></tr>';
        updateBulkButton();
        return;
    }

    els.listingsBody.innerHTML = listings.map((listing) => {
        const status = getListingStatus(listing);
        const character = getCharacter(listing);
        const stall = getStall(listing);
        const sales = getSales(listing.listing_id);
        const deleted = Boolean(character.deleted_at);
        const deletable = isDeletableListing(listing);
        const checked = state.selectedListingIds.has(Number(listing.listing_id)) ? 'checked' : '';
        const disabled = deletable ? '' : 'disabled';
        const checkbox = deletable
            ? `<input class="listing-select" type="checkbox" data-listing-id="${listing.listing_id}" ${checked}>`
            : '<span class="text-slate-600">--</span>';
        const action = deletable
            ? `<button class="delete-listing-btn action-btn action-danger" data-listing-id="${listing.listing_id}"><i class="fas fa-trash"></i> Delete</button>`
            : '<span class="action-btn action-disabled"><i class="fas fa-lock"></i> Protected</span>';

        return `
            <tr>
                <td>${checkbox}</td>
                <td>
                    <div class="font-bold text-white">${escapeHtml(getItemName(listing))}</div>
                    <div class="text-xs text-gray-400">#${listing.listing_id} · Qty ${formatNumber(listing.quantity_listed)} · ${formatNumber(Math.round(listing.total_listed_price || 0))}g</div>
                    <div class="text-xs text-gray-500">${formatDate(listing.listing_date)}</div>
                </td>
                <td>
                    <div class="font-semibold text-white">${escapeHtml(character.character_name || 'Unknown')}</div>
                    <div class="mt-1">${deleted ? '<span class="status-pill status-deleted">Deleted</span>' : '<span class="status-pill status-normal">Active</span>'}</div>
                    <div class="text-xs text-gray-500 mt-1">${escapeHtml(character.character_id || '')}</div>
                </td>
                <td>
                    <div class="font-semibold text-white">${escapeHtml(stall.stall_name || 'No stall')}</div>
                    <div class="text-xs text-gray-400">${escapeHtml([stall.region, stall.province, stall.home_valley].filter(Boolean).join(' / ') || '--')}</div>
                </td>
                <td>${renderStatus(status)}</td>
                <td>
                    <div class="font-semibold text-white">${formatNumber(sales.length)} sale${sales.length === 1 ? '' : 's'}</div>
                    <div class="text-xs text-gray-400">${sales.length ? `${formatNumber(Math.round(sales.reduce((sum, sale) => sum + (Number(sale.total_sale_price) || 0), 0)))}g total` : 'No sales rows'}</div>
                </td>
                <td>${action}</td>
            </tr>
        `;
    }).join('');

    els.listingsBody.querySelectorAll('.listing-select').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
            const id = Number(event.currentTarget.dataset.listingId);
            if (event.currentTarget.checked) state.selectedListingIds.add(id);
            else state.selectedListingIds.delete(id);
            updateBulkButton();
        });
    });

    els.listingsBody.querySelectorAll('.delete-listing-btn').forEach((button) => {
        button.addEventListener('click', () => deleteListings([Number(button.dataset.listingId)]));
    });

    updateBulkButton();
}

function renderStatus(status) {
    if (status === 'sold') return '<span class="status-pill status-sold"><i class="fas fa-lock"></i> Sold</span>';
    if (status === 'cancelled') return '<span class="status-pill status-cancelled"><i class="fas fa-ban"></i> Cancelled</span>';
    return '<span class="status-pill status-active"><i class="fas fa-circle"></i> Active</span>';
}

function renderCharacterSummary() {
    if (!state.selectedCharacter) {
        els.deletedCharacterResultCount.textContent = 'Select a character';
        els.deletedCharactersBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 py-8">Select a character to load summary.</td></tr>';
        return;
    }

    const counts = { active: 0, cancelled: 0, sold: 0 };
    state.listings.forEach((listing) => {
        counts[getListingStatus(listing)]++;
    });
    const character = state.selectedCharacter;
    els.deletedCharacterResultCount.textContent = `${formatNumber(state.listings.length)} listings loaded`;
    const action = character.deleted_at
        ? '<span class="action-btn action-disabled"><i class="fas fa-lock"></i> Already Deleted</span>'
        : '<button id="adminDeleteCharacterBtn" class="action-btn action-danger"><i class="fas fa-user-slash"></i> Delete Character</button>';

    els.deletedCharactersBody.innerHTML = `
        <tr>
            <td>
                <div class="font-bold text-white">${escapeHtml(character.character_name || 'Deleted Character')}</div>
                <div class="text-xs text-gray-500">${escapeHtml(character.character_id)}</div>
                <div class="mt-1">${character.deleted_at ? '<span class="status-pill status-deleted">Deleted</span>' : '<span class="status-pill status-normal">Active</span>'}</div>
            </td>
            <td>
                <div class="text-gray-300">${escapeHtml([character.region, character.shard, character.province, character.home_valley].filter(Boolean).join(' / ') || '--')}</div>
            </td>
            <td>${character.deleted_at ? formatDate(character.deleted_at) : '--'}</td>
            <td>
                <div class="text-white font-semibold">${formatNumber(state.listings.length)} listings</div>
                <div class="text-xs text-gray-400">${formatNumber(counts.active)} active · ${formatNumber(counts.cancelled)} cancelled · ${formatNumber(counts.sold)} sold</div>
            </td>
            <td>
                <div class="flex items-center justify-center min-h-[3.5rem]">
                    ${action}
                </div>
            </td>
        </tr>
    `;

    const deleteBtn = document.getElementById('adminDeleteCharacterBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedCharacter);
}

function updateBulkButton() {
    const count = state.selectedListingIds.size;
    els.bulkDelete.disabled = count === 0;
    els.bulkDelete.classList.toggle('opacity-50', count === 0);
    els.bulkDelete.classList.toggle('cursor-not-allowed', count === 0);
    els.bulkDelete.innerHTML = `<i class="fas fa-trash"></i> Delete Selected Unsold${count ? ` (${count})` : ''}`;
}

async function deleteListings(listingIds) {
    const ids = listingIds.map(Number).filter(Boolean);
    if (!ids.length) return;

    const protectedIds = ids.filter((id) => getSales(id).length > 0);
    if (protectedIds.length > 0) {
        showMessage(`Skipped ${protectedIds.length} sold listing(s). Sold listings are protected.`, 'warning');
        return;
    }

    const confirmed = window.confirm(`Delete ${ids.length} unsold listing${ids.length === 1 ? '' : 's'} permanently? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase
        .from('market_listings')
        .delete()
        .in('listing_id', ids);

    if (error) {
        console.error('Failed to delete listings:', error);
        showMessage(`Failed to delete listing(s): ${error.message}`, 'error');
        return;
    }

    ids.forEach((id) => state.selectedListingIds.delete(id));
    state.listings = state.listings.filter((listing) => !ids.includes(Number(listing.listing_id)));
    await loadOverview();
    renderAll();
    showMessage(`Deleted ${ids.length} unsold listing${ids.length === 1 ? '' : 's'}.`, 'success');
}

async function deleteSelectedCharacter() {
    const character = state.selectedCharacter;
    if (!character || character.deleted_at) return;

    const confirmed = window.confirm(`Delete ${character.character_name || 'this character'}? Active listings will be cancelled and the character will be removed from normal user views. This cannot be undone.`);
    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    const characterId = character.character_id;
    const stallIds = [...new Set(state.listings.map((listing) => listing.market_stall_id).filter(Boolean))];

    const { error: directListingsError } = await supabase
        .from('market_listings')
        .update({ is_cancelled: true })
        .eq('character_id', characterId)
        .eq('is_fully_sold', false)
        .eq('is_cancelled', false);

    if (directListingsError) {
        showMessage(`Failed to cancel active listings: ${directListingsError.message}`, 'error');
        return;
    }

    if (stallIds.length > 0) {
        const { error: stallListingsError } = await supabase
            .from('market_listings')
            .update({ is_cancelled: true })
            .in('market_stall_id', stallIds)
            .eq('is_fully_sold', false)
            .eq('is_cancelled', false);

        if (stallListingsError) {
            showMessage(`Failed to cancel stall listings: ${stallListingsError.message}`, 'error');
            return;
        }

        const { error: stallsError } = await supabase
            .from('market_stalls')
            .update({
                stall_name: 'Deleted Character Stall',
                character_name: 'Deleted Character',
                anonymized_at: nowIso,
                updated_at: nowIso,
            })
            .in('id', stallIds);

        if (stallsError) {
            showMessage(`Failed to anonymize stalls: ${stallsError.message}`, 'error');
            return;
        }
    }

    const { error: characterError } = await supabase
        .from('characters')
        .update({
            character_name: 'Deleted Character',
            gold: 0,
            archetype: null,
            is_default_character: false,
            deleted_at: nowIso,
            anonymized_at: nowIso,
        })
        .eq('character_id', characterId);

    if (characterError) {
        showMessage(`Failed to delete character: ${characterError.message}`, 'error');
        return;
    }

    await loadOverview();
    els.characterStateFilter.value = 'deleted';
    renderCharacterSelect();
    els.characterSelect.value = characterId;
    await loadSelectedCharacterLedger();
    showMessage('Character deleted successfully.', 'success');
}

function bindEvents() {
    els.loadCharacterLedger.addEventListener('click', loadSelectedCharacterLedger);
    els.refresh.addEventListener('click', async () => {
        await loadOverview();
        if (els.characterSelect.value) await loadSelectedCharacterLedger();
    });
    els.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') renderAll();
    });
    els.characterStateFilter.addEventListener('change', renderCharacterSelect);
    els.characterSelect.addEventListener('change', () => {
        state.selectedCharacter = null;
        state.listings = [];
        state.salesByListingId = new Map();
        state.selectedListingIds.clear();
        renderAll();
        showMessage('Click Load to view the selected character ledger.', 'info');
    });
    els.listingStatusFilter.addEventListener('change', renderAll);
    els.bulkDelete.addEventListener('click', () => deleteListings([...state.selectedListingIds]));
    els.selectAll.addEventListener('change', (event) => {
        const checked = event.currentTarget.checked;
        getFilteredListings().forEach((listing) => {
            const id = Number(listing.listing_id);
            if (!isDeletableListing(listing)) return;
            if (checked) state.selectedListingIds.add(id);
            else state.selectedListingIds.delete(id);
        });
        renderListings();
    });
}

async function init() {
    setLoading(true);
    bindEvents();

    const allowed = await requireLedgerAdmin();
    setLoading(false);

    if (!allowed) {
        els.denied.classList.remove('hidden');
        return;
    }

    els.content.classList.remove('hidden');
    await loadOverview();
}

document.addEventListener('DOMContentLoaded', init);
