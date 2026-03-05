// Supabase configuration - TERI ACTUAL VALUES DAL
const SUPABASE_URL = 'https://grqggvijeurcdkwgjclt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vhtEckW1iZPeeNA-E3Almw_47oHNuJZ';

// Global variable - REMOVE 'let' or 'const' if already declared
window.supabaseClient = null;

// Initialize immediately when script loads
(function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialized successfully');
        } else {
            console.error('❌ Supabase library not loaded yet');
        }
    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
    }
})();

// Helper functions
function encrypt(text) {
    return btoa(text);
}

function decrypt(encrypted) {
    return atob(encrypted);
}