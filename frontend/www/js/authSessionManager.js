/**
 * Auth Session Manager
 *
 * Single wrapper around supabase.auth.onAuthStateChange that prevents
 * duplicate callbacks caused by Supabase firing SIGNED_IN on every
 * token refresh (which happens when the user returns to a tab).
 *
 * Only fires subscriber callbacks when:
 *   - The user actually changes  (different user ID)
 *   - The user signs out         (SIGNED_OUT event)
 *
 * Usage:
 *   import { authSession } from './authSessionManager.js';
 *
 *   // Subscribe to real auth changes
 *   authSession.onChange((event, user) => {
 *       if (event === 'SIGNED_IN')  { ... }
 *       if (event === 'SIGNED_OUT') { ... }
 *   });
 *
 *   // Get the current user (one-shot, no subscription needed)
 *   const user = await authSession.getUser();
 */

import { supabase } from './supabaseClient.js';

class AuthSessionManager {
    constructor() {
        this._currentUserId = null;
        this._currentUser   = null;
        this._subscribers   = new Set();
        this._initialized   = false;
        this._pendingInit   = null;

        // Start listening immediately so we never miss an early event
        this._listen();
    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Subscribe to real auth changes.
     * Callback signature: (event: 'SIGNED_IN' | 'SIGNED_OUT', user: object | null) => void
     * Returns an unsubscribe function.
     */
    onChange(callback) {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }

    /**
     * Returns the current Supabase user, fetching once if not yet known.
     * Safe to call multiple times — subsequent calls return the cached value.
     */
    async getUser() {
        if (this._initialized) return this._currentUser;

        if (this._pendingInit) return await this._pendingInit;

        this._pendingInit = supabase.auth.getUser().then(({ data: { user } }) => {
            this._currentUser   = user ?? null;
            this._currentUserId = user?.id ?? null;
            this._initialized   = true;
            this._pendingInit   = null;
            return this._currentUser;
        });

        return await this._pendingInit;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    _listen() {
        supabase.auth.onAuthStateChange((event, session) => {
            const incomingId = session?.user?.id ?? null;

            if (event === 'SIGNED_OUT') {
                this._currentUser   = null;
                this._currentUserId = null;
                this._initialized   = true;
                this._notify('SIGNED_OUT', null);
                return;
            }

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (incomingId && incomingId === this._currentUserId) {
                    // Same user, token refresh — ignore
                    return;
                }

                // Genuine new session
                this._currentUser   = session?.user ?? null;
                this._currentUserId = incomingId;
                this._initialized   = true;
                this._notify('SIGNED_IN', this._currentUser);
                return;
            }
            // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY, etc. — ignore
        });
    }

    _notify(event, user) {
        this._subscribers.forEach(cb => {
            try { cb(event, user); }
            catch (e) { console.error('[AuthSession] Subscriber error:', e); }
        });
    }
}

// Singleton — one listener for the entire page
export const authSession = new AuthSessionManager();
