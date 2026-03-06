// Use window.supabaseClient instead of supabase
let currentUser = null;
let currentViewItem = null;
let currentEditItem = null;
let itemToDelete = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Vault.js loaded');
    
    // Check if we're on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        loadVaultItems();
    }
    
    // Add password form handler
    const addPasswordForm = document.getElementById('addPasswordForm');
    if (addPasswordForm) {
        addPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Add password form submitted');
            
            if (!window.supabaseClient) {
                alert('Supabase not initialized! Please refresh the page.');
                return;
            }
            
            const website = document.getElementById('website').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Validate inputs
            if (!website || !username || !password) {
                alert('Please fill in all fields');
                return;
            }
            
            // Encrypt password
            const encryptedPassword = encrypt(password);
            console.log('Encrypted password:', encryptedPassword);
            
            try {
                // Get current user
                const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
                
                if (userError) {
                    console.error('User error:', userError);
                    throw userError;
                }
                
                if (!user) {
                    alert('You must be logged in to save passwords');
                    window.location.href = 'login.html';
                    return;
                }
                
                console.log('Current user:', user.id);
                
                // Insert into database
                const { data, error } = await window.supabaseClient
                    .from('vault_items')
                    .insert([
                        {
                            user_id: user.id,
                            website: website,
                            username: username,
                            encrypted_password: encryptedPassword
                        }
                    ])
                    .select();
                
                if (error) {
                    console.error('Insert error:', error);
                    
                    if (error.code === '42P01') {
                        alert('Database table not found. Please create the vault_items table in Supabase.');
                    } else {
                        alert('Error saving password: ' + error.message);
                    }
                    return;
                }
                
                console.log('Password saved successfully:', data);
                alert('✅ Password saved successfully!');
                
                // Clear form and close modal
                document.getElementById('addPasswordForm').reset();
                closeAddModal();
                
                // Reload vault items
                await loadVaultItems();
                
            } catch (error) {
                console.error('Unexpected error:', error);
                alert('❌ Something went wrong: ' + error.message);
            }
        });
    }
    
    // Edit password form handler
    const editPasswordForm = document.getElementById('editPasswordForm');
    if (editPasswordForm) {
        editPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!window.supabaseClient) {
                alert('Supabase not initialized!');
                return;
            }
            
            const id = document.getElementById('editId').value;
            const website = document.getElementById('editWebsite').value;
            const username = document.getElementById('editUsername').value;
            const password = document.getElementById('editPassword').value;
            
            // Encrypt password
            const encryptedPassword = encrypt(password);
            
            try {
                const { error } = await window.supabaseClient
                    .from('vault_items')
                    .update({
                        website: website,
                        username: username,
                        encrypted_password: encryptedPassword
                    })
                    .eq('id', id);
                
                if (error) {
                    alert('Error updating password: ' + error.message);
                    return;
                }
                
                alert('✅ Password updated successfully!');
                closeEditModal();
                closeViewModal();
                await loadVaultItems();
                
            } catch (error) {
                alert('❌ Something went wrong: ' + error.message);
            }
        });
    }
});

