/**
 * Populate region dropdowns for character creation with cascading
 */
async function populateCharacterRegionDropdowns() {
    if (!cachedRegions) {
        const { data, error } = await supabase
            .from('regions')
            .select('id, region_name, shard, province, home_valley')
            .order('region_name', { ascending: true })
            .order('shard', { ascending: true })
            .order('province', { ascending: true })
            .order('home_valley', { ascending: true });

        if (error) {
            console.error('Error fetching regions:', error);
            await showCustomModal('Error', 'Failed to load region data.', [{ text: 'OK', value: true }]);
            return;
        }
        cachedRegions = data;
    }

    const regionSelect = document.getElementById('newCharacterRegionNameSelect');
    const shardSelect = document.getElementById('newCharacterShardSelect');
    const provinceSelect = document.getElementById('newCharacterProvinceSelect');
    const valleySelect = document.getElementById('newCharacterHomeValleySelect');

    if (!regionSelect || !shardSelect || !provinceSelect || !valleySelect) return;

    // Get distinct regions
    const distinctRegions = [...new Set(cachedRegions.map(r => r.region_name))];
    
    regionSelect.innerHTML = '<option value="">Select Region</option>';
    distinctRegions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        // Change USA to NA
        option.textContent = region === 'USA' ? 'NA' : region;
        regionSelect.appendChild(option);
    });

    // Region change handler
    regionSelect.addEventListener('change', () => {
        const filtered = cachedRegions.filter(r => r.region_name === regionSelect.value);
        const shards = [...new Set(filtered.map(r => r.shard))];
        
        shardSelect.innerHTML = '<option value="">Select Shard</option>';
        shards.forEach(shard => {
            const option = document.createElement('option');
            option.value = shard;
            option.textContent = shard;
            shardSelect.appendChild(option);
        });
        shardSelect.disabled = false;
        
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        provinceSelect.disabled = true;
        valleySelect.innerHTML = '<option value="">Select Valley</option>';
        valleySelect.disabled = true;
    });

    // Shard change handler
    shardSelect.addEventListener('change', () => {
        const filtered = cachedRegions.filter(r => 
            r.region_name === regionSelect.value && 
            r.shard === shardSelect.value
        );
        const provinces = [...new Set(filtered.map(r => r.province))];
        
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            provinceSelect.appendChild(option);
        });
        provinceSelect.disabled = false;
        
        valleySelect.innerHTML = '<option value="">Select Valley</option>';
        valleySelect.disabled = true;
    });

    // Province change handler
    provinceSelect.addEventListener('change', () => {
        const filtered = cachedRegions.filter(r => 
            r.region_name === regionSelect.value && 
            r.shard === shardSelect.value &&
            r.province === provinceSelect.value
        );
        
        valleySelect.innerHTML = '<option value="">Select Valley</option>';
        filtered.forEach(item => {
            const option = document.createElement('option');
            option.value = item.home_valley;
            option.textContent = item.home_valley;
            option.dataset.id = item.id;
            valleySelect.appendChild(option);
        });
        valleySelect.disabled = false;
    });
}

/**
 * Load archetypes data from JSON
 */
async function loadArchetypesData() {
    if (archetypesData) return archetypesData;
    
    try {
        const response = await fetch('backend/data/json/archetypes.json');
        archetypesData = await response.json();
        return archetypesData;
    } catch (error) {
        console.error('Failed to load archetypes:', error);
        return [];
    }
}

/**
 * Load character archetype
 */
