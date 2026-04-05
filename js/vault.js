let currentUser     = null;
let currentViewItem = null;
let currentEditItem = null;
let itemToDelete    = null;
let allItems        = [];
let _genTarget      = 'add';
let currentSort     = 'newest';

document.addEventListener('DOMContentLoaded', function () {
    if (window.location.pathname.includes('dashboard')) {
        initDashboard();
    }
});

async function initDashboard() {
    await loadVaultItems();

    // ─── Add Password strength meter ───────────────────────
    document.getElementById('addPassword')?.addEventListener('input', e => {
        updateStrengthMeter(e.target.value, 'addStrengthFill', 'addStrengthLabel');
    });

    // ─── Search ─────────────────────────────────────────────
    const searchInput = document.getElementById('searchInput');
    const clearBtn    = document.getElementById('searchClear');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearBtn?.classList.toggle('show', this.value.length > 0);
            searchPasswords(this.value.toLowerCase());
        });
        clearBtn?.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('show');
            searchPasswords('');
        });
    }

    // ─── Sort ────────────────────────────────────────────────
    document.getElementById('sortSelect')?.addEventListener('change', function () {
        currentSort = this.value;
        const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
        searchPasswords(term);
    });

    // ─── Password Generator listeners ──────────────────────
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
        if (val) { copyToClipboard(val); toast('Password copied!', 'success'); }
    });
    document.getElementById('useGenPassword')?.addEventListener('click', () => {
        const val = document.getElementById('genOutput')?.value;
        if (!val) return;
        const fieldId = _genTarget === 'edit' ? 'editPassword' : 'addPassword';
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = val;
            field.dispatchEvent(new Event('input'));
        }
        closeModal('generatorModal');
    });

    // ─── CSV Import listener ────────────────────────────────
    document.getElementById('csvFileInput')?.addEventListener('change', handleCsvImport);

    // ─── Toggle pw inside modals ────────────────────────────
    document.querySelectorAll('.toggle-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.input-wrap')?.querySelector('input');
            if (!input) return;
            const isText = input.type === 'text';
            input.type      = isText ? 'password' : 'text';
            btn.textContent = isText ? '🙈' : '👁️';
        });
    });

    // ─── Close modals on backdrop click ────────────────────
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });

    // ─── Keyboard shortcuts ─────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['addModal','editModal','viewModal','deleteModal','generatorModal','importModal']
                .forEach(id => closeModal(id));
        }
    });
}

// ─── Load Vault Items ───────────────────────────────────────
async function loadVaultItems() {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    if (!window.supabaseClient) {
        grid.innerHTML = '<p class="error">Supabase not initialized. Refresh the page.</p>';
        return;
    }

    grid.innerHTML = '<p class="loading">Loading your vault…</p>';

    try {
        const { data: { user }, error: ue } = await window.supabaseClient.auth.getUser();
        if (ue || !user) { window.location.href = 'login.html'; return; }

        currentUser = user;

        const avatar = document.getElementById('navAvatar');
        const email  = document.getElementById('navEmail');
        if (avatar) avatar.textContent = user.email[0].toUpperCase();
        if (email)  email.textContent  = user.email;

        const { data: items, error } = await window.supabaseClient
            .from('vault_items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            const msg = error.code === '42P01'
                ? 'vault_items table not found. Please create it in Supabase SQL Editor.'
                : 'Error loading items: ' + error.message;
            grid.innerHTML = `<p class="error">${escapeHtml(msg)}</p>`;
            return;
        }

        allItems = items || [];
        updateStats(allItems.length);
        displayVaultItems(allItems);

    } catch (err) {
        grid.innerHTML = `<p class="error">Error: ${escapeHtml(err.message)}</p>`;
    }
}

function updateStats(count) {
    const el = document.getElementById('totalPasswords');
    if (el) el.textContent = count;

    // Show old password count badge
    const oldCount = allItems.filter(i => isOldPassword(i)).length;
    const oldBadge = document.getElementById('oldPasswordsBadge');
    if (oldBadge) {
        oldBadge.textContent = oldCount > 0 ? `⚠️ ${oldCount} old` : '';
        oldBadge.style.display = oldCount > 0 ? 'inline-flex' : 'none';
    }
}

// ─── Password Age Check (90 days) ──────────────────────────
function isOldPassword(item) {
    if (!item.created_at) return false;
    const days = (Date.now() - new Date(item.created_at)) / (1000 * 60 * 60 * 24);
    return days > 90;
}

// ─── Duplicate Detection ────────────────────────────────────
function getDuplicateWebsites() {
    const counts = {};
    allItems.forEach(i => {
        const d = extractDomain(i.website);
        counts[d] = (counts[d] || 0) + 1;
    });
    return new Set(Object.entries(counts).filter(([,v]) => v > 1).map(([k]) => k));
}

