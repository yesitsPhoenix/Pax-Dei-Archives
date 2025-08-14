// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jrjgbnopmfovxwvtbivh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyamdibm9wbWZvdnh3dnRiaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgxOTg1MjYsImV4cCI6MjAyMzc3NDUyNn0.za7oUzFhNmBdtcCRBmxwW5FSTFRWVAY6_rsRwlr3iqY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// async function checkUserAccess(userId) {
//     try {
//         const { data, error } = await supabase
//             .from('users')
//             .select('allow_access')
//             .eq('id', userId)
//             .single();

//         if (error) {
//             return false;
//         }

//         if (data && data.allow_access === true) {
//             return true;
//         } else {
//             return false;
//         }
//     } catch (err) {
//         return false;
//     }
// }


// document.addEventListener('DOMContentLoaded', async () => {
//     supabase.auth.onAuthStateChange(async (event, session) => {
//         if (event === 'SIGNED_IN' && session) {
//             const userId = session.user.id;
//             const hasAccess = await checkUserAccess(userId);

//             if (hasAccess) {
//             } else {
//                 alert('We\'re sorry, an error has occurred.');
//                 await supabase.auth.signOut();
//                 window.location.href = '/Pax-Dei-Archives'; 
//             }
//         } else if (event === 'SIGNED_OUT') {
//         }
//     });
// });