async function loadArchetype(characterId) {
    try {
        const { data, error } = await supabase
            .from('characters')
            .select('archetype')
            .eq('character_id', characterId)
            .single();

        if (error) throw error;

        const archetypeName = data.archetype || 'Not Set';
       //console.log('[Archetype] Character archetype:', archetypeName);
        
        // Load archetypes data
        const archetypes = await loadArchetypesData();
       //console.log('[Archetype] Loaded archetypes data:', archetypes);
        const archetypeData = archetypes.find(a => a.name === archetypeName);
       //console.log('[Archetype] Found archetype match:', archetypeData);
        
        // Determine icon HTML
        let iconHtml = '<i class="fas fa-user-shield"></i>'; // default
        
        if (archetypeData && archetypeData.icon) {
            const iconClass = archetypeData.icon;
           //console.log('[Archetype] Using icon class:', iconClass);
            // Simply use the icon class as-is
            iconHtml = `<i class="${iconClass}"></i>`;
        } else {
           //console.log('[Archetype] No archetype data found, using default icon');
        }
        
       //console.log('[Archetype] Final icon HTML:', iconHtml);

        archetypeSection.innerHTML = `
            <div class="text-center py-6">
                <div class="inline-block p-4 bg-gray-800 rounded-full mb-3">
                    ${iconHtml}
                </div>
                <p class="text-2xl font-bold text-white">${archetypeName}</p>
            </div>
        `;

    } catch (error) {
        console.error('Error loading archetype:', error);
        archetypeSection.innerHTML = '<p class="text-red-400 text-center py-4">Failed to load archetype</p>';
    }
}

/**
 * Load heroic feats summary
 */
async function loadFeatsSummary(characterId) {
    try {
        // Fetch heroic feats from database
        const { data: allFeats, error: featsError } = await supabase
            .from('heroic_feats')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        if (featsError) throw featsError;

        // Fetch user's quest claims for this character
        const { data: userClaims, error: claimsError } = await supabase
            .from('user_claims')
            .select('quest_id')
            .eq('character_id', characterId);

        if (claimsError) throw claimsError;

        // Fetch all quests to calculate category progress
        const { data: allQuests, error: questsError } = await supabase
            .from('cipher_quests')
            .select('id, category')
            .eq('active', true);

        if (questsError) throw questsError;

        // Calculate category progress
        const categoryProgress = {};
        allQuests.forEach(q => {
            const cat = q.category || 'Uncategorized';
            if (!categoryProgress[cat]) {
                categoryProgress[cat] = { total: 0, completed: 0 };
            }
            categoryProgress[cat].total++;
            if (userClaims.some(c => c.quest_id === q.id)) {
                categoryProgress[cat].completed++;
            }
        });

        // Count how many feats are earned
        let earned = 0;
        allFeats.forEach(feat => {
            const targetCategory = feat.required_category || feat.category;
            const stats = categoryProgress[targetCategory] || { total: 0, completed: 0 };
            const totalToCompare = feat.required_count || stats.total;
            
            if (totalToCompare > 0 && stats.completed >= totalToCompare) {
                earned++;
            }
        });

        const total = allFeats.length;
        const percentage = total > 0 ? (earned / total * 100).toFixed(1) : 0;

        featsSummary.innerHTML = `
            <div class="text-center py-4">
                <div class="text-3xl font-bold text-white mb-1">${earned}<span class="text-gray-500">/${total}</span></div>
                <p class="text-gray-400 text-sm">Completed</p>
                <div class="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div class="bg-gradient-to-r from-yellow-500 to-orange-500 h-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <p class="text-xs text-gray-500 mt-2">${percentage}%</p>
            </div>
        `;

    } catch (error) {
        console.error('Error loading feats:', error);
        featsSummary.innerHTML = '<p class="text-red-400 text-center py-4">Failed to load feats</p>';
    }
}

/**
 * Profile Management - State Manager Implementation
 * 
 * FEATURES:
 * - Character management (create, view, delete)
 * - Market stall management (create, view, delete)
 * - Quest/chronicle summary from chronicles system
 * - Uses MarketStateManager for data caching
 * - Safety validations for character deletion
 * 
 * @version 2.0.0
 */

import { supabase } from './supabaseClient.js';
import { marketState } from './marketStateManager.js';
import { showCustomModal } from './ui/modal.js';




