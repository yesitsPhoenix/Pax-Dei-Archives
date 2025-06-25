import { isLoggedIn, getUserProfile, getDungeonRuns, deleteDungeonRun, updateDungeonRun } from './utils.js';
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.classList.contains('profile-page')) {
        const profileMessage = document.getElementById('profileMessage');
        const profileLoading = document.getElementById('profileLoading');
        const profileInfoDiv = document.getElementById('profile-info');

        const savedRunsList = document.getElementById('saved-runs-list');
        const transactionSummaryList = document.getElementById('transaction-summary-list');

        const viewRunModalOverlay = document.getElementById('viewRunModalOverlay');
        const closeViewRunModalButton = document.getElementById('closeViewRunModal');
        const viewRunDetailsDiv = document.getElementById('viewRunDetails');

        const editRunModalOverlay = document.getElementById('editRunModalOverlay');
        const closeEditRunModalButton = document.getElementById('closeEditRunModal');
        const editRunForm = document.getElementById('editRunForm');

        const confirmModalOverlay = document.getElementById('confirmModalOverlay');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmDeleteButton = document.getElementById('confirmDeleteButton');
        const cancelDeleteButton = document.getElementById('cancelDeleteButton');
        let runIdToDelete = null;

        const DEFAULT_AVATAR_URL = 'https://cdn.discordapp.com/embed/avatars/0.png';

        function showProfileMessage(messageElement, message, type) {
            messageElement.textContent = message;
            messageElement.className = '';
            messageElement.style.display = 'none';

            if (message) {
                messageElement.style.display = 'block';
                messageElement.classList.add('px-4', 'py-3', 'rounded', 'mb-4', 'border');

                if (type === 'success') {
                    messageElement.classList.add('bg-green-100', 'border-green-400', 'text-green-700');
                } else if (type === 'error') {
                    messageElement.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
                } else {
                    messageElement.classList.add('bg-blue-100', 'border-blue-400', 'text-blue-700');
                }

                setTimeout(() => {
                    messageElement.style.display = 'none';
                    messageElement.textContent = '';
                    messageElement.className = '';
                    messageElement.classList.add('hidden');
                }, 5000);
            }
        }

        closeViewRunModalButton.addEventListener('click', () => {
            viewRunModalOverlay.classList.remove('active');
        });

        closeEditRunModalButton.addEventListener('click', () => {
            editRunModalOverlay.classList.remove('active');
            showProfileMessage(profileMessage, '', '');
        });

        cancelDeleteButton.addEventListener('click', () => {
            confirmModalOverlay.classList.remove('active');
            runIdToDelete = null;
            showProfileMessage(profileMessage, '', '');
        });

        confirmDeleteButton.addEventListener('click', async () => {
            if (runIdToDelete) {
                const success = await deleteDungeonRun(runIdToDelete);
                if (success) {
                    showProfileMessage(profileMessage, 'Run deleted successfully!', 'success');
                    confirmModalOverlay.classList.remove('active');
                } else {
                    showProfileMessage(profileMessage, 'Failed to delete run.', 'error');
                }
            }
            runIdToDelete = null;
        });

        editRunForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const runId = document.getElementById('editRunId').value;

            const updatedData = {
                dungeon_name: document.getElementById('editDungeonName').value,
                current_total_gold: parseFloat(document.getElementById('editCurrentTotalGold').value) || 0,
                last_loot_distribution_log: document.getElementById('editLastLootDistributionLog').value,
                last_gold_distribution_log: document.getElementById('editLastGoldDistributionLog').value,
                next_loot_recipient_index: parseInt(document.getElementById('editNextLootRecipientIndex').value) || 0,
                distribution_results_html: document.getElementById('editDistributionResultsHtml').value
            };

            const partyMembersInput = document.getElementById('editPartyMembers').value;
            updatedData.party_members = partyMembersInput ? partyMembersInput.split(',').map(name => ({ name: name.trim(), items: [], goldShare: 0, reservedItems: [] })) : [];

            const currentLootItemsInput = document.getElementById('editCurrentLootItems').value;
            updatedData.current_loot_items = currentLootItemsInput ? currentLootItemsInput.split(',').map(item => item.trim()) : [];

            try {
                const reservedItemsInput = document.getElementById('editReservedItems').value;
                updatedData.reserved_items = reservedItemsInput ? JSON.parse(reservedItemsInput) : {};
            } catch (e) {
                showProfileMessage(profileMessage, 'Invalid JSON for Reserved Items. Please check the format. Error: ' + e.message, 'error');
                return;
            }

            const result = await updateDungeonRun(runId, updatedData);
            if (result) {
                showProfileMessage(profileMessage, 'Run updated successfully!', 'success');
                editRunModalOverlay.classList.remove('active');
            } else {
                showProfileMessage(profileMessage, 'Failed to update run.', 'error');
            }
        });


        
        const viewRun = (runId, allRuns) => {
            const run = allRuns.find(r => r.id === runId);
            if (run) {
                const partyMembersDisplay = run.party_members && Array.isArray(run.party_members)
                    ? run.party_members.map(member => member.name).filter(name => name).join(', ')
                    : 'N/A';

                const currentLootItemsDisplay = run.current_loot_items && Array.isArray(run.current_loot_items)
                    ? run.current_loot_items.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item && typeof item.name === 'string') {
                            return `${item.name}${item.quantity ? ` (x${item.quantity})` : ''}`;
                        }
                        return '';
                    }).filter(Boolean).join(', ')
                    : 'N/A';

                let reservedItemsDisplay = 'N/A';
                if (run.reserved_items && typeof run.reserved_items === 'object' && Object.keys(run.reserved_items).length > 0) {
                    reservedItemsDisplay = Object.entries(run.reserved_items)
                        .map(([playerName, items]) => {
                            const formattedItems = items.map(item => {
                                if (item.item && typeof item.item.name === 'string') {
                                    return `${item.item.name}${item.quantity ? ` (x${item.quantity})` : ''}`;
                                }
                                return '';
                            }).filter(Boolean).join(', ');
                            return `${playerName}: ${formattedItems}`;
                        })
                        .join('\n');
                }

                viewRunDetailsDiv.innerHTML = `
                    <p><strong>Dungeon Name:</strong> <pre><code>${run.dungeon_name}</code></pre></p>
                    <p><strong>Party Members:</strong> <pre><code>${partyMembersDisplay}</code></pre></p>
                    <p><strong>Current Loot Items:</strong> <pre><code>${currentLootItemsDisplay}</code></pre></p>
                    <p><strong>Current Total Gold:</strong> <pre><code>${run.current_total_gold}</code></pre></p>
                    <p><strong>Last Loot Distribution Log:</strong> <pre><code>${run.last_loot_distribution_log || 'N/A'}</code></pre></p>
                    <p><strong>Last Gold Distribution Log:</strong> <pre><code>${run.last_gold_distribution_log || 'N/A'}</code></pre></p>
                    <p><strong>Timestamp:</strong> <pre><code>${new Date(run.timestamp).toLocaleString()}</code></pre></p>
                    <p><strong>User ID:</strong> <pre><code>${run.user_id}</code></pre></p>
                    <p><strong>Reserved Items:</strong> <pre><code>${reservedItemsDisplay}</code></pre></p>
                    <p><strong>Distribution Results HTML:</strong> <pre><code>${run.distribution_results_html || 'N/A'}</code></pre></p>
                    <p><strong>Next Loot Recipient Index:</strong> <pre><code>${run.next_loot_recipient_index}</code></pre></p>
                `;
                viewRunModalOverlay.classList.add('active');
            } else {
                console.error('Run not found for viewing:', runId);
                showProfileMessage(profileMessage, 'Error: Run not found for viewing.', 'error');
            }
        };

        const editRun = (runId, allRuns) => {
            const run = allRuns.find(r => r.id === runId);
            if (run) {
                document.getElementById('editRunId').value = run.id;
                document.getElementById('editDungeonName').value = run.dungeon_name;

                document.getElementById('editPartyMembers').value = run.party_members ? run.party_members.map(member => member.name).filter(name => name).join(', ') : '';
                document.getElementById('editCurrentLootItems').value = run.current_loot_items ? run.current_loot_items.map(item => {
                    if (typeof item === 'string') {
                        return item;
                    } else if (item && typeof item.name === 'string') {
                        return `${item.name}${item.quantity ? ` (x${item.quantity})` : ''}`;
                    }
                    return '';
                }).filter(Boolean).join(', ') : '';

                document.getElementById('editCurrentTotalGold').value = run.current_total_gold;
                document.getElementById('editLastLootDistributionLog').value = run.last_loot_distribution_log || '';
                document.getElementById('editLastGoldDistributionLog').value = run.last_gold_distribution_log || '';
                document.getElementById('editNextLootRecipientIndex').value = run.next_loot_recipient_index;

                document.getElementById('editReservedItems').value = run.reserved_items ? JSON.stringify(run.reserved_items, null, 2) : '{}';

                document.getElementById('editDistributionResultsHtml').value = run.distribution_results_html || '';

                editRunModalOverlay.classList.add('active');
            } else {
                console.error('Run not found for editing:', runId);
                showProfileMessage(profileMessage, 'Error: Run not found for editing.', 'error');
            }
        };

        const showConfirmDeleteModal = (runId) => {
            runIdToDelete = runId;
            confirmModalOverlay.classList.add('active');
        };

        const closeModalsOnClickOutside = (event) => {
            if (event.target === viewRunModalOverlay) {
                viewRunModalOverlay.classList.remove('active');
            }
            if (event.target === editRunModalOverlay) {
                editRunModalOverlay.classList.remove('active');
                showProfileMessage(profileMessage, '', '');
            }
            if (event.target === confirmModalOverlay) {
                confirmModalOverlay.classList.remove('active');
                showProfileMessage(profileMessage, '', '');
            }
        };

        viewRunModalOverlay.addEventListener('click', closeModalsOnClickOutside);
        editRunModalOverlay.addEventListener('click', closeModalsOnClickOutside);
        confirmModalOverlay.addEventListener('click', closeModalsOnClickOutside);

        if (await isLoggedIn()) {
            const userProfile = await getUserProfile();

            if (userProfile) {
                document.getElementById('user-avatar').src = userProfile.avatar_url || DEFAULT_AVATAR_URL;
                document.getElementById('user-discord-name').innerText = userProfile.username;
                document.getElementById('user-discord-id').innerText = userProfile.discord_user_id;
                document.getElementById('user-created-at').innerText = new Date(userProfile.created_at).toLocaleDateString();
                document.getElementById('user-last-login-at').innerText = new Date(userProfile.last_login_at).toLocaleDateString();

                profileLoading.style.display = 'none';
                profileInfoDiv.style.display = 'block';

                if (savedRunsList) {
                    savedRunsList.style.display = 'none';
                }
                if (transactionSummaryList) { 
                    transactionSummaryList.style.display = 'none';
                }


            } else {
                profileLoading.innerText = 'Failed to load profile. Please ensure you are logged in correctly.';
                showProfileMessage(profileMessage, 'Failed to load profile. Please ensure you are logged in correctly.', 'error');
            }
        } else {
            showProfileMessage(profileMessage, 'You must be logged in to view your profile.', 'error');
            alert('You must be logged in to view your profile.');
            window.location.href = 'index.html';
        }
    }
});

