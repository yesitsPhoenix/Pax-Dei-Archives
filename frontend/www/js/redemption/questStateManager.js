import { supabase } from '../supabaseClient.js';

class QuestStateManager {
    constructor() {
        // Cache 
        this.cache = {
            user: null,
            activeCharacterId: null,
            activeCharacter: null,
            characters: [],
            allQuests: [],
            regions: [],
            userClaims: [],
            categories: [],
            secretUnlockConfigs: [],
            unlockedCategories: [],
            heroicFeats: [],
            lastFetch: {}
        };

        this.subscribers = new Set();
        
        this.isInitialized = false;
        this.pendingInit = null;
        
        // Debug mode - set to false to disable all logging
        this.debug = false;
        
        this.pendingRequests = new Map();
    }

    async initialize() {
        if (this.isInitialized) {
            this.log('Already initialized, skipping');
            return;
        }

        if (this.pendingInit) {
            this.log('Initialization in progress, awaiting...');
            return await this.pendingInit;
        }

        this.log('Starting initialization...');
        
        this.pendingInit = this._performInitialization();
        
        try {
            await this.pendingInit;
            this.isInitialized = true;
            this.log('Initialization complete');
            this.notify('initialized', this.cache);
        } catch (error) {
            console.error('[QuestState] Initialization failed:', error);
            throw error;
        } finally {
            this.pendingInit = null;
        }
    }


    async _performInitialization() {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        // Missing auth session is expected for non-logged-in users, not an error
        // Only throw on actual unexpected errors (network issues, etc.)
        if (userError) {
            // Don't throw for missing auth session or 401 errors - these are expected
            if (userError.message?.includes('Auth session missing') || userError.status === 401) {
                // This is expected - user is not logged in
                this.log('No authenticated user - this is expected for initial page load');
            } else {
                // This is an unexpected error
                throw new Error(`Failed to fetch user: ${userError.message}`);
            }
        }

        this.cache.user = user;
        this.cache.lastFetch.user = Date.now();

        const [questsRes, regionsRes, categoriesRes, featsRes] = await Promise.all([
            supabase
                .from('cipher_quests')
                .select('*, regions:region_id (*)')
                .eq('active', true)
                .order('sort_order', { ascending: true }),
            
            supabase
                .from('regions')
                .select('*'),
            
            supabase
                .from('quest_categories')
                .select('name, is_secret'),
            
            supabase
                .from('heroic_feats')
                .select('*')
                .eq('active', true)
                .order('sort_order', { ascending: true })
        ]);

        this.cache.allQuests = questsRes.data || [];
        this.cache.regions = regionsRes.data || [];
        this.cache.categories = categoriesRes.data || [];
        this.cache.heroicFeats = featsRes.data || [];
        this.cache.lastFetch.staticData = Date.now();

        this.log(`Loaded ${this.cache.allQuests.length} quests, ${this.cache.categories.length} categories`);

        if (this.cache.user) {
            await this._initializeCharacterData();
        } else {
            this.log('No user logged in, skipping character data');
        }
    }


    async _initializeCharacterData() {
        const userId = this.cache.user.id;

        const { data: characters } = await supabase
            .from('characters')
            .select('character_id, character_name, archetype, is_default_character')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        this.cache.characters = characters || [];

        const sessionCharId = sessionStorage.getItem('active_character_id');
        
        if (sessionCharId && this.cache.characters.some(c => c.character_id === sessionCharId)) {
            this.cache.activeCharacterId = sessionCharId;
            this.log(`Using session character: ${sessionCharId}`);
        } else {
            const defaultChar = this.cache.characters.find(c => c.is_default_character);
            const firstChar = this.cache.characters[0];
            
            if (defaultChar) {
                this.cache.activeCharacterId = defaultChar.character_id;
                this.log(`Using default character: ${defaultChar.character_id}`);
            } else if (firstChar) {
                this.cache.activeCharacterId = firstChar.character_id;
                this.log(`Using first character: ${firstChar.character_id}`);
            } else {
                this.log('No characters found for user');
                return;
            }
            if (this.cache.activeCharacterId) {
                sessionStorage.setItem('active_character_id', this.cache.activeCharacterId);
            }
        }

        if (this.cache.activeCharacterId) {
            await this._loadCharacterData(this.cache.activeCharacterId);
        }
    }