// DOM Elements
const profileLoading = document.getElementById('profileLoading');
const profileContent = document.getElementById('profile-content');
const userAvatar = document.getElementById('user-avatar');
const userDiscordName = document.getElementById('user-discord-name');
const userCreatedAt = document.getElementById('user-created-at');
const userLastLoginAt = document.getElementById('user-last-login-at');
const characterSelect = document.getElementById('characterSelect');
const characterDetails = document.getElementById('characterDetails');
const archetypeSection = document.getElementById('archetypeSection');
const featsSummary = document.getElementById('featsSummary');
const questSummary = document.getElementById('questSummary');
const stallsContainer = document.getElementById('stallsContainer');

// Buttons
const createCharacterBtn = document.getElementById('createCharacterBtn');
const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
const createStallBtn = document.getElementById('createStallBtn');

// Modals
const createCharacterModal = document.getElementById('createCharacterModal');
const closeCreateCharacterModal = document.getElementById('closeCreateCharacterModal');
const cancelCreateCharacter = document.getElementById('cancelCreateCharacter');
const createCharacterForm = document.getElementById('createCharacterForm');

const createStallModal = document.getElementById('createStallModal');
const closeCreateStallModal = document.getElementById('closeCreateStallModal');
const cancelCreateStall = document.getElementById('cancelCreateStall');
const createStallForm = document.getElementById('createStallForm');

// State
let currentUserId = null;
let currentCharacterId = null;
let archetypesData = null;
let cachedRegions = null;

/**
 * Initialize profile page
 */
async function init() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    try {
        // Show loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        profileLoading.style.display = 'none';
        profileContent.style.display = 'none';

        // Check authentication
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            profileLoading.textContent = 'Please log in to view your profile.';
            profileLoading.style.display = 'block';
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            return;
        }

        currentUserId = user.id;

        // Initialize state manager
        await marketState.initialize();

        // Load profile data
        await loadUserProfile(user);
        await loadCharacters();

        profileLoading.style.display = 'none';
        profileContent.style.display = 'block';

    } catch (error) {
        console.error('Error initializing profile:', error);
        profileLoading.textContent = 'Failed to load profile. Please refresh the page.';
        profileLoading.style.display = 'block';
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

/**
 * Load user profile information
 */
async function loadUserProfile(user) {
    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Update UI
        userAvatar.src = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
        userDiscordName.textContent = user.user_metadata.full_name || 'N/A';
        userCreatedAt.textContent = new Date(userData.created_at).toLocaleDateString();
        userLastLoginAt.textContent = userData.last_login_at 
            ? new Date(userData.last_login_at).toLocaleDateString() 
            : 'N/A';

    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

/**
 * Load characters from state manager
 */
async function loadCharacters(skipAutoLoad = false) {
    try {
        const characters = marketState.getCharacters();

        characterSelect.innerHTML = '<option value="">Select a character...</option>';

        if (!characters || characters.length === 0) {
            characterSelect.innerHTML = '<option value="">No characters found</option>';
            return;
        }

        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.character_id;
            option.textContent = char.character_name;
            characterSelect.appendChild(option);
        });

        // Auto-select active character if exists (unless we're skipping)
        if (!skipAutoLoad) {
            const activeCharId = marketState.getActiveCharacterId();
            //console.log('[Profile] Active character from state manager:', activeCharId);
            //console.log('[Profile] Session storage value:', sessionStorage.getItem('active_character_id'));
            //console.log('[Profile] Available characters:', characters.map(c => ({ id: c.character_id, name: c.character_name })));
            
            if (activeCharId) {
                //console.log('[Profile] Setting dropdown to:', activeCharId);
                characterSelect.value = activeCharId;
                //console.log('[Profile] Dropdown value after setting:', characterSelect.value);
                await loadCharacterData(activeCharId);
            } else {
                //console.log('[Profile] No active character found in state manager');
            }
        }

    } catch (error) {
        console.error('Error loading characters:', error);
        characterSelect.innerHTML = '<option value="">Error loading characters</option>';
    }
}

/**
 * Load character details, stalls, and quest summary
 */
