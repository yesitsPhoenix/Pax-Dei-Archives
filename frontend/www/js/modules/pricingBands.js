export function getCompetitiveThresholds(marketLowStack) {
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

export function classifyCompetitiveGap(gap, gapPct, marketLowStack, leadingLabel = 'leading') {
    const thresholds = getCompetitiveThresholds(marketLowStack);
    const status = gap < -0.001
        ? leadingLabel
        : (gap <= thresholds.maxGapGold && gapPct <= thresholds.maxGapPct ? 'competitive' : 'undercut');

    return { status, thresholds };
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
