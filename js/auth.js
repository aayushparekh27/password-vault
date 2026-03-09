document.addEventListener('DOMContentLoaded', function () {

    // ─── Register ──────────────────────────────────────────
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        // Password strength meter
        const pwInput = document.getElementById('password');
        if (pwInput) {
            pwInput.addEventListener('input', () => updateStrength(pwInput.value));
        }

        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const email    = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirm  = document.getElementById('confirmPassword').value;
            const btn      = registerForm.querySelector('button[type="submit"]');

            if (password !== confirm) { toast('Passwords do not match!', 'error'); return; }
            if (password.length < 6)  { toast('Password must be at least 6 characters!', 'error'); return; }

            btn.textContent = 'Creating account…'; btn.disabled = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
                if (error) { toast(error.message, 'error'); return; }
                if (data.user) {
                    toast('Account created! Check your email to confirm.', 'success', 5000);
                    setTimeout(() => window.location.href = 'login.html', 2000);
                }
            } catch (err) {
                toast(err.message, 'error');
            } finally {
                btn.textContent = 'Create Account'; btn.disabled = false;
            }
        });
    }

    // ─── Login ─────────────────────────────────────────────
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const email    = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const btn      = loginForm.querySelector('button[type="submit"]');

            btn.textContent = 'Logging in…'; btn.disabled = true;

            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                if (error) { toast(error.message, 'error'); return; }
                toast('Welcome back!', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 800);
            } catch (err) {
                toast(err.message, 'error');
            } finally {
                btn.textContent = 'Login'; btn.disabled = false;
            }
        });
    }

    // ─── Password Strength ─────────────────────────────────
    function updateStrength(pw) {
        const fill  = document.getElementById('strengthFill');
        const label = document.getElementById('strengthLabel');
        if (!fill || !label) return;

        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        const levels = [
            { w: '0%',   c: 'transparent', t: '' },
            { w: '25%',  c: '#f87171',     t: 'Weak' },
            { w: '50%',  c: '#fbbf24',     t: 'Fair' },
            { w: '75%',  c: '#38bdf8',     t: 'Good' },
            { w: '100%', c: '#34d399',     t: 'Strong' },
        ];
        const lvl = levels[Math.min(score, 4)];
        fill.style.width      = lvl.w;
        fill.style.background = lvl.c;
        label.textContent     = lvl.t;
        label.style.color     = lvl.c;
    }

    // ─── Toggle Password Visibility (auth forms) ───────────
    document.querySelectorAll('.toggle-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.input-wrap').querySelector('input');
            const isText = input.type === 'text';
            input.type = isText ? 'password' : 'text';
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