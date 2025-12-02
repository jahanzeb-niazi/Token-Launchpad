/* auth.js
   Simple client-side auth using localStorage.
   - Users stored in localStorage key: "haj_users" (array)
   - Current logged-in username stored in: "haj_currentUser"
   - Passwords hashed with SHA-256 before storage
*/

(function () {
    // Utilities
    function toHex(buffer) {
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hashPassword(password) {
        const enc = new TextEncoder();
        const data = enc.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return toHex(hashBuffer);
    }

    function loadUsers() {
        try {
            return JSON.parse(localStorage.getItem('haj_users') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveUsers(users) {
        localStorage.setItem('haj_users', JSON.stringify(users));
    }

    function setCurrentUser(username) {
        localStorage.setItem('haj_currentUser', username);
        updateAuthUI();
    }

    function clearCurrentUser() {
        localStorage.removeItem('haj_currentUser');
        updateAuthUI();
    }

    function getCurrentUser() {
        return localStorage.getItem('haj_currentUser') || null;
    }

    // Public API functions (exposed on window)
    window.signup = async function ({ username, email, password }) {
        username = (username || '').trim();
        email = (email || '').trim().toLowerCase();
        password = (password || '');

        if (!username || !email || !password) {
            throw new Error('Please fill all fields.');
        }
        const users = loadUsers();
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Username already taken.');
        }
        if (users.find(u => u.email === email)) {
            throw new Error('Email already registered.');
        }

        const passHash = await hashPassword(password);
        users.push({ username, email, passHash, createdAt: new Date().toISOString() });
        saveUsers(users);
        setCurrentUser(username);
        return { username, email };
    };

    window.login = async function ({ identifier, password }) {
        identifier = (identifier || '').trim();
        password = (password || '');
        if (!identifier || !password) {
            throw new Error('Please fill all fields.');
        }
        const users = loadUsers();
        const idLower = identifier.toLowerCase();
        const user = users.find(u => u.username.toLowerCase() === idLower || u.email === idLower);
        if (!user) throw new Error('User not found.');

        const passHash = await hashPassword(password);
        if (passHash !== user.passHash) throw new Error('Incorrect password.');

        setCurrentUser(user.username);
        return { username: user.username, email: user.email };
    };

    window.logout = function () {
        clearCurrentUser();
        // if there is a query next param, don't redirect automatically. Page JS can handle UI.
        // But redirect to home if currently on create-token (to be safe)
        if (location.pathname.endsWith('/create-token.html') || location.pathname.endsWith('create-token.html')) {
            location.href = 'index.html';
        } else {
            updateAuthUI();
        }
    };

    // Require auth — redirects to login page with next=returnUrl if not logged in
    window.requireAuth = function (returnUrl) {
        const cur = getCurrentUser();
        if (!cur) {
            const next = encodeURIComponent(returnUrl || location.pathname);
            location.href = `login.html?next=${next}`;
            return false;
        }
        return true;
    };

    // Update navbar UI: find element with id="authButtons" and populate based on login state
    window.updateAuthUI = function () {
        const container = document.getElementById('authButtons');
        if (!container) return;
        const cur = getCurrentUser();
        container.innerHTML = '';

        // Keep Connect Wallet button in DOM (your pages already have them). We only add login/signup UI here.
        if (!cur) {
            // Logged out: show Login / Signup buttons
            const loginBtn = document.createElement('button');
            loginBtn.className = 'btn-outline';
            loginBtn.textContent = 'Login';
            loginBtn.onclick = () => location.href = 'login.html';

            const signupBtn = document.createElement('button');
            signupBtn.className = 'btn-primary';
            signupBtn.style.marginLeft = '8px';
            signupBtn.textContent = 'Signup';
            signupBtn.onclick = () => location.href = 'signup.html';

            container.appendChild(loginBtn);
            container.appendChild(signupBtn);
        } else {
            // Logged in: show welcome + Logout
            const welcome = document.createElement('span');
            welcome.style.marginRight = '10px';
            welcome.style.fontWeight = '600';
            welcome.textContent = `Welcome, ${cur}`;

            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'btn-outline';
            logoutBtn.textContent = 'Logout';
            logoutBtn.onclick = () => {
                logout();
            };

            container.appendChild(welcome);
            container.appendChild(logoutBtn);
        }
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        updateAuthUI();
    });

})();
