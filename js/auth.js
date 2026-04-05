document.addEventListener('DOMContentLoaded', function () {

    // ─── Password Strength Meter ────────────────────────────
    function updateStrength(pw, fillId, labelId) {
        const fill  = document.getElementById(fillId  || 'strengthFill');
        const label = document.getElementById(labelId || 'strengthLabel');
        if (!fill || !label) return;

        let score = 0;
        if (pw.length >= 8)            score++;
        if (pw.length >= 12)           score++;
        if (/[A-Z]/.test(pw))         score++;
        if (/[0-9]/.test(pw))         score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        const levels = [
            { w: '0%',   c: 'transparent',          t: '' },
            { w: '25%',  c: '#e07070',               t: 'Weak' },
            { w: '50%',  c: '#d4a84b',               t: 'Fair' },
            { w: '75%',  c: '#6dbf8e',               t: 'Good' },
            { w: '100%', c: 'var(--success)',         t: 'Strong' },
        ];
        const lvl = levels[Math.min(score, 4)];
        fill.style.width      = lvl.w;
        fill.style.background = lvl.c;
        label.textContent     = lvl.t;
        label.style.color     = lvl.c;
    }

    // ─── Register ──────────────────────────────────────────
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        const pwInput = document.getElementById('password');
        if (pwInput) {
            pwInput.addEventListener('input', () => updateStrength(pwInput.value));
        }

        registerBtn.addEventListener('click', async function () {
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const email    = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value;
            const confirm  = document.getElementById('confirmPassword')?.value;

            if (!email)              { toast('Please enter your email', 'error'); return; }
            if (!password)           { toast('Please enter a password', 'error'); return; }
            if (password !== confirm){ toast('Passwords do not match!', 'error'); return; }
            if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }

            registerBtn.textContent = 'Creating account…';
            registerBtn.disabled    = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) { toast(error.message, 'error'); return; }
                if (data.user) {
                    toast('Account created! Check your email to confirm.', 'success', 5000);
                    setTimeout(() => window.location.href = 'login.html', 2200);
                }
            } catch (err) {
                toast(err.message || 'Something went wrong', 'error');
            } finally {
                registerBtn.textContent = 'Create Account';
                registerBtn.disabled    = false;
            }
        });
    }

    // ─── Login ─────────────────────────────────────────────
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        // Allow Enter key on password field
        document.getElementById('password')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') loginBtn.click();
        });
        document.getElementById('email')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') loginBtn.click();
        });

        loginBtn.addEventListener('click', async function () {
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const email    = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value;

            if (!email)    { toast('Please enter your email', 'error'); return; }
            if (!password) { toast('Please enter your password', 'error'); return; }

            loginBtn.textContent = 'Logging in…';
            loginBtn.disabled    = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) { toast(error.message, 'error'); return; }
                toast('Welcome back!', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 700);
            } catch (err) {
                toast(err.message || 'Something went wrong', 'error');
            } finally {
                loginBtn.textContent = 'Login';
                loginBtn.disabled    = false;
            }
        });
    }

    // ─── Toggle Password Visibility ────────────────────────
    document.querySelectorAll('.toggle-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.input-wrap')?.querySelector('input');
            if (!input) return;
            const isText = input.type === 'text';
            input.type      = isText ? 'password' : 'text';
            btn.textContent = isText ? '🙈' : '👁️';
        });
    });
});

// ─── Logout ────────────────────────────────────────────────
async function logout() {
    if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }
    try {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (err) {
        toast('Error logging out: ' + err.message, 'error');
    }
}