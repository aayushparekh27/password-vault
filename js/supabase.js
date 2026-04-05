// ─── Supabase Config ─────────────────────────────────────
// Replace these with your actual Supabase project credentials
const SUPABASE_URL     = 'https://grqggvijeurcdkwgjclt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vhtEckW1iZPeeNA-E3Almw_47oHNuJZ';

window.supabaseClient = null;

(function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase initialized');
        } else {
            console.error('❌ Supabase library not loaded. Check your internet connection.');
        }
    } catch (err) {
        console.error('❌ Supabase init error:', err);
    }
})();

// ─── Encryption (Base64 — upgrade to AES for production) ─
function encrypt(text) {
    try { return btoa(unescape(encodeURIComponent(text))); }
    catch { return btoa(text); }
}
function decrypt(enc) {
    try { return decodeURIComponent(escape(atob(enc))); }
    catch { try { return atob(enc); } catch { return ''; } }
}

// ─── Toast Notifications ──────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const safe = String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    t.innerHTML = `<span>${icons[type] || icons.info}</span><span>${safe}</span>`;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 300);
    }, duration);
}