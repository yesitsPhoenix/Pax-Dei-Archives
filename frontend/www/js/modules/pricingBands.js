const COMPETITIVE_RISK_STORAGE_KEY = 'pda.competitiveRiskTolerance';

export const COMPETITIVE_RISK_PROFILES = {
    guarded: {
        label: 'Guarded',
        goldMultiplier: 0.7,
        pctMultiplier: 0.75,
        description: 'Keeps suggested competitive caps closer to the current floor.'
    },
    balanced: {
        label: 'Balanced',
        goldMultiplier: 1,
        pctMultiplier: 1,
        description: 'Uses the current Archives competitive pricing model.'
    },
    flexible: {
        label: 'Flexible',
        goldMultiplier: 1.35,
        pctMultiplier: 1.25,
        description: 'Allows more room above the floor when the market can support it.'
    }
};

export function getCompetitiveRiskTolerance() {
    try {
        const saved = window.localStorage?.getItem(COMPETITIVE_RISK_STORAGE_KEY);
        return COMPETITIVE_RISK_PROFILES[saved] ? saved : 'balanced';
    } catch {
        return 'balanced';
    }
}

export function setCompetitiveRiskTolerance(profile) {
    const nextProfile = COMPETITIVE_RISK_PROFILES[profile] ? profile : 'balanced';
    try {
        window.localStorage?.setItem(COMPETITIVE_RISK_STORAGE_KEY, nextProfile);
    } catch {
        // Local storage can be unavailable in some privacy modes; keep runtime defaults.
    }
    window.dispatchEvent(new CustomEvent('pda:competitive-risk-changed', {
        detail: { profile: nextProfile }
    }));
    return nextProfile;
}

function getBaseCompetitiveThresholds(marketLowStack) {
    if (marketLowStack < 5) {
        return { maxGapGold: 2, maxGapPct: 35, label: '< 5g stack' };
    }
    if (marketLowStack < 20) {
        return { maxGapGold: 5, maxGapPct: 30, label: '5g–19g stack' };
    }
    if (marketLowStack < 75) {
        return { maxGapGold: 7, maxGapPct: 25, label: '20g–74g stack' };
    }
    if (marketLowStack < 150) {
        return { maxGapGold: 12, maxGapPct: 12, label: '75g–149g stack' };
    }
    if (marketLowStack < 300) {
        return { maxGapGold: 15, maxGapPct: 10, label: '150g–299g stack' };
    }
    return { maxGapGold: 25, maxGapPct: 7, label: '300g+ stack' };
}

export function getCompetitiveThresholds(marketLowStack, profile = getCompetitiveRiskTolerance()) {
    const base = getBaseCompetitiveThresholds(marketLowStack);
    const riskProfile = COMPETITIVE_RISK_PROFILES[profile] || COMPETITIVE_RISK_PROFILES.balanced;
    return {
        ...base,
        maxGapGold: Math.max(1, Math.round(base.maxGapGold * riskProfile.goldMultiplier)),
        maxGapPct: Math.max(1, Math.round(base.maxGapPct * riskProfile.pctMultiplier)),
        baseMaxGapGold: base.maxGapGold,
        baseMaxGapPct: base.maxGapPct,
        profile
    };
}

export function classifyCompetitiveGap(gap, gapPct, marketLowStack, leadingLabel = 'leading', profile = getCompetitiveRiskTolerance()) {
    const thresholds = getCompetitiveThresholds(marketLowStack, profile);
    const status = gap < -0.001
        ? leadingLabel
        : (gap <= thresholds.maxGapGold && gapPct <= thresholds.maxGapPct ? 'competitive' : 'undercut');

    return { status, thresholds };
}

function getListingUnitPrice(listing) {
    const price = Number(listing?.price) || 0;
    const quantity = Math.max(Number(listing?.quantity) || 1, 1);
    return price / quantity;
}

export function normalizeStackGoldAmount(amount) {
    if (amount === null || amount === undefined) return null;
    const numericAmount = Number(amount);
    return Number.isFinite(numericAmount) ? Math.round(numericAmount) : null;
}

export function getStackAwareMarketLow({ exactStackListings = [], marketVariantListings = [], mktData = null, stackSize, stackPrice, avatarHash = null }) {
    if (exactStackListings.length > 0) {
        return normalizeStackGoldAmount(Math.min(...exactStackListings.map(marketListing => Number(marketListing.price) || 0)));
    }

    const externalListings = avatarHash
        ? marketVariantListings.filter(marketListing => marketListing.avatar_hash !== avatarHash)
        : marketVariantListings;

    if (externalListings.length > 0) {
        return normalizeStackGoldAmount(Math.min(...externalListings.map(getListingUnitPrice)) * stackSize);
    }

    if (marketVariantListings.length > 0) {
        return normalizeStackGoldAmount(stackPrice);
    }

    return (mktData?.marketLow ?? null) !== null
        ? normalizeStackGoldAmount(mktData.marketLow * stackSize)
        : null;
}

export function getCompetitiveBandDisplayRows() {
    return [
        'Under 5g: up to 2g and 35%',
        '5g-19g: up to 5g and 30%',
        '20g-74g: up to 7g and 25%',
        '75g-149g: up to 12g and 12%',
        '150g-299g: up to 15g and 10%',
        '300g+: up to 25g and 7%'
    ];
}
