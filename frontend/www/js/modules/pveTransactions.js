export const PVE_LEDGER_TRANSACTION_TYPE = 'PVE Gold';

export const PVE_TRANSACTION_SOURCES = [
    { value: 'Dungeon', label: 'Dungeon Run' },
    { value: 'POI', label: 'POI Clear' },
    { value: 'Achievement', label: 'Achievement Reward' },
    { value: 'Chest_withdrawal', label: 'Chest Withdrawal (positive amt)' },
    { value: 'Chest_deposit', label: 'Chest Deposit (negative amt)' },
    { value: 'Grace', label: 'Grace Purchase' },
    { value: 'World_encounter', label: 'Random World Encounter' },
    { value: 'Other', label: 'Other' }
];

export const isPveGoldTransaction = (transactionType = '') => (
    transactionType.trim().toLowerCase() === PVE_LEDGER_TRANSACTION_TYPE.toLowerCase()
);

export const getPveSourceBucket = (description = '') => {
    const normalizedDescription = description.toLowerCase().replace(/_/g, ' ').trim();

    if (normalizedDescription.includes('dungeon')) return 'dungeon';
    if (normalizedDescription.includes('poi') || normalizedDescription.includes('world encounter')) return 'poi';
    if (normalizedDescription.includes('achievement')) return 'achievement';
    if (normalizedDescription.includes('grace')) return 'grace';

    return 'other';
};
