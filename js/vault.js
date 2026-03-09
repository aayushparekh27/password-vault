let currentUser   = null;
let currentViewItem = null;
let currentEditItem = null;
let itemToDelete  = null;
let allItems      = [];

document.addEventListener('DOMContentLoaded', function () {

    if (window.location.pathname.includes('dashboard.html')) {
        loadVaultItems();
    }

    // ─── Add Password Form ──────────────────────────────────
    const addForm = document.getElementById('addPasswordForm');
    if (addForm) {
        // Strength meter for add form
        document.getElementById('password')?.addEventListener('input', e => updateAddStrength(e.target.value));

        addForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const website  = document.getElementById('website').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const btn      = addForm.querySelector('button[type="submit"]');

            if (!website || !username || !password) { toast('Please fill in all fields', 'error'); return; }

            btn.textContent = 'Saving…'; btn.disabled = true;

            try {
                const { data: { user }, error: ue } = await window.supabaseClient.auth.getUser();
                if (ue || !user) { window.location.href = 'login.html'; return; }

                const { error } = await window.supabaseClient
                    .from('vault_items')
                    .insert([{ user_id: user.id, website, username, encrypted_password: encrypt(password) }]);

                if (error) {
                    if (error.code === '42P01') toast('vault_items table not found in Supabase!', 'error');
                    else toast('Error: ' + error.message, 'error');
                    return;
                }

                toast('Password saved!', 'success');
                addForm.reset();
                document.getElementById('addStrengthFill').style.width = '0%';
                document.getElementById('addStrengthLabel').textContent = '';
                closeModal('addModal');
                await loadVaultItems();

            } catch (err) {
                toast(err.message, 'error');
            } finally {
                btn.textContent = 'Save Password'; btn.disabled = false;
            }
        });
    }

    // ─── Edit Password Form ─────────────────────────────────
    const editForm = document.getElementById('editPasswordForm');
    if (editForm) {
        editForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

            const id       = document.getElementById('editId').value;
            const website  = document.getElementById('editWebsite').value.trim();
            const username = document.getElementById('editUsername').value.trim();
            const password = document.getElementById('editPassword').value;
            const btn      = editForm.querySelector('button[type="submit"]');

            btn.textContent = 'Updating…'; btn.disabled = true;

            try {
                const { error } = await window.supabaseClient
                    .from('vault_items')
                    .update({ website, username, encrypted_password: encrypt(password) })
                    .eq('id', id);

                if (error) { toast('Error: ' + error.message, 'error'); return; }
                toast('Password updated!', 'success');
                closeModal('editModal');
                closeModal('viewModal');
                await loadVaultItems();

            } catch (err) {
                toast(err.message, 'error');
            } finally {
                btn.textContent = 'Update Password'; btn.disabled = false;
            }
        });
    }

    // ─── Search ─────────────────────────────────────────────
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const clearBtn = document.getElementById('searchClear');
        searchInput.addEventListener('input', function () {
            if (clearBtn) clearBtn.classList.toggle('show', this.value.length > 0);
            searchPasswords(this.value.toLowerCase());
        });
        clearBtn?.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('show');
            searchPasswords('');
        });
    }

    // ─── Password Generator ─────────────────────────────────
    document.getElementById('genRefresh')?.addEventListener('click', generatePassword);
    document.getElementById('genLength')?.addEventListener('input', function () {
        document.getElementById('genLengthVal').textContent = this.value;
        generatePassword();
    });
    document.querySelectorAll('.gen-check input').forEach(cb => {
        cb.addEventListener('change', generatePassword);
    });
    document.getElementById('genCopy')?.addEventListener('click', () => {
        const val = document.getElementById('genOutput')?.value;
        if (val) { copyToClipboard(val); toast('Generated password copied!', 'success'); }
    });
    document.getElementById('useGenPassword')?.addEventListener('click', () => {
        const val = document.getElementById('genOutput')?.value;
        if (val) {
            const pwField = document.getElementById('password') || document.getElementById('editPassword');
            if (pwField) { pwField.value = val; pwField.dispatchEvent(new Event('input')); }
            closeModal('generatorModal');
        }
    });

    // Toggle pw visibility inside modals
    document.querySelectorAll('.toggle-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.input-wrap')?.querySelector('input');
            if (!input) return;
            const isText = input.type === 'text';
            input.type = isText ? 'password' : 'text';
            btn.textContent = isText ? '🙈' : '👁️';
        });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });
});