    async _loadCharacterData(characterId) {
        this.log(`Loading data for character: ${characterId}`);

        const [charRes, claimsRes, unlocksRes, secretConfigsRes] = await Promise.all([
            supabase
                .from('characters')
                .select('*')
                .eq('character_id', characterId)
                .single(),
            
            supabase
                .from('user_claims')
                .select('*')
                .eq('character_id', characterId),
            
            supabase
                .from('user_unlocked_categories')
                .select('category_name')
                .eq('character_id', characterId),
            
            supabase
                .from('secret_unlock_configs')
                .select('*')
        ]);

        this.cache.activeCharacter = charRes.data || null;
        this.cache.userClaims = claimsRes.data || [];
        this.cache.secretUnlockConfigs = secretConfigsRes.data || [];
        
        const dbUnlocks = unlocksRes.data || [];
        this.cache.unlockedCategories = this._computeUnlockedCategories(dbUnlocks);
        
        this.cache.lastFetch.characterData = Date.now();

        this.log(`Loaded ${this.cache.userClaims.length} claims, ${this.cache.unlockedCategories.length} unlocked categories`);
    }


    _computeUnlockedCategories(dbUnlocks) {
        const unlocked = new Set([
            'Uncategorized',
            'The First Steps: Beginner\'s Guide'
        ]);

        dbUnlocks.forEach(u => unlocked.add(u.category_name));

        const categoryProgress = {};
        const claimedCategories = new Set();

        this.cache.userClaims.forEach(claim => {
            const quest = this.cache.allQuests.find(q => q.id === claim.quest_id);
            if (quest && quest.category) {
                categoryProgress[quest.category] = (categoryProgress[quest.category] || 0) + 1;
                claimedCategories.add(quest.category);
            }
        });

        this.cache.allQuests.forEach(quest => {
            const cat = quest.category || 'Uncategorized';
            
            if (unlocked.has(cat)) return;

            const reqCat = quest.unlock_prerequisite_category;
            const reqCount = quest.unlock_required_count || 0;

            if (!reqCat || reqCat === '') {
                unlocked.add(cat);
            } else if (categoryProgress[reqCat] >= reqCount) {
                unlocked.add(cat);
            }
        });

        claimedCategories.forEach(cat => unlocked.add(cat));

        return Array.from(unlocked);
    }

    async refreshCharacterData() {
        if (!this.cache.activeCharacterId) {
            this.log('No active character to refresh');
            return;
        }

        this.log('Refreshing character data...');
        await this._loadCharacterData(this.cache.activeCharacterId);
        this.notify('characterDataRefreshed', {
            characterId: this.cache.activeCharacterId,
            claims: this.cache.userClaims,
            unlockedCategories: this.cache.unlockedCategories
        });
    }

    async setActiveCharacter(characterId) {
        if (this.cache.activeCharacterId === characterId) {
            this.log(`Character ${characterId} already active`);
            return;
        }

        this.log(`Switching to character: ${characterId}`);

        this.cache.activeCharacterId = characterId;
        sessionStorage.setItem('active_character_id', characterId);

        await this._loadCharacterData(characterId);

        this.notify('characterChanged', {
            characterId,
            character: this.cache.activeCharacter,
            claims: this.cache.userClaims
        });
    }

    async addClaim(questId, userId = null, characterId = null) {
        const charId = characterId || this.cache.activeCharacterId;
        const uId = userId || this.cache.user?.id;

        if (!charId || !uId) {
            throw new Error('Cannot add claim without user and character');
        }

        this.log(`Adding claim for quest ${questId}`);

        const { error } = await supabase
            .from('user_claims')
            .insert({
                user_id: uId,
                quest_id: questId,
                character_id: charId,
                claimed_at: new Date().toISOString()
            });

        if (error) throw error;

        await this.refreshCharacterData();

        this.notify('questClaimed', {
            questId,
            characterId: charId
        });
    }

    async unlockSecretCategory(categoryName, userId = null, characterId = null) {
        const charId = characterId || this.cache.activeCharacterId;
        const uId = userId || this.cache.user?.id;

        if (!charId || !uId) {
            throw new Error('Cannot unlock category without user and character');
        }

        this.log(`Unlocking secret category: ${categoryName}`);

        const { error } = await supabase
            .from('user_unlocked_categories')
            .upsert({
                user_id: uId,
                character_id: charId,
                category_name: categoryName,
                unlocked_at: new Date().toISOString()
            }, {
                onConflict: 'character_id,category_name'
            });

        if (error) throw error;

        await this.refreshCharacterData();

        this.notify('secretCategoryUnlocked', {
            categoryName,
            characterId: charId
        });
    }

    async addCharacter(characterName) {
        if (!this.cache.user) {
            throw new Error('User must be logged in to create character');
        }

        this.log(`Creating character: ${characterName}`);

        const { data, error } = await supabase
            .from('characters')
            .insert({
                user_id: this.cache.user.id,
                character_name: characterName,
                is_default_character: this.cache.characters.length === 0
            })
            .select()
            .single();

        if (error) throw error;

        this.cache.characters.push(data);

        if (this.cache.characters.length === 1) {
            await this.setActiveCharacter(data.character_id);
        }

        this.notify('characterCreated', {
            character: data
        });

        return data;
    }