// ─── Sort Items ──────────────────────────────────────────────
function sortItems(items) {
    const arr = [...items];
    switch (currentSort) {
        case 'az':     return arr.sort((a, b) => a.website.localeCompare(b.website));
        case 'za':     return arr.sort((a, b) => b.website.localeCompare(a.website));
        case 'oldest': return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        default:       return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
}

// ─── Display ────────────────────────────────────────────────
function displayVaultItems(items) {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = '<p class="no-items">No passwords saved yet.<br>Click "+ Add New" to get started.</p>';
        return;
    }

    const sorted = sortItems(items);
    const duplicates = getDuplicateWebsites();

    // Re-map sorted items to allItems indices for click handlers
    grid.innerHTML = sorted.map((item, i) => {
        const domain     = extractDomain(item.website);
        const emoji      = getDomainEmoji(domain);
        const faviconHtml = `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64"
                                  onerror="this.parentElement.textContent='${emoji}'"
                                  alt="${escapeHtml(item.website)}">`;
        const date = item.created_at
            ? new Date(item.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
            : '';
        const isOld  = isOldPassword(item);
        const isDupe = duplicates.has(domain);
        const itemIdx = allItems.findIndex(x => x.id === item.id);

        return `
        <div class="vault-item${isOld ? ' vault-item--old' : ''}" style="animation-delay:${i * 40}ms">
            <div class="vault-item-header" onclick="viewPassword(allItems[${itemIdx}])">
                <div class="site-info">
                    <div class="site-favicon">${faviconHtml}</div>
                    <div style="flex:1;min-width:0;">
                        <div class="site-name-row">
                            <span class="site-name">${escapeHtml(item.website)}</span>
                            ${isDupe ? '<span class="badge badge-dupe" title="Multiple accounts for this site">2+</span>' : ''}
                            ${isOld  ? '<span class="badge badge-old" title="Password is over 90 days old">Old</span>' : ''}
                        </div>
                        <div class="site-username">${escapeHtml(item.username)}</div>
                    </div>
                </div>
                <div class="item-actions" onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="copyItemPassword(${itemIdx})" title="Copy password">📋</button>
                    <button class="btn-icon" onclick="openEditModal(allItems[${itemIdx}])" title="Edit">✏️</button>
                    <button class="btn-icon" onclick="openDeleteModal(allItems[${itemIdx}])" title="Delete">🗑️</button>
                </div>
            </div>
            ${date ? `<div class="item-date">Added ${date}</div>` : ''}
        </div>`;
    }).join('');
}

function copyItemPassword(index) {
    const item = allItems[index];
    if (!item) return;
    try {
        copyToClipboard(decrypt(item.encrypted_password));
        toast('Password copied!', 'success');
    } catch { toast('Copy failed', 'error'); }
}

function searchPasswords(term) {
    if (!term) { displayVaultItems(allItems); return; }
    const filtered = allItems.filter(i =>
        i.website.toLowerCase().includes(term) ||
        i.username.toLowerCase().includes(term)
    );
    displayVaultItems(filtered);
}

// ─── Submit Add Password ─────────────────────────────────────
async function submitAddPassword() {
    if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

    const website  = document.getElementById('addWebsite')?.value.trim();
    const username = document.getElementById('addUsername')?.value.trim();
    const password = document.getElementById('addPassword')?.value;

    if (!website)  { toast('Please enter a website', 'error'); return; }
    if (!username) { toast('Please enter a username', 'error'); return; }
    if (!password) { toast('Please enter a password', 'error'); return; }

    const btn = document.getElementById('addSaveBtn');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        const { error } = await window.supabaseClient.from('vault_items').insert([{
            user_id:            user.id,
            website:            website,
            username:           username,
            encrypted_password: encrypt(password),
        }]);

        if (error) { toast('Error: ' + error.message, 'error'); return; }

        toast('Password saved!', 'success');
        closeAddModal();
        await loadVaultItems();
    } catch (err) {
        toast(err.message || 'Something went wrong', 'error');
    } finally {
        if (btn) { btn.textContent = 'Save Password'; btn.disabled = false; }
    }
}

