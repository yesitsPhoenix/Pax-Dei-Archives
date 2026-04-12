const DEFAULT_POST_STATUS = 'active';

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function isBoardQuestExpired(post, now = new Date()) {
    if (!post?.expires_at) return false;
    const expiresAt = new Date(post.expires_at);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt <= now;
}

export function parseBoardQuestShareLink(url = window.location.href) {
    const parsed = new URL(url, window.location.origin);
    const postId = parsed.searchParams.get('post');
    return postId ? { postId } : { postId: null };
}

export function buildBoardQuestFilters(input = {}, activeCharacter = null) {
    return {
        search: normalizeString(input.search).toLowerCase(),
        category: normalizeString(input.category),
        postType: normalizeString(input.postType),
        proofMode: normalizeString(input.proofMode),
        status: normalizeString(input.status) || DEFAULT_POST_STATUS,
        region: normalizeString(input.region) || normalizeString(activeCharacter?.region) || normalizeString(activeCharacter?.region_name),
        shard: normalizeString(input.shard) || normalizeString(activeCharacter?.shard),
        province: normalizeString(input.province),
        homeValley: normalizeString(input.homeValley),
        includeRemote: input.includeRemote === true,
        mineOnly: input.mineOnly === true,
        acceptedOnly: input.acceptedOnly === true,
    };
}

function matchesText(post, search) {
    if (!search) return true;
    const haystack = [
        post.title,
        post.summary,
        post.body_markdown,
        post.reward_note,
        post.author_character_name,
        post.player_contract_category,
        post.contact_note,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(search);
}

function matchesGeography(post, filters) {
    if (filters.region && normalizeString(post.posting_region) !== filters.region) return false;
    if (filters.shard && normalizeString(post.posting_shard) !== filters.shard) return false;
    if (filters.province && normalizeString(post.posting_province) !== filters.province) return false;
    if (filters.homeValley && normalizeString(post.posting_home_valley) !== filters.homeValley) return false;
    return true;
}

function matchesStatus(post, filters, now = new Date()) {
    const expired = isBoardQuestExpired(post, now);
    const status = normalizeString(post.status);

    switch (filters.status) {
        case 'all':
            return true;
        case 'expired':
            return expired || status === 'expired';
        case 'fulfilled':
            return status === 'fulfilled';
        case 'cancelled':
            return status === 'cancelled';
        case 'archived':
            return status === 'archived';
        case 'active':
        default:
            return status === 'posted' && !expired;
    }
}

export function applyBoardQuestFilters(posts = [], filters = {}, activeCharacter = null, now = new Date()) {
    const normalized = buildBoardQuestFilters(filters, activeCharacter);

    return posts.filter((post) => {
        if (!matchesStatus(post, normalized, now)) return false;
        if (!matchesText(post, normalized.search)) return false;
        if (!matchesGeography(post, normalized)) return false;
        if (normalized.category && normalizeString(post.player_contract_category) !== normalized.category) return false;
        if (normalized.postType && normalizeString(post.post_type) !== normalized.postType) return false;
        if (normalized.proofMode && normalizeString(post.proof_mode) !== normalized.proofMode) return false;
        if (!normalized.includeRemote && post.remote_delivery_allowed === true && normalized.status === 'active') return false;
        if (normalized.mineOnly && post.author_character_id !== activeCharacter?.character_id) return false;
        if (normalized.acceptedOnly && !post.currentCharacterAcceptance) return false;
        return true;
    });
}