// ─── Load Vault Items ───────────────────────────────────────
async function loadVaultItems() {
    if (!window.supabaseClient) {
        document.getElementById('vaultGrid').innerHTML = '<p class="error">Supabase not initialized. Refresh the page.</p>';
        return;
    }

    document.getElementById('vaultGrid').innerHTML = '<p class="loading">Loading your vault…</p>';

    try {
        const { data: { user }, error: ue } = await window.supabaseClient.auth.getUser();
        if (ue || !user) { window.location.href = 'login.html'; return; }

        currentUser = user;

        // Show user info in nav
        const avatar = document.getElementById('navAvatar');
        const email  = document.getElementById('navEmail');
        if (avatar) avatar.textContent = user.email[0].toUpperCase();
        if (email)  email.textContent  = user.email;

        const { data: items, error } = await window.supabaseClient
            .from('vault_items').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            const msg = error.code === '42P01'
                ? 'vault_items table not found. Create it in Supabase.'
                : 'Error loading items: ' + error.message;
            document.getElementById('vaultGrid').innerHTML = `<p class="error">${msg}</p>`;
            return;
        }

        allItems = items || [];
        updateStats(allItems.length);
        displayVaultItems(allItems);

    } catch (err) {
        document.getElementById('vaultGrid').innerHTML = '<p class="error">Error loading vault.</p>';
    }
}

function updateStats(count) {
    const el = document.getElementById('totalPasswords');
    if (el) el.textContent = count;
}

// ─── Display ────────────────────────────────────────────────
function displayVaultItems(items) {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = '<p class="no-items">🔒 No passwords saved yet. Click "+ Add New Password" to get started.</p>';
        return;
    }

    grid.innerHTML = items.map((item, i) => {
        const domain = extractDomain(item.website);
        const emoji  = getDomainEmoji(domain);
        const date   = new Date(item.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const itemStr = JSON.stringify(item).replace(/'/g, '&apos;');

        return `
        <div class="vault-item" data-id="${item.id}" style="animation-delay:${i * 40}ms">
            <div class="vault-item-header" onclick='viewPassword(${itemStr})'>
                <div class="site-info">
                    <div class="site-favicon">${emoji}</div>
                    <div>
                        <div class="site-name">${escapeHtml(item.website)}</div>
                        <div class="site-username">${escapeHtml(item.username)}</div>
                    </div>
                </div>
                <div class="item-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick='openEditModal(${itemStr})' title="Edit">✏️</button>
                    <button class="btn-icon" onclick='openDeleteModal(${itemStr})' title="Delete">🗑️</button>
                </div>
            </div>
            <div class="item-date">Added ${date}</div>
        </div>`;
    }).join('');
}

// ─── Search ─────────────────────────────────────────────────
function searchPasswords(term) {
    if (!term) { displayVaultItems(allItems); return; }
    const filtered = allItems.filter(i =>
        i.website.toLowerCase().includes(term) ||
        i.username.toLowerCase().includes(term)
    );
    displayVaultItems(filtered);
}

// ─── Modals ──────────────────────────────────────────────────
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('show'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }

function openAddModal() { openModal('addModal'); }
function closeAddModal() {
    closeModal('addModal');
    document.getElementById('addPasswordForm')?.reset();
    if (document.getElementById('addStrengthFill')) {
        document.getElementById('addStrengthFill').style.width = '0%';
        document.getElementById('addStrengthLabel').textContent = '';
    }
}

function openEditModal(item) {
    currentEditItem = item;
    document.getElementById('editId').value       = item.id;
    document.getElementById('editWebsite').value  = item.website;
    document.getElementById('editUsername').value = item.username;
    try { document.getElementById('editPassword').value = decrypt(item.encrypted_password); }
    catch { document.getElementById('editPassword').value = ''; }
    closeModal('viewModal');
    openModal('editModal');
}
function closeEditModal() { closeModal('editModal'); currentEditItem = null; }

function viewPassword(item) {
    currentViewItem = item;
    const domain = extractDomain(item.website);
    document.getElementById('viewFavicon').textContent  = getDomainEmoji(domain);
    document.getElementById('viewWebsite').textContent  = item.website;
    document.getElementById('viewUsername2').textContent = item.username;
    document.getElementById('viewPassword').textContent  = '••••••••';
    document.getElementById('viewPassword').dataset.showing = 'false';
    openModal('viewModal');
}
function closeViewModal() { closeModal('viewModal'); currentViewItem = null; }

function editFromView() { if (currentViewItem) openEditModal(currentViewItem); }
function deleteFromView() { if (currentViewItem) openDeleteModal(currentViewItem); }

function openDeleteModal(item) {
    itemToDelete = item;
    document.getElementById('deleteWebsite').textContent = item.website;
    closeModal('viewModal');
    openModal('deleteModal');
}
function closeDeleteModal() { closeModal('deleteModal'); itemToDelete = null; }

// ─── Delete ──────────────────────────────────────────────────
async function confirmDelete() {
    if (!itemToDelete || !window.supabaseClient) return;

    const btn = document.getElementById('confirmDeleteBtn');
    if (btn) { btn.textContent = 'Deleting…'; btn.disabled = true; }

    try {
        const { error } = await window.supabaseClient
            .from('vault_items').delete().eq('id', itemToDelete.id);
        if (error) { toast('Error: ' + error.message, 'error'); return; }
        toast('Password deleted!', 'success');
        closeDeleteModal();
        await loadVaultItems();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        if (btn) { btn.textContent = 'Yes, Delete'; btn.disabled = false; }
    }
}

// ─── Toggle / Copy in View Modal ────────────────────────────
function togglePassword() {
    const span = document.getElementById('viewPassword');
    const showing = span.dataset.showing === 'true';
    if (!showing) {
        try { span.textContent = decrypt(currentViewItem.encrypted_password); }
        catch { toast('Decryption error', 'error'); return; }
        span.dataset.showing = 'true';
    } else {
        span.textContent = '••••••••';
        span.dataset.showing = 'false';
    }
}

function copyPassword() {
    try {
        copyToClipboard(decrypt(currentViewItem.encrypted_password));
        toast('Password copied to clipboard!', 'success');
    } catch { toast('Error copying password', 'error'); }
}

function copyUsername() {
    copyToClipboard(currentViewItem.username);
    toast('Username copied!', 'success');
}

function copyToClipboard(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    else {
        const el = document.createElement('textarea');
        el.value = text; document.body.appendChild(el);
        el.select(); document.execCommand('copy');
        el.remove();
    }
}

// ─── Password Generator ──────────────────────────────────────
function openGenerator(target) {
    window._genTarget = target;
    generatePassword();
    openModal('generatorModal');
}
function closeGenerator() { closeModal('generatorModal'); }

function generatePassword() {
    const len    = parseInt(document.getElementById('genLength')?.value || 16);
    const useUpper = document.getElementById('genUpper')?.checked ?? true;
    const useLower = document.getElementById('genLower')?.checked ?? true;
    const useNums  = document.getElementById('genNums')?.checked  ?? true;
    const useSyms  = document.getElementById('genSyms')?.checked  ?? false;

    let chars = '';
    if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useNums)  chars += '0123456789';
    if (useSyms)  chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars)   chars  = 'abcdefghijklmnopqrstuvwxyz';

    let pw = '';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    arr.forEach(v => pw += chars[v % chars.length]);

    const out = document.getElementById('genOutput');
    if (out) out.value = pw;
}