// ─── Submit Edit Password ────────────────────────────────────
async function submitEditPassword() {
    if (!window.supabaseClient) { toast('Supabase not initialized!', 'error'); return; }

    const id       = document.getElementById('editId')?.value;
    const website  = document.getElementById('editWebsite')?.value.trim();
    const username = document.getElementById('editUsername')?.value.trim();
    const password = document.getElementById('editPassword')?.value;

    if (!website)  { toast('Please enter a website', 'error'); return; }
    if (!username) { toast('Please enter a username', 'error'); return; }
    if (!password) { toast('Please enter a password', 'error'); return; }

    const btn = document.getElementById('editSaveBtn');
    if (btn) { btn.textContent = 'Updating…'; btn.disabled = true; }

    try {
        const { error } = await window.supabaseClient.from('vault_items').update({
            website,
            username,
            encrypted_password: encrypt(password),
        }).eq('id', id);

        if (error) { toast('Error: ' + error.message, 'error'); return; }

        toast('Password updated!', 'success');
        closeEditModal();
        await loadVaultItems();
    } catch (err) {
        toast(err.message || 'Something went wrong', 'error');
    } finally {
        if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
    }
}

// ─── CSV Export ──────────────────────────────────────────────
function exportCSV() {
    if (!allItems || allItems.length === 0) {
        toast('No passwords to export', 'info'); return;
    }

    const headers = ['Website', 'Username', 'Password', 'Added On'];
    const rows = allItems.map(item => {
        const pw   = (() => { try { return decrypt(item.encrypted_password); } catch { return ''; } })();
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '';
        return [item.website, item.username, pw, date].map(csvEscape).join(',');
    });

    const csv     = [headers.join(','), ...rows].join('\n');
    const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement('a');
    link.href     = url;
    link.download = `my-vault-export-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${allItems.length} passwords`, 'success');
}

function csvEscape(val) {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─── CSV Import ──────────────────────────────────────────────
function openImportModal() {
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('confirmImportBtn').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    window._importRows = [];
    openModal('importModal');
}

async function handleCsvImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('importPreview');
    preview.innerHTML = '<p style="color:var(--text3);font-size:13px;">Reading file…</p>';
    document.getElementById('confirmImportBtn').style.display = 'none';

    let text;
    try {
        text = await file.text();
    } catch (err) {
        showImportError('Could not read file: ' + err.message); return;
    }

    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
        showImportError('File is empty or has only one row. Need at least a header + one data row.'); return;
    }

    // ── Detect columns from header ──────────────────────────
    const headerLine = lines[0].toLowerCase();
    const headerCols = parseCsvLine(headerLine).map(h => h.trim().replace(/['"]/g, ''));
    const hasHeader  = headerCols.some(h =>
        ['website','url','name','username','login_uri','login_username','password','login_password'].includes(h)
    );

    // Map column names → indices
    // Supports: My Vault, Chrome, Bitwarden, Firefox, LastPass
    let colWebsite  = -1;
    let colUsername = -1;
    let colPassword = -1;

    if (hasHeader) {
        headerCols.forEach((h, i) => {
            if (['url','website','login_uri','name'].includes(h) && colWebsite  < 0) colWebsite  = i;
            if (['username','login_username','user name','email'].includes(h) && colUsername < 0) colUsername = i;
            if (['password','login_password'].includes(h)        && colPassword < 0) colPassword = i;
        });
    } else {
        // No header — assume: website(0), username(1), password(2)
        colWebsite = 0; colUsername = 1; colPassword = 2;
    }

    if (colWebsite < 0 || colPassword < 0) {
        showImportError(
            `Could not find required columns.\n\nDetected columns: ${hasHeader ? headerCols.join(', ') : 'none (no header)'}\n\nRequired: a "website" or "url" column, and a "password" column.`
        ); return;
    }

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows = [];
    const skipped = [];

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;
        const cols = parseCsvLine(line);

        const website  = (cols[colWebsite]  || '').trim();
        const username = colUsername >= 0 ? (cols[colUsername] || '').trim() : '';
        const password = (cols[colPassword] || '').trim();

        if (!website && !password) continue; // blank row
        if (!password) { skipped.push(`Row ${i + 2}: missing password`); continue; }

        rows.push({ website: website || '(unknown)', username, password });
    }

    if (rows.length === 0) {
        showImportError(
            'No valid rows found.' +
            (skipped.length ? `\n\nSkipped rows:\n${skipped.slice(0,5).join('\n')}` : '')
        ); return;
    }

    window._importRows = rows;

    // Preview table
    preview.innerHTML = `
        <div class="import-preview-header">
            Found <strong>${rows.length}</strong> password${rows.length !== 1 ? 's' : ''} to import
            ${skipped.length ? `<span style="color:var(--danger);margin-left:8px;">(${skipped.length} skipped)</span>` : ''}
        </div>
        <div class="import-table-wrap">
            <table class="import-table">
                <thead><tr><th>Website</th><th>Username</th><th>Password</th></tr></thead>
                <tbody>
                    ${rows.slice(0, 10).map(r => `
                    <tr>
                        <td>${escapeHtml(r.website)}</td>
                        <td>${escapeHtml(r.username || '—')}</td>
                        <td class="mono">${'•'.repeat(Math.min(r.password.length, 10))}</td>
                    </tr>`).join('')}
                    ${rows.length > 10 ? `<tr><td colspan="3" style="color:var(--text3);text-align:center;font-size:12px;">… aur ${rows.length - 10} aur</td></tr>` : ''}
                </tbody>
            </table>
        </div>`;
    document.getElementById('confirmImportBtn').style.display = 'block';
}

function showImportError(msg) {
    const preview = document.getElementById('importPreview');
    preview.innerHTML = `<div class="import-error-box">${escapeHtml(msg).replace(/\n/g,'<br>')}</div>`;
    document.getElementById('confirmImportBtn').style.display = 'none';
    // Reset file input so same file can be re-chosen
    document.getElementById('csvFileInput').value = '';
}

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
            result.push(current); current = '';
        } else { current += ch; }
    }
    result.push(current);
    return result;
}

