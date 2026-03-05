// Use window.supabaseClient instead of supabase
let currentUser = null;
let currentViewItem = null;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Vault.js loaded');
    
    // Check if we're on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        loadVaultItems();
    }
    
    // Add password form handler - YAHAN FIX KIYA
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
                    .select(); // Add select to get the inserted data
                
                if (error) {
                    console.error('Insert error:', error);
                    
                    // Check if table exists
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
            
            // Check if table exists
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

// Display vault items
function displayVaultItems(items) {
    const grid = document.getElementById('vaultGrid');
    if (!grid) return;
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<p class="no-items">🔒 No passwords saved yet. Click "Add New Password" to get started.</p>';
        return;
    }
    
    grid.innerHTML = items.map(item => `
        <div class="vault-item" onclick='viewPassword(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
            <h3>${item.website}</h3>
            <p><strong>Username:</strong> ${item.username}</p>
            <p><small>Added: ${new Date(item.created_at).toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            })}</small></p>
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
    
    if (event.target === addModal) {
        closeAddModal();
    }
    if (event.target === viewModal) {
        closeViewModal();
    }
}