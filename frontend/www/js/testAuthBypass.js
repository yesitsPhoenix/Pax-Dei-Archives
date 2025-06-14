// testAuthBypass.js
// This module provides functions to enable and disable a simulated Discord OAuth login
// for local testing purposes. It mocks the supabase.auth.getUser() method.

import { supabase } from './supabaseClient.js'; // Assuming supabaseClient.js is available and correctly exports 'supabase'

// Store the original getUser method to potentially restore it (though typically a page refresh is simpler)
let originalGetUser = null;

/**
 * Enables the test authentication bypass.
 * This will set a localStorage item and override `supabase.auth.getUser()`
 * to return a mock user object.
 */
export function enableTestAuthBypass() {
    localStorage.setItem('_paxdei_test_user', 'true');

    // Store the original getUser method if it hasn't been stored already
    if (!originalGetUser && supabase && supabase.auth && typeof supabase.auth.getUser === 'function') {
        originalGetUser = supabase.auth.getUser;
    }

    // Override supabase.auth.getUser() to return a mock user
    if (supabase && supabase.auth) {
        supabase.auth.getUser = async () => {
            console.warn('Supabase Auth Bypass: Returning mock user.');
            return {
                data: {
                    user: {
                        id: 'mock-user-id-for-testing', // A consistent mock user ID
                        email: 'test@example.com',
                        user_metadata: {
                            full_name: 'Test User',
                            // Add other metadata if your authorization logic depends on it
                            // For example, if you check roles: role: 'admin'
                            role: 'admin_comment_adder' // Example: if your `isAuthorizedAdmin` checks for a specific role
                        }
                    }
                },
                error: null
            };
        };
    } else {
        console.error('Supabase client or auth object not available. Cannot enable test bypass.');
    }
    console.log('Local Testing Mode ENABLED. Please refresh the page.');
}

/**
 * Disables the test authentication bypass.
 * This will remove the localStorage item. A page refresh is typically needed
 * for the changes to take full effect as `supabase.auth.getUser()` is restored
 * by the browser reloading the script.
 */
export function disableTestAuthBypass() {
    localStorage.removeItem('_paxdei_test_user');

    // If we have the original getUser method, attempt to restore it
    // Note: For full restoration, a page reload is usually required as script execution order matters.
    if (originalGetUser && supabase && supabase.auth) {
        supabase.auth.getUser = originalGetUser;
        originalGetUser = null; // Clear the stored original method
        console.log('Supabase Auth Bypass: Restored original getUser method.');
    } else {
        console.log('Supabase Auth Bypass: Original getUser method not restored (was not mocked or already reset).');
    }

    console.log('Local Testing Mode DISABLED. Please refresh the page.');
}

/**
 * Checks if the test authentication bypass is currently enabled.
 * @returns {boolean} True if test mode is enabled, false otherwise.
 */
export function isTestAuthBypassEnabled() {
    return localStorage.getItem('_paxdei_test_user') === 'true';
}

// Automatically apply the bypass if it's enabled on page load
// This ensures the mock is active as soon as the module loads if the flag is set.
document.addEventListener('DOMContentLoaded', () => {
    if (isTestAuthBypassEnabled()) {
        enableTestAuthBypass();
    }
});
