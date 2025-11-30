

const walletModal = document.getElementById('walletModal');
const connectWalletBtn = document.getElementById('connectWallet');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navLinks = document.querySelector('.nav-links');

// === 1. Open wallet modal ===
if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', function () {
        if (walletModal) {
            walletModal.classList.add('active');
        }
    });
}

// === 2. Close wallet modal ===
if (walletModal) {
    const closeBtn = walletModal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            walletModal.classList.remove('active');
        });
    }

    walletModal.addEventListener('click', function (e) {
        if (e.target === walletModal) {
            walletModal.classList.remove('active');
        }
    });

    // === 3. Wallet option clicks ===
    const walletOptions = walletModal.querySelectorAll('.wallet-option');
    walletOptions.forEach(option => {
        option.addEventListener('click', async function () {
            const walletName = this.querySelector('span:last-child').textContent.trim();
            walletModal.classList.remove('active');

            if (walletName.toLowerCase().includes('metamask')) {
                await connectMetaMask();
            } else {
                alert(`❌ ${walletName} connection not supported yet.`);
            }
        });
    });
}

// === 4. Mobile menu toggle ===
if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', function () {
        navLinks.classList.toggle('active');
    });
}

// === 5. MetaMask connection ===
async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        alert('⚠️ MetaMask not detected. Please install MetaMask first.');
        return;
    }

    try {
        // 👉 This triggers the official MetaMask popup
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];

        // Show short address like 0x12AB...C45D
        const shortAddr = `${account.slice(0, 6)}...${account.slice(-4)}`;
        connectWalletBtn.textContent = shortAddr;
        connectWalletBtn.classList.add('connected');

        // Log and alert success
        console.log('Connected to MetaMask:', account);
        alert(`✅ Connected:\n${account}`);

        // Handle account changes dynamically
        window.ethereum.on('accountsChanged', (newAccounts) => {
            if (newAccounts.length > 0) {
                const newAccount = newAccounts[0];
                connectWalletBtn.textContent = `${newAccount.slice(0, 6)}...${newAccount.slice(-4)}`;
            } else {
                connectWalletBtn.textContent = 'Connect Wallet';
            }
        });
    } catch (error) {
        if (error.code === 4001) {
            alert('❌ Connection rejected by user.');
        } else {
            console.error(error);
            alert('⚠️ Something went wrong. Please try again.');
        }
    }
}