async function confirmImport() {
    const rows = window._importRows || [];
    if (!rows.length || !window.supabaseClient) return;

    const btn = document.getElementById('confirmImportBtn');
    btn.textContent = 'Importing…'; btn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        const payload = rows.map(r => ({
            user_id:            user.id,
            website:            r.website,
            username:           r.username,
            encrypted_password: encrypt(r.password),
        }));

        const { error } = await window.supabaseClient.from('vault_items').insert(payload);
        if (error) { toast('Import error: ' + error.message, 'error'); return; }

        toast(`✅ Imported ${rows.length} passwords successfully!`, 'success', 4000);
        closeModal('importModal');
        await loadVaultItems();
    } catch (err) {
        toast(err.message || 'Import failed', 'error');
    } finally {
        btn.textContent = 'Import Passwords'; btn.disabled = false;
    }
}

// ─── Modals ──────────────────────────────────────────────────
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('show'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('show'); }

function openAddModal() { openModal('addModal'); }
function closeAddModal() {
    closeModal('addModal');
    ['addWebsite','addUsername','addPassword'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const fill = document.getElementById('addStrengthFill');
    const lbl  = document.getElementById('addStrengthLabel');
    if (fill) fill.style.width = '0%';
    if (lbl)  lbl.textContent  = '';
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
    document.getElementById('viewFavicon').textContent   = getDomainEmoji(domain);
    document.getElementById('viewWebsite').textContent   = item.website;
    document.getElementById('viewUsername2').textContent = item.username;
    const pw = document.getElementById('viewPassword');
    pw.textContent        = '••••••••';
    pw.dataset.showing    = 'false';
    openModal('viewModal');
}
function closeViewModal() { closeModal('viewModal'); currentViewItem = null; }

function editFromView()   { if (currentViewItem) openEditModal(currentViewItem); }
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

// ─── View Modal Actions ──────────────────────────────────────
function togglePassword() {
    const span    = document.getElementById('viewPassword');
    const showing = span.dataset.showing === 'true';
    if (!showing) {
        try { span.textContent = decrypt(currentViewItem.encrypted_password); }
        catch { toast('Decryption error', 'error'); return; }
        span.dataset.showing = 'true';
    } else {
        span.textContent     = '••••••••';
        span.dataset.showing = 'false';
    }
}

function copyPassword() {
    try { copyToClipboard(decrypt(currentViewItem.encrypted_password)); toast('Password copied!', 'success'); }
    catch { toast('Error copying password', 'error'); }
}

function copyUsername() {
    if (!currentViewItem) return;
    copyToClipboard(currentViewItem.username);
    toast('Username copied!', 'success');
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.select();
    try { document.execCommand('copy'); } catch {}
    el.remove();
}

// ─── Password Generator ──────────────────────────────────────
function openGenerator(target) {
    _genTarget = target || 'add';
    generatePassword();
    openModal('generatorModal');
}
function closeGenerator() { closeModal('generatorModal'); }

function generatePassword() {
    const len      = parseInt(document.getElementById('genLength')?.value || 16);
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

// ─── Strength Meter ──────────────────────────────────────────
function updateStrengthMeter(pw, fillId, labelId) {
    const fill  = document.getElementById(fillId);
    const label = document.getElementById(labelId);
    if (!fill || !label) return;

    let score = 0;
    if (pw.length >= 8)           score++;
    if (pw.length >= 12)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const levels = [
        { w:'0%',   c:'transparent', t:'' },
        { w:'25%',  c:'#e07070',     t:'Weak' },
        { w:'50%',  c:'#d4a84b',     t:'Fair' },
        { w:'75%',  c:'#6dbf8e',     t:'Good' },
        { w:'100%', c:'#6dbf8e',     t:'Strong' },
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
    return '🌐';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}