async function loadCharacterData(characterId) {
    if (!characterId) {
        characterDetails.innerHTML = '<p class="text-gray-400 text-center py-8">Select a character to view details</p>';
        archetypeSection.innerHTML = '<p class="text-gray-400 text-center py-8">Select a character</p>';
        featsSummary.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Select a character</p>';
        questSummary.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Select a character</p>';
        stallsContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Select a character to view stalls</p>';
        deleteCharacterBtn.style.display = 'none';
        createStallBtn.style.display = 'none';
        currentCharacterId = null;
        return;
    }

    currentCharacterId = characterId;
    deleteCharacterBtn.style.display = 'inline-block';
    createStallBtn.style.display = 'inline-block';

    // Set as active character in state manager
    marketState.setActiveCharacter(characterId);

    // Load all sections
    await loadCharacterDetails(characterId);
    await loadArchetype(characterId);
    await loadFeatsSummary(characterId);
    await loadQuestSummary(characterId);
    await loadMarketStalls(characterId);
}

/**
 * Load detailed character information
 */
async function loadCharacterDetails(characterId) {
    //console.log('[Profile] loadCharacterDetails called with characterId:', characterId);
    
    try {
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('character_id', characterId)
            .single();

        if (error) throw error;

        ////console.log('[Profile] Character data loaded:', {
        //     id: data.character_id,
        //     name: data.character_name,
        //     gold: data.gold
        // });

        characterDetails.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-3">
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-user text-yellow-500"></i>
                        <span class="text-gray-400">Name:</span>
                        <span class="font-semibold text-white">${data.character_name}</span>
                    </div>
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-coins text-yellow-500"></i>
                        <span class="text-gray-400">Gold:</span>
                        <span class="font-semibold text-white">${(data.gold || 0).toLocaleString()}</span>
                    </div>
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-globe text-yellow-500"></i>
                        <span class="text-gray-400">Region:</span>
                        <span class="font-semibold text-white">${data.region || 'Unknown'}</span>
                    </div>
                </div>
                <div class="space-y-3">
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-server text-yellow-500"></i>
                        <span class="text-gray-400">Shard:</span>
                        <span class="font-semibold text-white">${data.shard || 'Unknown'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-map-marker-alt text-yellow-500"></i>
                        <span class="text-gray-400">Province:</span>
                        <span class="font-semibold text-white">${data.province || 'Unknown'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-base">
                        <i class="fas fa-mountain text-yellow-500"></i>
                        <span class="text-gray-400">Home Valley:</span>
                        <span class="font-semibold text-white">${data.home_valley || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading character details:', error);
        characterDetails.innerHTML = '<p class="text-red-400 text-center py-4">Failed to load character details</p>';
    }
}

/**
 * Load market stalls for character
 */
async function loadMarketStalls(characterId) {
    try {
        const { data: stalls, error } = await supabase
            .from('market_stalls')
            .select('id, stall_name, region, province, created_at')
            .eq('character_id', characterId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!stalls || stalls.length === 0) {
            stallsContainer.innerHTML = '<p class="text-gray-400 text-center py-8 col-span-full">No stalls found. Create one to get started!</p>';
            return;
        }

        // Get listing counts for each stall
        const { data: listingCounts, error: countsError } = await supabase
            .rpc('get_market_stall_listing_counts_for_character', {
                p_character_id: characterId
            });

        if (countsError) {
            console.warn('Error fetching listing counts:', countsError);
        }

        // Create a map of stall ID to listing count
        const listingCountsMap = new Map();
        if (listingCounts) {
            listingCounts.forEach(item => {
                listingCountsMap.set(item.market_stall_id, item.count);
            });
        }

        stallsContainer.innerHTML = stalls.map(stall => {
            const listingCount = listingCountsMap.get(stall.id) || 0;
            return `
            <div class="stall-card rounded-lg p-4">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <h4 class="font-bold text-white text-lg mb-1">${stall.stall_name}</h4>
                        <p class="text-base text-gray-400">
                            <i class="fas fa-map-marker-alt mr-1"></i>${stall.region}${stall.province ? `, ${stall.province}` : ''}
                        </p>
                    </div>
                    <button class="delete-stall-btn text-red-400 hover:text-red-300 p-2" data-stall-id="${stall.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="border-t border-gray-600 pt-3 mt-3">
                    <div class="flex items-center justify-between text-base">
                        <span class="text-gray-400">
                            <i class="fas fa-list mr-1"></i>Active Listings:
                        </span>
                        <span class="font-semibold text-white">${listingCount}</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Add delete listeners
        document.querySelectorAll('.delete-stall-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteStall(btn.dataset.stallId));
        });

    } catch (error) {
        console.error('Error loading market stalls:', error);
        stallsContainer.innerHTML = '<p class="text-red-400 text-center py-8 col-span-full">Failed to load stalls</p>';
    }
}

/**
 * Load quest summary - simple overview only
 */
async function loadQuestSummary(characterId) {
    try {
        // Fetch user claims count
        const { count: completedCount, error: claimsError } = await supabase
            .from('user_claims')
            .select('*', { count: 'exact', head: true })
            .eq('character_id', characterId);

        if (claimsError) {
            console.warn('Chronicles error:', claimsError);
            throw claimsError;
        }

        // Fetch total quest count
        const { count: totalQuests, error: questsError } = await supabase
            .from('cipher_quests')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);

        if (questsError) {
            console.warn('Quest count error:', questsError);
        }

        const total = totalQuests || 0;
        const completed = completedCount || 0;
        const percentage = total > 0 ? (completed / total * 100).toFixed(1) : 0;

        questSummary.innerHTML = `
            <div class="text-center py-4">
                <div class="text-3xl font-bold text-white mb-1">${completed}<span class="text-gray-500">/${total}</span></div>
                <p class="text-gray-400 text-sm">Completed</p>
                <div class="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <p class="text-xs text-gray-500 mt-2">${percentage}%</p>
            </div>
        `;

    } catch (error) {
        // Gracefully handle - show "coming soon" message
        questSummary.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-scroll text-3xl text-gray-600 mb-2"></i>
                <p class="text-gray-400 text-sm mb-2">Coming Soon</p>
            </div>
        `;
    }
}

/**
 * Handle character creation
 */
async function handleCreateCharacter(e) {
    console.log('[Character Creation] handleCreateCharacter called');
    e.preventDefault();
    
    const nameInput = document.getElementById('newCharacterName');
    const goldInput = document.getElementById('newCharacterGold');
    const regionSelect = document.getElementById('newCharacterRegionNameSelect');
    const shardSelect = document.getElementById('newCharacterShardSelect');
    const provinceSelect = document.getElementById('newCharacterProvinceSelect');
    const valleySelect = document.getElementById('newCharacterHomeValleySelect');

    console.log('[Character Creation] nameInput element:', nameInput);
    console.log('[Character Creation] nameInput.value:', nameInput ? nameInput.value : 'INPUT NOT FOUND');

    const characterName = nameInput ? nameInput.value.trim() : '';
    const gold = parseInt(goldInput.value, 10) || 0;
    const regionName = regionSelect.value;
    const shard = shardSelect.value;
    const province = provinceSelect.value;
    const homeValley = valleySelect.value;

    console.log('[Character Creation] Form values:', {
        characterName,
        gold,
        regionName,
        shard,
        province,
        homeValley
    });

    if (!characterName) {
        console.log('[Character Creation] VALIDATION FAILED: Character name is empty');
        await showCustomModal('Validation Error', 'Character name cannot be empty.', [{ text: 'OK', value: true }]);
        return;
    }

    console.log('[Character Creation] Validation passed, proceeding with character creation...');

    if (!regionName || !shard || !province || !homeValley) {
        console.log('[Character Creation] VALIDATION FAILED: Missing region data');
        await showCustomModal('Validation Error', 'Please fill in all required fields.', [{ text: 'OK', value: true }]);
        return;
    }

    // Get region_entry_id from selected valley option
    const selectedOption = valleySelect.options[valleySelect.selectedIndex];
    
    console.log('[Character Creation] valleySelect:', valleySelect);
    console.log('[Character Creation] selectedIndex:', valleySelect.selectedIndex);
    console.log('[Character Creation] selectedOption:', selectedOption);
    console.log('[Character Creation] selectedOption.dataset:', selectedOption ? selectedOption.dataset : 'NO OPTION');
    console.log('[Character Creation] selectedOption.value:', selectedOption ? selectedOption.value : 'NO OPTION');
    
    const regionEntryId = selectedOption ? selectedOption.dataset.id : null;
    
    console.log('[Character Creation] Region Entry ID:', regionEntryId);

    if (!regionEntryId) {
        console.log('[Character Creation] VALIDATION FAILED: No region entry ID');
        await showCustomModal('Error', 'Failed to get region ID. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    console.log('[Character Creation] Starting database insert...');
    
    try {
        const insertData = {
            user_id: currentUserId,
            character_name: characterName,
            gold: gold,
            region: regionName,
            shard: shard,
            province: province,
            home_valley: homeValley,
            region_entry_id: regionEntryId
        };
        
        console.log('[Character Creation] Insert data:', insertData);
        
        const { data, error } = await supabase
            .from('characters')
            .insert([insertData])
            .select()
            .single();

        console.log('[Character Creation] Database response:', { data, error });

        if (error) throw error;

        console.log('[Character Creation] Character created successfully:', data);

        // Force a full re-initialization to load the new character
        marketState.isInitialized = false; // Reset the flag so initialize() runs fully
        marketState.invalidate(['characterData']);
        await marketState.initialize();
        
        // Now the new character should be in the cache, set it as active
        marketState.setActiveCharacter(data.character_id);
        
        // Reload the character dropdown (it will auto-select the new active character)
        await loadCharacters();
        
        // The character is already loaded by loadCharacters, so we're done
        await showCustomModal('Success', `Character "${characterName}" created successfully!`, [{ text: 'OK', value: true }]);
        
        closeModal(createCharacterModal);
        createCharacterForm.reset();

    } catch (error) {
        console.error('[Character Creation] Error during creation:', error);
        console.error('Error creating character:', error);
        await showCustomModal('Error', `Failed to create character: ${error.message}`, [{ text: 'OK', value: true }]);
    }
}

/**
 * Handle character deletion with safety checks
 */
async function handleDeleteCharacter() {
    if (!currentCharacterId) return;

    try {
        // Check for active stalls
        const { data: stalls, error: stallsError } = await supabase
            .from('market_stalls')
            .select('id, stall_name')
            .eq('character_id', currentCharacterId);

        if (stallsError) throw stallsError;

        if (stalls && stalls.length > 0) {
            await showCustomModal(
                'Cannot Delete Character',
                'This character has stalls. Please delete all stalls first from the stalls section below.',
                [{ text: 'OK', value: true }]
            );
            return;
        }

        // Confirm deletion
        const confirmed = await showCustomModal(
            'Confirm Deletion',
            `Are you sure you want to delete this character? This action cannot be undone.`,
            [
                { text: 'Cancel', value: false },
                { text: 'Delete', value: true }
            ]
        );

        if (!confirmed) return;

        // Delete character
        const { error: deleteError } = await supabase
            .from('characters')
            .delete()
            .eq('character_id', currentCharacterId);

        if (deleteError) throw deleteError;

        // Store the ID before clearing it
        const deletedCharacterId = currentCharacterId;
        
        // Clear the active character from state manager and sessionStorage
        currentCharacterId = null;
        sessionStorage.removeItem('active_character_id');
        
        // Clear the character from the cache immediately
        marketState.cache.characters = marketState.cache.characters.filter(
            c => c.character_id !== deletedCharacterId
        );
        
        // Force a full re-initialization to reload the character list from DB
        marketState.isInitialized = false;
        await marketState.initialize();
        
        // Reload character list WITHOUT auto-loading (skip auto-select)
        await loadCharacters(true);
        
        // Clear the dropdown selection and character display
        characterSelect.value = '';
        await loadCharacterData(null);

        await showCustomModal('Success', 'Character deleted successfully.', [{ text: 'OK', value: true }]);

    } catch (error) {
        console.error('Error deleting character:', error);
        await showCustomModal('Error', `Failed to delete character: ${error.message}`, [{ text: 'OK', value: true }]);
    }
}

/**
 * Handle stall creation
 */
// async function handleCreateStall(formData) {
//     if (!currentCharacterId) {
//         await showCustomModal('Error', 'Please select a character first.', [{ text: 'OK', value: true }]);
//         return;
//     }

//     try {
//         const { error } = await supabase
//             .from('market_stalls')
//             .insert([{
//                 character_id: currentCharacterId,
//                 stall_name: formData.name,
//                 region: formData.region,
//                 province: formData.province || null
//             }]);

//         if (error) throw error;

//         await loadMarketStalls(currentCharacterId);
        
//         await showCustomModal('Success', `Stall "${formData.name}" created successfully!`, [{ text: 'OK', value: true }]);
        
//         closeModal(createStallModal);
//         createStallForm.reset();

//     } catch (error) {
//         console.error('Error creating stall:', error);
//         await showCustomModal('Error', `Failed to create stall: ${error.message}`, [{ text: 'OK', value: true }]);
//     }
// }

/**
 * Handle stall deletion with safety checks
 */
async function handleDeleteStall(stallId) {
    try {
        // Check for active listings
        const { data: listings, error: listingsError } = await supabase
            .from('market_listings')
            .select('listing_id')
            .eq('market_stall_id', stallId)
            .limit(1);

        if (listingsError) throw listingsError;

        if (listings && listings.length > 0) {
            await showCustomModal(
                'Cannot Delete Stall',
                'This stall has active listings. Please remove all listings before deleting the stall.',
                [{ text: 'OK', value: true }]
            );
            return;
        }

        // Confirm deletion
        const confirmed = await showCustomModal(
            'Confirm Deletion',
            'Are you sure you want to delete this stall?',
            [
                { text: 'Cancel', value: false },
                { text: 'Delete', value: true }
            ]
        );

        if (!confirmed) return;

        // Delete stall
        const { error: deleteError } = await supabase
            .from('market_stalls')
            .delete()
            .eq('id', stallId);

        if (deleteError) throw deleteError;

        await loadMarketStalls(currentCharacterId);
        
        await showCustomModal('Success', 'Stall deleted successfully.', [{ text: 'OK', value: true }]);

    } catch (error) {
        console.error('Error deleting stall:', error);
        await showCustomModal('Error', `Failed to delete stall: ${error.message}`, [{ text: 'OK', value: true }]);
    }
}

/**
 * Populate stall dropdowns based on character's region
 */
async function populateStallDropdowns() {
    if (!currentCharacterId) return;

    try {
        // Get current character data
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('region, shard')
            .eq('character_id', currentCharacterId)
            .single();

        if (charError) throw charError;

        if (!cachedRegions) {
            const { data, error } = await supabase
                .from('regions')
                .select('id, region_name, shard, province, home_valley')
                .order('region_name', { ascending: true })
                .order('shard', { ascending: true })
                .order('province', { ascending: true })
                .order('home_valley', { ascending: true });

            if (error) throw error;
            cachedRegions = data;
        }

        const provinceSelect = document.getElementById('newStallProvinceSelect');
        const valleySelect = document.getElementById('newStallHomeValleySelect');

        if (!provinceSelect || !valleySelect) return;

        // Filter regions by character's region and shard
        const filtered = cachedRegions.filter(r => 
            r.region_name === charData.region &&
            r.shard === charData.shard
        );

        // Get distinct provinces
        const provinces = [...new Set(filtered.map(r => r.province))];
        
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            provinceSelect.appendChild(option);
        });

        // Province change handler
        provinceSelect.addEventListener('change', () => {
            const provinceName = provinceSelect.value;
            const valleyFiltered = filtered.filter(r => r.province === provinceName);
            
            valleySelect.innerHTML = '<option value="">Select Valley</option>';
            valleyFiltered.forEach(item => {
                const option = document.createElement('option');
                option.value = item.home_valley;
                option.textContent = item.home_valley;
                option.dataset.id = item.id;
                valleySelect.appendChild(option);
            });
        });

    } catch (error) {
        console.error('Error populating stall dropdowns:', error);
        await showCustomModal('Error', 'Failed to load region data.', [{ text: 'OK', value: true }]);
    }
}

/**
 * Handle stall creation
 */
async function handleCreateStall(e) {
    e.preventDefault();
    
    if (!currentCharacterId) {
        await showCustomModal('Error', 'Please select a character first.', [{ text: 'OK', value: true }]);
        return;
    }

    const nameInput = document.getElementById('newStallName');
    const provinceSelect = document.getElementById('newStallProvinceSelect');
    const valleySelect = document.getElementById('newStallHomeValleySelect');

    const stallName = nameInput.value.trim();
    const province = provinceSelect.value;
    const homeValley = valleySelect.value;

    if (!stallName || !province || !homeValley) {
        await showCustomModal('Validation Error', 'Please fill in all fields.', [{ text: 'OK', value: true }]);
        return;
    }

    // Get region_entry_id from selected valley option
    const selectedOption = valleySelect.options[valleySelect.selectedIndex];
    const regionEntryId = selectedOption.dataset.id;

    if (!regionEntryId) {
        await showCustomModal('Error', 'Failed to get region ID. Please try again.', [{ text: 'OK', value: true }]);
        return;
    }

    try {
        // Get character data - we don't need to insert shard into market_stalls
        // because shard is stored in the characters table and accessed via the relationship
        const { data: charData, error: charError } = await supabase
            .from('characters')
            .select('region')
            .eq('character_id', currentCharacterId)
            .single();

        if (charError) throw charError;

        const { error } = await supabase
            .from('market_stalls')
            .insert([{
                character_id: currentCharacterId,
                stall_name: stallName,
                region: charData.region,
                province: province,
                home_valley: homeValley,
                region_entry_id: regionEntryId
            }]);

        if (error) throw error;

        await loadMarketStalls(currentCharacterId);
        
        await showCustomModal('Success', `Stall "${stallName}" created successfully!`, [{ text: 'OK', value: true }]);
        
        closeModal(createStallModal);
        createStallForm.reset();

    } catch (error) {
        console.error('Error creating stall:', error);
        await showCustomModal('Error', `Failed to create stall: ${error.message}`, [{ text: 'OK', value: true }]);
    }
}


/**
 * Helper: Close modal
 */
function closeModal(modal) {
    modal.classList.add('hidden');
}

/**
 * Helper: Open modal
 */
function openModal(modal) {
    modal.classList.remove('hidden');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Character selection
    characterSelect.addEventListener('change', (e) => {
        const characterId = e.target.value || null;
        loadCharacterData(characterId);
    });

    // Create character - populate regions on open
    createCharacterBtn.addEventListener('click', async () => {
        openModal(createCharacterModal);
        await populateCharacterRegionDropdowns();
    });
    closeCreateCharacterModal.addEventListener('click', () => closeModal(createCharacterModal));
    cancelCreateCharacter.addEventListener('click', () => closeModal(createCharacterModal));
    
    createCharacterForm.addEventListener('submit', handleCreateCharacter);

    // Delete character - FIX: Use arrow function to avoid passing event object
    deleteCharacterBtn.addEventListener('click', () => handleDeleteCharacter());

    // Create stall - populate dropdowns on open
    createStallBtn.addEventListener('click', async () => {
        openModal(createStallModal);
        await populateStallDropdowns();
    });
    closeCreateStallModal.addEventListener('click', () => closeModal(createStallModal));
    cancelCreateStall.addEventListener('click', () => closeModal(createStallModal));
    
    createStallForm.addEventListener('submit', handleCreateStall);

    // Auth status changes
    document.addEventListener('authStatusChanged', () => {
        init();
    });
});