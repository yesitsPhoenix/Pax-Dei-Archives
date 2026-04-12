import { supabase } from '../supabaseClient.js';
import { authSession } from '../authSessionManager.js';
import { questState } from './questStateManager.js';
import { applyBoardQuestFilters, buildBoardQuestFilters } from './boardQuestFilters.js';

const BOARD_POST_SELECT = `
    id,
    created_at,
    updated_at,
    status,
    post_type,
    title,
    summary,
    body_markdown,
    reward_note,
    author_user_id,
    author_character_id,
    author_character_name,
    player_contract_category,
    capacity,
    expires_at,
    visibility_scope,
    posting_region,
    posting_shard,
    posting_province,
    posting_home_valley,
    destination_region,
    destination_shard,
    destination_province,
    destination_home_valley,
    travel_required,
    remote_delivery_allowed,
    proof_mode,
    contact_note,
    is_renewable,
    renewed_from_board_quest_id,
    archived_at,
    cancelled_at,
    cancelled_by_user_id,
    report_count,
    board_quest_goals (
        id,
        sort_order,
        type,
        label,
        target,
        unit
    )
`;

const BOARD_MUTABLE_FIELDS = [
    'post_type',
    'title',
    'summary',
    'body_markdown',
    'reward_note',
    'player_contract_category',
    'capacity',
    'expires_at',
    'visibility_scope',
    'posting_region',
    'posting_shard',
    'posting_province',
    'posting_home_valley',
    'destination_region',
    'destination_shard',
    'destination_province',
    'destination_home_valley',
    'travel_required',
    'remote_delivery_allowed',
    'proof_mode',
    'contact_note',
    'is_renewable',
];

function sortGoals(goals = []) {
    return [...goals].sort((a, b) => {
        if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });
}

function normalizeGoals(goals = []) {
    return goals
        .filter((goal) => goal && goal.label)
        .map((goal, index) => ({
            sort_order: Number.isFinite(goal.sort_order) ? goal.sort_order : index,
            type: goal.type === 'checkbox' ? 'checkbox' : 'counter',
            label: goal.label,
            target: goal.type === 'checkbox' ? null : Math.max(1, Number(goal.target || 1)),
            unit: goal.unit || null,
        }));
}

function normalizeBoardQuestRecord(record) {
    const goals = sortGoals(record.board_quest_goals || []);
    return {
        ...record,
        board_quest_goals: goals,
        tracking_goals: goals.map((goal) => ({
            type: goal.type,
            label: goal.label,
            target: goal.target,
            unit: goal.unit,
        })),
    };
}

function mapAcceptanceSummary(rows = [], activeCharacterId = null) {
    const byQuest = new Map();

    rows.forEach((row) => {
        const entry = byQuest.get(row.board_quest_id) || {
            activeAcceptanceCount: 0,
            currentCharacterAcceptance: null,
            pendingConfirmationCount: 0,
        };

        entry.activeAcceptanceCount += 1;
        if (row.status === 'awaiting_confirmation') {
            entry.pendingConfirmationCount += 1;
        }
        if (activeCharacterId && row.character_id === activeCharacterId) {
            entry.currentCharacterAcceptance = row;
        }
        byQuest.set(row.board_quest_id, entry);
    });

    return byQuest;
}

async function fetchAcceptanceSummaries(boardQuestIds = [], activeCharacterId = null) {
    if (!boardQuestIds.length) return new Map();

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .select('id, board_quest_id, character_id, status, accepted_at, submitted_at, completed_at, completion_rejected_at, completion_rejection_reason')
        .in('board_quest_id', boardQuestIds)
        .in('status', ['accepted', 'in_progress', 'awaiting_confirmation']);

    if (error) throw error;
    return mapAcceptanceSummary(data || [], activeCharacterId);
}

