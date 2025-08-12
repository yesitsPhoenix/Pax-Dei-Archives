// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUserAccess(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('allow_access')
            .eq('id', userId)
            .single();

        if (error) {
            //console.error('Error fetching user access status:', error.message);
            return false;
        }

        if (data && data.allow_access === true) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        //console.error('An unexpected error occurred during access check:', err);
        return false;
    }
}

async function handleLoginAndCheckAccess(email, password) {
    //console.log(`Attempting to log in user: ${email}`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
        //console.error('Login failed:', authError.message);
        alert(`We're sorry, an error has occurred.`);
        return;
    }

    const userId = authData.user.id;
    if (userId) {
        //console.log(`User logged in: ${userId}`);
        const hasAccess = await checkUserAccess(userId);

        if (hasAccess) {
            console.log('Access granted! User can proceed to the site.');
        } else {
            //console.log('Access denied! User is not allowed to log in or has been restricted.');
            alert('We\'re sorry, an error has occurred.');
            await supabase.auth.signOut();
        }
    } else {
        console.error('No user data received after login attempt.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            const userId = session.user.id;
            const hasAccess = await checkUserAccess(userId);

            if (hasAccess) {
                // User has access
            } else {
                alert('We\'re sorry, an error has occurred.');
                await supabase.auth.signOut();
                window.location.href = '/'; // Redirect to index page after sign out
            }
        } else if (event === 'SIGNED_OUT') {
            //console.log('User signed out.');
        }
    });
});

