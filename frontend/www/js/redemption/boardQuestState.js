import { questState } from './questStateManager.js';
import {
    buildBoardQuestFilters,
    parseBoardQuestShareLink,
} from './boardQuestFilters.js';
import {
    getAcceptedBoardQuestsForActiveCharacter,
    getBoardQuestById,
    getCompletedBoardContractsForCharacter,
    listBoardQuests,
} from './boardQuestService.js';

class BoardQuestState {
    constructor() {
        this.cache = {
            filters: buildBoardQuestFilters(),
            boardPosts: [],
            activePost: null,
            activePostId: null,
            acceptedContracts: [],
            completedContracts: [],
            lastFetch: {},
        };
        this.subscribers = new Set();
        this.initialized = false;
        this.pendingInit = null;

        if (typeof window !== 'undefined') {
            window.addEventListener('characterChanged', () => {
                this.refreshAll().catch((error) => {
                    console.error('[BoardQuestState] Character refresh failed:', error);
                });
            });
        }
    }

    async initialize() {
        if (this.initialized) return;
        if (this.pendingInit) return this.pendingInit;

        this.pendingInit = (async () => {
            await questState.initialize();
            this.cache.filters = buildBoardQuestFilters(this.cache.filters, questState.getActiveCharacter());
            this.initialized = true;
            this.notify('initialized', this.getSnapshot());
        })();

        try {
            await this.pendingInit;
        } finally {
            this.pendingInit = null;
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notify(event, payload) {
        this.subscribers.forEach((callback) => {
            try {
                callback(event, payload);
            } catch (error) {
                console.error('[BoardQuestState] Subscriber error:', error);
            }
        });
    }

    getSnapshot() {
        return {
            ...this.cache,
            filters: { ...this.cache.filters },
            boardPosts: [...this.cache.boardPosts],
            acceptedContracts: [...this.cache.acceptedContracts],
            completedContracts: [...this.cache.completedContracts],
        };
    }

    getFilters() {
        return { ...this.cache.filters };
    }

    async setFilters(patch = {}) {
        await this.initialize();
        this.cache.filters = buildBoardQuestFilters({ ...this.cache.filters, ...patch }, questState.getActiveCharacter());
        this.notify('filtersChanged', this.getFilters());
        return this.refreshBoardPosts();
    }

    async resetFilters() {
        await this.initialize();
        this.cache.filters = buildBoardQuestFilters({}, questState.getActiveCharacter());
        this.notify('filtersChanged', this.getFilters());
        return this.getFilters();
    }

    async refreshBoardPosts() {
        await this.initialize();
        this.cache.boardPosts = await listBoardQuests({ filters: this.cache.filters });
        this.cache.lastFetch.boardPosts = Date.now();
        this.notify('boardPostsUpdated', [...this.cache.boardPosts]);
        return this.cache.boardPosts;
    }

    async refreshAcceptedContracts() {
        await this.initialize();
        this.cache.acceptedContracts = await getAcceptedBoardQuestsForActiveCharacter();
        this.cache.lastFetch.acceptedContracts = Date.now();
        this.notify('acceptedContractsUpdated', [...this.cache.acceptedContracts]);
        return this.cache.acceptedContracts;
    }

    async refreshCompletedContracts() {
        await this.initialize();
        this.cache.completedContracts = await getCompletedBoardContractsForCharacter();
        this.cache.lastFetch.completedContracts = Date.now();
        this.notify('completedContractsUpdated', [...this.cache.completedContracts]);
        return this.cache.completedContracts;
    }

    async loadPost(boardQuestId) {
        await this.initialize();
        if (!boardQuestId) {
            this.cache.activePost = null;
            this.cache.activePostId = null;
            this.notify('activePostChanged', null);
            return null;
        }

        this.cache.activePost = await getBoardQuestById(boardQuestId);
        this.cache.activePostId = boardQuestId;
        this.cache.lastFetch.activePost = Date.now();
        this.notify('activePostChanged', this.cache.activePost);
        return this.cache.activePost;
    }

    async loadPostFromUrl(url = window.location.href) {
        const { postId } = parseBoardQuestShareLink(url);
        if (!postId) return null;
        return this.loadPost(postId);
    }

    async refreshAll() {
        await this.initialize();
        await this.refreshBoardPosts();
        await this.refreshAcceptedContracts();
        await this.refreshCompletedContracts();
        if (this.cache.activePostId) {
            await this.loadPost(this.cache.activePostId);
        }
        return this.getSnapshot();
    }
}

export const boardQuestState = new BoardQuestState();

if (typeof window !== 'undefined') {
    window.boardQuestState = boardQuestState;
}