async function fetchPendingConfirmationSummaries(boardQuestId, authorCharacterId = null) {
    if (!boardQuestId || !authorCharacterId) return [];

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .select('id, board_quest_id, character_id, character_name, status, submitted_at, completion_note, proof_note, proof_url')
        .eq('board_quest_id', boardQuestId)
        .eq('status', 'awaiting_confirmation')
        .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

async function requireUser() {
    const user = await authSession.getUser();
    if (!user) throw new Error('You must be signed in to use the quest board.');
    return user;
}

function requireActiveCharacter(character = questState.getActiveCharacter()) {
    if (!character?.character_id) {
        throw new Error('Select an active character first.');
    }
    return character;
}

function pickMutableFields(payload = {}) {
    return BOARD_MUTABLE_FIELDS.reduce((acc, key) => {
        if (payload[key] !== undefined) acc[key] = payload[key];
        return acc;
    }, {});
}

async function replaceBoardQuestGoals(boardQuestId, goals = []) {
    const { error: deleteError } = await supabase
        .from('board_quest_goals')
        .delete()
        .eq('board_quest_id', boardQuestId);

    if (deleteError) throw deleteError;

    const normalizedGoals = normalizeGoals(goals);
    if (!normalizedGoals.length) return [];

    const { data, error } = await supabase
        .from('board_quest_goals')
        .insert(normalizedGoals.map((goal) => ({
            board_quest_id: boardQuestId,
            sort_order: goal.sort_order,
            type: goal.type,
            label: goal.label,
            target: goal.target,
            unit: goal.unit,
        })))
        .select('*');

    if (error) throw error;
    return sortGoals(data || []);
}

export async function listBoardQuests(options = {}) {
    await questState.initialize();
    const activeCharacter = questState.getActiveCharacter();
    const filters = buildBoardQuestFilters(options.filters || {}, activeCharacter);

    const { data, error } = await supabase
        .from('board_quests')
        .select(BOARD_POST_SELECT)
        .order('created_at', { ascending: false });

    if (error) throw error;

    const posts = (data || []).map(normalizeBoardQuestRecord);
    const summaries = await fetchAcceptanceSummaries(posts.map((post) => post.id), activeCharacter?.character_id || null);

    const enriched = posts.map((post) => {
        const summary = summaries.get(post.id) || { activeAcceptanceCount: 0, currentCharacterAcceptance: null, pendingConfirmationCount: 0 };
        return {
            ...post,
            activeAcceptanceCount: summary.activeAcceptanceCount,
            currentCharacterAcceptance: summary.currentCharacterAcceptance,
            pendingConfirmationCount: post.author_character_id === activeCharacter?.character_id
                ? summary.pendingConfirmationCount
                : 0,
            slotsRemaining: Math.max(0, (post.capacity || 0) - summary.activeAcceptanceCount),
        };
    });

    return applyBoardQuestFilters(enriched, filters, activeCharacter);
}

export async function getBoardQuestById(boardQuestId, options = {}) {
    if (!boardQuestId) throw new Error('boardQuestId is required.');
    await questState.initialize();

    const { data, error } = await supabase
        .from('board_quests')
        .select(BOARD_POST_SELECT)
        .eq('id', boardQuestId)
        .single();

    if (error) throw error;

    const post = normalizeBoardQuestRecord(data);
    const activeCharacterId = options.characterId || questState.getActiveCharacterId();
    const summaries = await fetchAcceptanceSummaries([boardQuestId], activeCharacterId);
    const summary = summaries.get(boardQuestId) || { activeAcceptanceCount: 0, currentCharacterAcceptance: null, pendingConfirmationCount: 0 };
    const pendingConfirmations = post.author_character_id === activeCharacterId
        ? await fetchPendingConfirmationSummaries(boardQuestId, post.author_character_id)
        : [];

    return {
        ...post,
        activeAcceptanceCount: summary.activeAcceptanceCount,
        currentCharacterAcceptance: summary.currentCharacterAcceptance,
        pendingConfirmationCount: post.author_character_id === activeCharacterId ? summary.pendingConfirmationCount : 0,
        pendingConfirmations,
        slotsRemaining: Math.max(0, (post.capacity || 0) - summary.activeAcceptanceCount),
    };
}

export async function createBoardQuest(payload = {}) {
    await questState.initialize();
    const user = await requireUser();
    const character = requireActiveCharacter();

    const insertPayload = {
        ...pickMutableFields(payload),
        author_user_id: user.id,
        author_character_id: character.character_id,
        author_character_name: character.character_name,
        status: 'posted',
        visibility_scope: payload.visibility_scope || 'public',
    };

    const { data, error } = await supabase
        .from('board_quests')
        .insert(insertPayload)
        .select('id')
        .single();

    if (error) throw error;

    if (payload.goals) {
        await replaceBoardQuestGoals(data.id, payload.goals);
    }

    return getBoardQuestById(data.id, { characterId: character.character_id });
}

export async function updateBoardQuest(boardQuestId, payload = {}) {
    if (!boardQuestId) throw new Error('boardQuestId is required.');
    await questState.initialize();

    const { error } = await supabase
        .from('board_quests')
        .update(pickMutableFields(payload))
        .eq('id', boardQuestId);

    if (error) throw error;

    if (payload.goals) {
        await replaceBoardQuestGoals(boardQuestId, payload.goals);
    }

    return getBoardQuestById(boardQuestId);
}

export async function cancelBoardQuest(boardQuestId) {
    if (!boardQuestId) throw new Error('boardQuestId is required.');
    const user = await requireUser();

    const { error } = await supabase
        .from('board_quests')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by_user_id: user.id,
        })
        .eq('id', boardQuestId);

    if (error) throw error;
    return getBoardQuestById(boardQuestId);
}

