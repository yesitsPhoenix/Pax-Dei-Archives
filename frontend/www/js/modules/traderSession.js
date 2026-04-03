import { authSession } from '../authSessionManager.js';

export function createTraderSessionController({
    supabase,
    insertCharacterModalHtml,
    initializeCharacters,
    initializeListings,
    initializeSales,
    onLoadTraderPageData
}) {
    let currentUser = null;

    function getCurrentUser() {
        return currentUser;
    }

    function applyAuthenticationState(user) {
        const traderLoginContainer = document.getElementById('traderLoginContainer');
        const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');
        const avatarIdCard = document.getElementById('avatar-id-card');

        currentUser = user || null;

        if (user) {
            if (traderLoginContainer) {
                traderLoginContainer.style.display = 'none';
            }
            if (traderDashboardAndForms) {
                traderDashboardAndForms.style.display = 'block';
            }
            if (avatarIdCard) {
                avatarIdCard.classList.remove('hidden');
            }
            return;
        }

        if (traderLoginContainer) {
            traderLoginContainer.style.display = 'block';
        }
        if (traderDashboardAndForms) {
            traderDashboardAndForms.style.display = 'none';
        }
        if (avatarIdCard) {
            avatarIdCard.classList.add('hidden');
        }
    }

    async function checkUser() {
        const user = await authSession.getUser();
        applyAuthenticationState(user);

        if (user) {
            insertCharacterModalHtml();
            await initializeCharacters(user.id, async () => {
                await onLoadTraderPageData();
            });
            initializeListings(user.id);
            initializeSales();
            return;
        }

        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }

    async function fetchCharacterActivity(characterId) {
        if (!characterId) return [];

        const { data, error } = await supabase.rpc('get_all_character_activity_json', {
            p_character_id: characterId
        });

        if (error) {
            console.error('Error fetching character activity using RPC:', error);
            return [];
        }
        return data;
    }

    function processCharacterActivityData(rawData) {
        if (!rawData) return [];

        const { sales, purchases, cancellations, listing_fees, pve_transactions } = rawData;
        const allTransactions = [
            ...(sales || []),
            ...(purchases || []),
            ...(cancellations || []),
            ...(listing_fees || []),
            ...(pve_transactions || [])
        ];
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        return allTransactions;
    }

    return {
        getCurrentUser,
        checkUser,
        fetchCharacterActivity,
        processCharacterActivityData
    };
}