    async setCharacterArchetype(archetype, characterId = null) {
        const charId = characterId || this.cache.activeCharacterId;

        if (!charId) {
            throw new Error('No character selected');
        }

        this.log(`Setting archetype ${archetype} for character ${charId}`);

        const { error } = await supabase
            .from('characters')
            .update({ archetype })
            .eq('character_id', charId);

        if (error) throw error;

        if (this.cache.activeCharacter && this.cache.activeCharacter.character_id === charId) {
            this.cache.activeCharacter.archetype = archetype;
        }

        const charIndex = this.cache.characters.findIndex(c => c.character_id === charId);
        if (charIndex !== -1) {
            this.cache.characters[charIndex].archetype = archetype;
        }

        this.notify('archetypeSet', {
            characterId: charId,
            archetype
        });
    }

    async invalidate(keys) {
        this.log('Invalidating cache keys:', keys);

        const promises = [];

        if (keys.includes('characterData') || keys.includes('userClaims') || keys.includes('unlockedCategories')) {
            promises.push(this.refreshCharacterData());
        }

        if (keys.includes('quests')) {
            promises.push(this._refreshQuests());
        }

        if (keys.includes('characters')) {
            promises.push(this._refreshCharacters());
        }

        await Promise.all(promises);
        this.notify('invalidated', keys);
    }

    async _refreshQuests() {
        const { data } = await supabase
            .from('cipher_quests')
            .select('*, regions:region_id (*)')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        this.cache.allQuests = data || [];
        this.cache.lastFetch.quests = Date.now();
    }

    async _refreshCharacters() {
        if (!this.cache.user) return;

        const { data } = await supabase
            .from('characters')
            .select('character_id, character_name, archetype, is_default_character')
            .eq('user_id', this.cache.user.id)
            .order('created_at', { ascending: true });

        this.cache.characters = data || [];
        this.cache.lastFetch.characters = Date.now();
    }


    getUser() {
        return this.cache.user;
    }

    getActiveCharacterId() {
        return this.cache.activeCharacterId;
    }

    getActiveCharacter() {
        return this.cache.activeCharacter;
    }

    getCharacters() {
        return this.cache.characters;
    }

    getAllQuests() {
        return this.cache.allQuests;
    }

    getRegions() {
        return this.cache.regions;
    }

    getUserClaims() {
        return this.cache.userClaims;
    }

    getCategories() {
        return this.cache.categories;
    }

    getUnlockedCategories() {
        return this.cache.unlockedCategories;
    }

    getHeroicFeats() {
        return this.cache.heroicFeats;
    }

    getSecretUnlockConfigs() {
        return this.cache.secretUnlockConfigs;
    }

    getQuestById(questId) {
        return this.cache.allQuests.find(q => q.id === questId);
    }

    getQuestByKey(questKey) {
        return this.cache.allQuests.find(q => q.quest_key === questKey);
    }

    isQuestClaimed(questId) {
        return this.cache.userClaims.some(c => c.quest_id === questId);
    }

    isCategoryUnlocked(categoryName) {
        return this.cache.unlockedCategories.includes(categoryName);
    }

    getCategoryProgress(categoryName) {
        const count = this.cache.userClaims.filter(claim => {
            const quest = this.getQuestById(claim.quest_id);
            return quest?.category === categoryName;
        }).length;

        const total = this.cache.allQuests.filter(q => q.category === categoryName).length;

        return { count, total, percentage: total > 0 ? (count / total) * 100 : 0 };
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notify(event, data) {
        this.log(`Event: ${event}`, data);
        this.subscribers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('[QuestState] Subscriber error:', error);
            }
        });
    }


    log(message, data) {
        if (this.debug) {
            if (data) {
                console.log(`[QuestState] ${message}`, data);
            } else {
                console.log(`[QuestState] ${message}`);
            }
        }
    }

    isReady() {
        return this.isInitialized;
    }

    getCacheStats() {
        return {
            isInitialized: this.isInitialized,
            user: !!this.cache.user,
            activeCharacter: !!this.cache.activeCharacter,
            questCount: this.cache.allQuests.length,
            claimCount: this.cache.userClaims.length,
            characterCount: this.cache.characters.length,
            unlockedCategoryCount: this.cache.unlockedCategories.length,
            lastFetch: this.cache.lastFetch
        };
    }

    reset() {
        this.log('Resetting state manager');
        
        this.cache = {
            user: null,
            activeCharacterId: null,
            activeCharacter: null,
            characters: [],
            allQuests: [],
            regions: [],
            userClaims: [],
            categories: [],
            secretUnlockConfigs: [],
            unlockedCategories: [],
            heroicFeats: [],
            lastFetch: {}
        };

        this.isInitialized = false;
        this.pendingInit = null;
        
        sessionStorage.removeItem('active_character_id');
        
        this.notify('reset');
    }
}

export const questState = new QuestStateManager();

if (typeof window !== 'undefined') {
    window.questState = questState;
}