export async function validateBoardQuestAcceptance(boardQuestId, characterId = null) {
    await questState.initialize();
    const activeCharacter = requireActiveCharacter(characterId ? { character_id: characterId } : questState.getActiveCharacter());
    const { data, error } = await supabase.rpc('can_accept_board_quest', {
        p_board_quest_id: boardQuestId,
        p_character_id: activeCharacter.character_id,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    return result || { can_accept: false, reason: 'unknown' };
}

export async function acceptBoardQuest(boardQuestId, options = {}) {
    const user = await requireUser();
    await questState.initialize();
    const character = options.character || requireActiveCharacter();

    const validation = await validateBoardQuestAcceptance(boardQuestId, character.character_id);
    if (!validation.can_accept) {
        throw new Error(`Unable to accept this quest (${validation.reason}).`);
    }

    const post = await getBoardQuestById(boardQuestId, { characterId: character.character_id });
    const confirmationRequired = post.proof_mode !== 'self_complete';

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .insert({
            board_quest_id: boardQuestId,
            user_id: user.id,
            character_id: character.character_id,
            character_name: character.character_name,
            status: 'accepted',
            confirmation_required: confirmationRequired,
            accepted_reward_note: post.reward_note || null,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function withdrawBoardQuestAcceptance(acceptanceId, withdrawReason = null) {
    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .update({
            status: 'withdrawn',
            withdrawn_at: new Date().toISOString(),
            withdraw_reason: withdrawReason,
        })
        .eq('id', acceptanceId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function submitBoardQuestCompletion(acceptanceId, payload = {}) {
    const { data: acceptance, error: fetchError } = await supabase
        .from('board_quest_acceptances')
        .select('*')
        .eq('id', acceptanceId)
        .single();

    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    const updatePayload = {
        completion_note: payload.completionNote || null,
        proof_note: payload.proofNote || null,
        proof_url: payload.proofUrl || null,
        submitted_at: now,
        completion_rejected_at: null,
        completion_rejected_by_user_id: null,
        completion_rejection_reason: null,
    };

    if (acceptance.confirmation_required) {
        updatePayload.status = 'awaiting_confirmation';
    } else {
        updatePayload.status = 'completed';
        updatePayload.completed_at = now;
    }

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .update(updatePayload)
        .eq('id', acceptanceId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function confirmBoardQuestCompletion(acceptanceId) {
    const user = await requireUser();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .update({
            status: 'completed',
            confirmed_at: now,
            confirmed_by_user_id: user.id,
            completed_at: now,
        })
        .eq('id', acceptanceId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function rejectBoardQuestCompletion(acceptanceId, reason) {
    const user = await requireUser();
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
        throw new Error('A rejection reason is required.');
    }

    const { data, error } = await supabase
        .from('board_quest_acceptances')
        .update({
            status: 'in_progress',
            completion_note: null,
            proof_note: null,
            proof_url: null,
            submitted_at: null,
            completion_rejected_at: new Date().toISOString(),
            completion_rejected_by_user_id: user.id,
            completion_rejection_reason: normalizedReason,
        })
        .eq('id', acceptanceId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function saveBoardQuestProgress({ acceptanceId, boardQuestId, goalIndex, value, characterId = null }) {
    await questState.initialize();
    const activeCharacter = requireActiveCharacter(characterId ? { character_id: characterId } : questState.getActiveCharacter());

    const { data, error } = await supabase
        .from('board_quest_progress')
        .upsert({
            acceptance_id: acceptanceId,
            board_quest_id: boardQuestId,
            character_id: activeCharacter.character_id,
            goal_index: goalIndex,
            value,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'acceptance_id,goal_index'
        })
        .select('*');

    if (error) throw error;
    return data || [];
}

export async function getAcceptedBoardQuestsForActiveCharacter() {
    await questState.initialize();
    const activeCharacterId = questState.getActiveCharacterId();
    if (!activeCharacterId) return [];

    const { data, error } = await supabase
        .from('accepted_player_contract_quests_v')
        .select('*')
        .eq('character_id', activeCharacterId)
        .order('accepted_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getCompletedBoardContractsForCharacter(characterId = null) {
    await questState.initialize();
    const targetCharacterId = characterId || questState.getActiveCharacterId();
    if (!targetCharacterId) return [];

    const { data, error } = await supabase
        .from('completed_player_contracts_v')
        .select('*')
        .eq('character_id', targetCharacterId)
        .order('completed_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function reportBoardQuest(boardQuestId, reason, details = null) {
    const user = await requireUser();
    const { data, error } = await supabase
        .from('board_quest_reports')
        .insert({
            board_quest_id: boardQuestId,
            reported_by_user_id: user.id,
            reason,
            details,
            status: 'open',
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
}
