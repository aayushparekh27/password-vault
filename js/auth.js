// Wait for everything to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, Supabase exists:', !!window.supabaseClient);
    
    // Register form handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Use window.supabaseClient instead of supabase
            if (!window.supabaseClient) {
                alert('Supabase not initialized! Please refresh the page.');
                console.error('Supabase client is undefined');
                return;
            }
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Validation
            if (password !== confirmPassword) {
                alert('❌ Passwords do not match!');
                return;
            }
            
            if (password.length < 6) {
                alert('❌ Password must be at least 6 characters!');
                return;
            }
            
            console.log('Attempting registration for:', email);
            console.log('Supabase client:', window.supabaseClient);
            
            try {
                // Use window.supabaseClient here
                const { data, error } = await window.supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                });
                
                if (error) {
                    console.error('Registration error:', error);
                    alert('❌ Error: ' + error.message);
                    return;
                }
                
                console.log('Registration success:', data);
                
                if (data.user) {
                    alert('✅ Registration successful! Please check your email to confirm.');
                    window.location.href = 'login.html';
                }
                
            } catch (error) {
                console.error('Unexpected error:', error);
                alert('❌ Something went wrong: ' + error.message);
            }
        });
    }
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!window.supabaseClient) {
                alert('Supabase not initialized!');
                return;
            }
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    alert('❌ ' + error.message);
                    return;
                }
                
                console.log('Login success:', data);
                alert('✅ Login successful!');
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                alert('❌ ' + error.message);
            }
        });
    }
});

// Logout function
async function logout() {
    if (!window.supabaseClient) {
        alert('Supabase not initialized!');
        return;
    }
    
    try {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
}