// Load vault items
async function loadVaultItems() {
    console.log('Loading vault items...');
    
    if (!window.supabaseClient) {
        console.error('Supabase not initialized');
        document.getElementById('vaultGrid').innerHTML = '<p class="error">Error loading vault. Please refresh the page.</p>';
        return;
    }
    
    try {
        const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
        
        if (userError) {
            console.error('User error:', userError);
            throw userError;
        }
        
        if (!user) {
            console.log('No user found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        console.log('Current user:', user.email);
        
        const { data: items, error } = await window.supabaseClient
            .from('vault_items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Fetch error:', error);
            
            if (error.code === '42P01') {
                document.getElementById('vaultGrid').innerHTML = '<p class="error">Database table not found. Please create the vault_items table in Supabase.</p>';
            } else {
                document.getElementById('vaultGrid').innerHTML = '<p class="error">Error loading vault items: ' + error.message + '</p>';
            }
            return;
        }
        
        console.log('Fetched items:', items);
        displayVaultItems(items);
        
    } catch (error) {
        console.error('Error in loadVaultItems:', error);
        document.getElementById('vaultGrid').innerHTML = '<p class="error">Error loading vault items.</p>';
    }
}

// Display vault items with Edit and Delete buttons
function displayVaultItems(items) {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<p class="no-items">🔒 No passwords saved yet. Click "Add New Password" to get started.</p>';
        return;
    }
    
    grid.innerHTML = items.map(item => `
        <div class="vault-item" data-id="${item.id}">
            <div onclick='viewPassword(${JSON.stringify(item).replace(/'/g, "&apos;")})' style="cursor: pointer;">
                <h3>${item.website}</h3>
                <p><strong>Username:</strong> ${item.username}</p>
                <p><small>Added: ${new Date(item.created_at).toLocaleDateString('en-IN', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                })}</small></p>
            </div>
            <div class="item-actions">
                <button onclick='openEditModal(${JSON.stringify(item).replace(/'/g, "&apos;")})' class="btn-icon edit-btn" title="Edit">✏️</button>
                <button onclick='openDeleteModal(${JSON.stringify(item).replace(/'/g, "&apos;")})' class="btn-icon delete-btn" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Modal functions
function openAddModal() {
    console.log('Opening add modal');
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeAddModal() {
    console.log('Closing add modal');
    const modal = document.getElementById('addModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const form = document.getElementById('addPasswordForm');
    if (form) {
        form.reset();
    }
}

function openEditModal(item) {
    console.log('Opening edit modal for:', item.website);
    currentEditItem = item;
    
    document.getElementById('editId').value = item.id;
    document.getElementById('editWebsite').value = item.website;
    document.getElementById('editUsername').value = item.username;
    
    try {
        document.getElementById('editPassword').value = decrypt(item.encrypted_password);
    } catch (error) {
        console.error('Decryption error:', error);
        document.getElementById('editPassword').value = '';
    }
    
    document.getElementById('editModal').style.display = 'block';
    closeViewModal();
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditItem = null;
}

function viewPassword(item) {
    console.log('Viewing password for:', item.website);
    currentViewItem = item;
    
    document.getElementById('viewWebsite').textContent = item.website;
    document.getElementById('viewUsername').textContent = item.username;
    document.getElementById('viewPassword').textContent = '••••••••';
    document.getElementById('viewModal').style.display = 'block';
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
    currentViewItem = null;
}

function editFromView() {
    if (currentViewItem) {
        openEditModal(currentViewItem);
    }
}

function deleteFromView() {
    if (currentViewItem) {
        openDeleteModal(currentViewItem);
    }
}

function openDeleteModal(item) {
    console.log('Opening delete modal for:', item.website);
    itemToDelete = item;
    document.getElementById('deleteWebsite').textContent = item.website;
    document.getElementById('deleteModal').style.display = 'block';
    closeViewModal();
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    itemToDelete = null;
}

async function confirmDelete() {
    if (!itemToDelete) {
        closeDeleteModal();
        return;
    }
    
    if (!window.supabaseClient) {
        alert('Supabase not initialized!');
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('vault_items')
            .delete()
            .eq('id', itemToDelete.id);
        
        if (error) {
            alert('Error deleting password: ' + error.message);
            return;
        }
        
        alert('✅ Password deleted successfully!');
        closeDeleteModal();
        await loadVaultItems();
        
    } catch (error) {
        alert('❌ Something went wrong: ' + error.message);
    }
}

function togglePassword() {
    const passwordSpan = document.getElementById('viewPassword');
    if (passwordSpan.textContent === '••••••••') {
        try {
            passwordSpan.textContent = decrypt(currentViewItem.encrypted_password);
        } catch (error) {
            console.error('Decryption error:', error);
            alert('Error decrypting password');
        }
    } else {
        passwordSpan.textContent = '••••••••';
    }
}

function copyPassword() {
    try {
        const password = decrypt(currentViewItem.encrypted_password);
        navigator.clipboard.writeText(password);
        alert('✅ Password copied to clipboard!');
    } catch (error) {
        console.error('Copy error:', error);
        alert('Error copying password');
    }
}

// Search functionality
function searchPasswords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const items = document.querySelectorAll('.vault-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const addModal = document.getElementById('addModal');
    const viewModal = document.getElementById('viewModal');
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    
    if (event.target === addModal) {
        closeAddModal();
    }
    if (event.target === viewModal) {
        closeViewModal();
    }
    if (event.target === editModal) {
        closeEditModal();
    }
    if (event.target === deleteModal) {
        closeDeleteModal();
    }
}