// ─── Strength meters ─────────────────────────────────────────
function updateAddStrength(pw) {
    updateStrengthMeter(pw, 'addStrengthFill', 'addStrengthLabel');
}
function updateStrengthMeter(pw, fillId, labelId) {
    const fill  = document.getElementById(fillId);
    const label = document.getElementById(labelId);
    if (!fill || !label) return;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
        { w:'0%',   c:'transparent', t:'' },
        { w:'25%',  c:'#f87171',     t:'Weak' },
        { w:'50%',  c:'#fbbf24',     t:'Fair' },
        { w:'75%',  c:'#38bdf8',     t:'Good' },
        { w:'100%', c:'#34d399',     t:'Strong' },
    ];
    const lvl = levels[Math.min(score, 4)];
    fill.style.width      = lvl.w;
    fill.style.background = lvl.c;
    label.textContent     = lvl.t;
    label.style.color     = lvl.c;
}

// ─── Helpers ─────────────────────────────────────────────────
function extractDomain(url) {
    try {
        if (!url.startsWith('http')) url = 'https://' + url;
        return new URL(url).hostname.replace('www.', '');
    } catch { return url.toLowerCase(); }
}

function getDomainEmoji(domain) {
    const map = {
        'google': '🔍', 'gmail': '📧', 'youtube': '▶️', 'github': '🐙',
        'facebook': '📘', 'instagram': '📸', 'twitter': '🐦', 'x.com': '✖️',
        'linkedin': '💼', 'amazon': '📦', 'netflix': '🎬', 'spotify': '🎵',
        'discord': '🎮', 'slack': '💬', 'notion': '📝', 'figma': '🎨',
        'apple': '🍎', 'microsoft': '🪟', 'reddit': '🤖', 'twitch': '🎮',
    };
    for (const [k, v] of Object.entries(map)) {
        if (domain.includes(k)) return v;
    }
    return '🔐';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}