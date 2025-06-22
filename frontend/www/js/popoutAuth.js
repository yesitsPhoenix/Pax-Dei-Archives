import { isLoggedIn, logout, getUserProfile, getDungeonRuns, deleteDungeonRun, updateDungeonRun } from '/frontend/www/js/utils.js';
import { supabase } from '/frontend/www/js/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const floatingAvatarContainer = document.getElementById('floating-avatar-container');
    const floatingAvatar = document.getElementById('floating-avatar');
    const authModal = document.getElementById('auth-modal');
    const modalContentWrapper = document.getElementById('modal-content-wrapper');

    const storedAvatarUrl = sessionStorage.getItem('userAvatarUrl');
    if (storedAvatarUrl) {
        floatingAvatar.src = storedAvatarUrl;
        floatingAvatar.classList.add('loaded');
    } else {
        floatingAvatar.classList.remove('loaded');
    }

    const updateAuthUI = async () => {
        if (await isLoggedIn()) {
            const userProfile = await getUserProfile();
            const userName = userProfile ? userProfile.username : 'Guest';
            const avatarUrl = userProfile ? (userProfile.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png') : 'https://cdn.discordapp.com/embed/avatars/0.png';

            floatingAvatar.src = avatarUrl;
            floatingAvatar.classList.add('loaded');e
            sessionStorage.setItem('userAvatarUrl', avatarUrl);

            modalContentWrapper.innerHTML = `
                <img src="${avatarUrl}" alt="User Avatar" class="modal-avatar">
                <h4>Welcome, ${userName}!</h4>
                <a href="profile.html" class="profile-button modal-button">
                    <i class="fa-solid fa-user"></i> My Profile
                </a>
                <button id="logoutButton" class="logout-button modal-button">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            `;
            document.getElementById('logoutButton').addEventListener('click', async () => {
                await logout();
                sessionStorage.removeItem('userAvatarUrl');
                authModal.classList.remove('open');
                updateAuthUI();
            });
        } else {
            floatingAvatar.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
            floatingAvatar.classList.remove('loaded');
            sessionStorage.removeItem('userAvatarUrl');
            modalContentWrapper.innerHTML = `
                <h4>Join the Archives!</h4>
                <button id="discordLoginButton" class="login-button modal-button">
                    <i class="fa-brands fa-discord"></i> Login with Discord
                </button>
            `;
            document.getElementById('discordLoginButton').addEventListener('click', async () => {
                await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: window.location.origin + '/profile.html',
                        scopes: 'identify'
                    }
                });
            });
        }
    };

    floatingAvatarContainer.addEventListener('mouseenter', () => {
        authModal.classList.add('open');
    });

    authModal.addEventListener('mouseleave', () => {
        authModal.classList.remove('open');
    });

    updateAuthUI();

    if (document.body.classList.contains('profile-page')) {
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

        closeViewRunModalButton.addEventListener('click', () => {
            viewRunModalOverlay.classList.remove('active');
        });

        closeEditRunModalButton.addEventListener('click', () => {
            editRunModalOverlay.classList.remove('active');
        });

        cancelDeleteButton.addEventListener('click', () => {
            confirmModalOverlay.classList.remove('active');
            runIdToDelete = null;
        });

        confirmDeleteButton.addEventListener('click', async () => {
            if (runIdToDelete) {
                const success = await deleteDungeonRun(runIdToDelete);
                if (success) {
                    alert('Run deleted successfully!');
                    confirmModalOverlay.classList.remove('active');
                    loadSavedRuns();
                } else {
                    alert('Failed to delete run.');
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
            updatedData.party_members = partyMembersInput ? partyMembersInput.split(',').map(name => ({name: name.trim(), items: [], goldShare: 0, reservedItems: []})) : [];

            const currentLootItemsInput = document.getElementById('editCurrentLootItems').value;
            updatedData.current_loot_items = currentLootItemsInput ? currentLootItemsInput.split(',').map(item => item.trim()) : [];

            try {
                const reservedItemsInput = document.getElementById('editReservedItems').value;
                updatedData.reserved_items = reservedItemsInput ? JSON.parse(reservedItemsInput) : {};
            } catch (e) {
                alert('Invalid JSON for Reserved Items. Please check the format. Error: ' + e.message);
                return;
            }
            
            const result = await updateDungeonRun(runId, updatedData);
            if (result) {
                alert('Run updated successfully!');
                editRunModalOverlay.classList.remove('active');
                loadSavedRuns();
            } else {
                alert('Failed to update run.');
            }
        });

        const loadSavedRuns = async () => {
            savedRunsList.innerHTML = '<div class="loading-indicator">Loading saved runs...</div>';
            const user = await supabase.auth.getUser();
            if (user.data.user) {
                const runs = await getDungeonRuns(user.data.user.id);
                renderRuns(runs);
            } else {
                savedRunsList.innerHTML = '<p>Please log in to view your saved runs.</p>';
            }
        };

        const renderRuns = (runs) => {
            if (runs && runs.length > 0) {
                savedRunsList.innerHTML = '';
                runs.forEach(run => {
                    const runCard = document.createElement('div');
                    runCard.classList.add('run-card');
                    runCard.innerHTML = `
                        <h5>${run.dungeon_name}</h5>
                        <p>Last Updated: ${new Date(run.timestamp).toLocaleString()}</p>
                        <div class="run-actions">
                            <button class="view-run-button modal-button" data-id="${run.id}">View</button>
                            <button class="edit-run-button modal-button" data-id="${run.id}">Edit</button>
                            <button class="delete-run-button modal-button" data-id="${run.id}">Delete</button>
                        </div>
                    `;
                    savedRunsList.appendChild(runCard);
                });

                document.querySelectorAll('.view-run-button').forEach(button => {
                    button.addEventListener('click', (event) => viewRun(event.target.dataset.id, runs));
                });
                document.querySelectorAll('.edit-run-button').forEach(button => {
                    button.addEventListener('click', (event) => editRun(event.target.dataset.id, runs));
                });
                document.querySelectorAll('.delete-run-button').forEach(button => {
                    button.addEventListener('click', (event) => showConfirmDeleteModal(event.target.dataset.id));
                });
            } else {
                savedRunsList.innerHTML = '<p>No saved runs yet. Start tracking your loot!</p>';
            }
        };

        const viewRun = (runId, allRuns) => {
            console.log('Attempting to view run with ID:', runId);
            const run = allRuns.find(r => r.id === runId);
            if (run) {
                console.log('Found run for viewing:', run);
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
                    <p><strong>Owner ID:</strong> <pre><code>${run.owner_id}</code></pre></p>
                    <p><strong>Reserved Items:</strong> <pre><code>${reservedItemsDisplay}</code></pre></p>
                    <p><strong>Distribution Results HTML:</strong> <pre><code>${run.distribution_results_html || 'N/A'}</code></pre></p>
                    <p><strong>Next Loot Recipient Index:</strong> <pre><code>${run.next_loot_recipient_index}</code></pre></p>
                `;
                viewRunModalOverlay.classList.add('active');
            } else {
                console.error('Run not found for viewing:', runId);
            }
        };

        const editRun = (runId, allRuns) => {
            console.log('Attempting to edit run with ID:', runId);
            const run = allRuns.find(r => r.id === runId);
            if (run) {
                console.log('Found run for editing:', run);
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
            }
        };

        const showConfirmDeleteModal = (runId) => {
            console.log('Delete button clicked for run ID:', runId);
            runIdToDelete = runId;
            confirmModalOverlay.classList.add('active');
        };

        const closeModalsOnClickOutside = (event) => {
            if (event.target === viewRunModalOverlay) {
                viewRunModalOverlay.classList.remove('active');
            }
            if (event.target === editRunModalOverlay) {
                editRunModalOverlay.classList.remove('active');
            }
            if (event.target === confirmModalOverlay) {
                confirmModalOverlay.classList.remove('active');
            }
        };

        viewRunModalOverlay.addEventListener('click', closeModalsOnClickOutside);
        editRunModalOverlay.addEventListener('click', closeModalsOnClickOutside);
        confirmModalOverlay.addEventListener('click', closeModalsOnClickOutside);

        if (await isLoggedIn()) {
            const userProfile = await getUserProfile();

            if (userProfile) {
                document.getElementById('user-avatar').src = userProfile.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
                document.getElementById('user-discord-name').innerText = userProfile.username;
                document.getElementById('user-discord-id').innerText = userProfile.discord_user_id;
                document.getElementById('user-created-at').innerText = new Date(userProfile.created_at).toLocaleDateString();
                document.getElementById('user-last-login-at').innerText = new Date(userProfile.last_login_at).toLocaleDateString();

                profileLoading.style.display = 'none';
                profileInfoDiv.style.display = 'block';

                loadSavedRuns();

            } else {
                profileLoading.innerText = 'Failed to load profile. Please ensure you are logged in correctly.';
            }
        } else {
            alert('You must be logged in to view your profile.');
            window.location.href = 'index.html';
        }
    }
});