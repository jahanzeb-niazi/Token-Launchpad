// wizard.js
// Module-style file — make sure your HTML loads it as: <script type="module" src="wizard.js"></script>

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.11.1/dist/ethers.min.js";

/*
  IMPORTANT:
  Replace FACTORY_ADDRESS with your TokenFactory address deployed on Sepolia.
*/
const FACTORY_ADDRESS = "0x238E63cd611211E3B108Fcc357A6a536ca7E1855";

// ABI matching your TokenFactory.createERC20 signature and TokenCreated event
const FACTORY_ABI = [
    {
        "type": "function",
        "name": "createERC20",
        "inputs": [
            {
                "name": "name_",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "symbol_",
                "type": "string",
                "internalType": "string"
            },
            {
                "name": "initialSupply_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "decimals_",
                "type": "uint8",
                "internalType": "uint8"
            },
            {
                "name": "owner_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "mintable_",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "burnable_",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "pausable_",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "blacklistable_",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "whitelistable_",
                "type": "bool",
                "internalType": "bool"
            },
            {
                "name": "reflectionWallet_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "liquidityWallet_",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "txFeePercent_",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "burnShare_",
                "type": "uint8",
                "internalType": "uint8"
            },
            {
                "name": "liquidityShare_",
                "type": "uint8",
                "internalType": "uint8"
            },
            {
                "name": "reflectionShare_",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "deployedTokens",
        "inputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "address",
                "internalType": "address"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getDeployedTokens",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "TokenCreated",
        "inputs": [
            {
                "name": "tokenAddress",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "owner",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "name",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "symbol",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            }
        ],
        "anonymous": false
    }
];

// ------------------------------
// Keep original UI data & functions
// ------------------------------
let currentStep = 1;
const totalSteps = 5;
let tokenData = {
    tokenType: 'ERC20',
    chain: 'sepolia',
    name: '',
    symbol: '',
    supply: '',
    decimals: 18,
    mintable: false,
    logo: null,
    transactionFee: 5,
    feeSplit: {
        burn: 30,
        liquidity: 40,
        reflection: 30
    },
    features: {
        enableTransactionFee: false,
        enableBuyback: false,
        enableReflection: false,
        autoLiquidity: false,
        pausable: false,
        burnable: false,
        blacklistable: false,
        whitelistable: false,
        renounceOwnership: false
    },
    ownerWallet: ''
};

// Ethers objects (set on wallet connect)
let provider, signer, userAddress = null, factoryContract = null;

document.addEventListener('DOMContentLoaded', function () {
    initializeWizard();
    setupEventListeners();
    updatePreview();
});

// ---------- Initialization ----------
function initializeWizard() {
    showStep(currentStep);
    updateProgress();
}

// ---------- Event wiring (UI) ----------
function setupEventListeners() {
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('prevBtn').addEventListener('click', prevStep);
    document.getElementById('deployBtn').addEventListener('click', deployToken);

    document.querySelectorAll('input[name="tokenType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            tokenData.tokenType = e.target.value;
            updatePreview();
            toggleFieldsByTokenType();
        });
    });

    document.getElementById('chainSelect').addEventListener('change', (e) => {
        tokenData.chain = e.target.value;
        updateGasFee();
        updatePreview();
    });

    document.getElementById('tokenName').addEventListener('input', (e) => {
        tokenData.name = e.target.value;
        updatePreview();
    });

    document.getElementById('tokenSymbol').addEventListener('input', (e) => {
        tokenData.symbol = e.target.value.toUpperCase();
        e.target.value = tokenData.symbol;
        updatePreview();
    });

    document.getElementById('totalSupply').addEventListener('input', (e) => {
        tokenData.supply = e.target.value;
        updatePreview();
    });

    document.getElementById('decimals').addEventListener('input', (e) => {
        tokenData.decimals = parseInt(e.target.value) || 18;
        updatePreview();
    });

    document.getElementById('mintable').addEventListener('change', (e) => {
        tokenData.mintable = e.target.checked;
    });

    // File upload
    const fileUploadArea = document.getElementById('fileUploadArea');
    const logoUpload = document.getElementById('logoUpload');
    const removeImage = document.getElementById('removeImage');

    fileUploadArea.addEventListener('click', () => logoUpload.click());
    logoUpload.addEventListener('change', handleFileUpload);
    if (removeImage) {
        removeImage.addEventListener('click', (e) => {
            e.stopPropagation();
            clearImageUpload();
        });
    }

    // Fees toggles and sliders
    document.getElementById('enableTransactionFee').addEventListener('change', (e) => {
        tokenData.features.enableTransactionFee = e.target.checked;
        document.getElementById('feeConfiguration').style.display = e.target.checked ? 'block' : 'none';
        updateTransactionExample();
    });

    const sliders = ['transactionFee', 'burnFee', 'liquidityFee', 'reflectionFee'];
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(sliderId + 'Value');

        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            valueDisplay.textContent = value + '%';

            if (sliderId === 'transactionFee') {
                tokenData.transactionFee = parseFloat(value);
                updateTransactionExample();
            } else if (sliderId === 'burnFee') {
                tokenData.feeSplit.burn = parseFloat(value);
            } else if (sliderId === 'liquidityFee') {
                tokenData.feeSplit.liquidity = parseFloat(value);
            } else if (sliderId === 'reflectionFee') {
                tokenData.feeSplit.reflection = parseFloat(value);
            }

            if (sliderId !== 'transactionFee') updateFeeTotal();
        });
    });

    ['enableBuyback', 'enableReflection', 'autoLiquidity', 'pausable', 'burnable', 'blacklistable', 'whitelistable', 'renounceOwnership'].forEach(feature => {
        const checkbox = document.getElementById(feature);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                tokenData.features[feature] = e.target.checked;
            });
        }
    });

    document.getElementById('ownerWallet').addEventListener('input', (e) => {
        tokenData.ownerWallet = e.target.value;
    });

    // ----- Wallet connect: REPLACE the fake alert with real connect logic -----
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', async () => {
            try {
                if (!window.ethereum) {
                    alert('⚠️ MetaMask is required. Please install MetaMask.');
                    return;
                }

                // Request accounts (triggers MetaMask popup)
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                userAddress = await signer.getAddress();

                // Quick network check — Sepolia chainId = 11155111
                const network = await provider.getNetwork();
                if (network.chainId !== 11155111) {
                    alert('⚠️ Please switch MetaMask to Sepolia network (chainId 11155111).');
                    // still continue; user might switch manually
                }

                // store factory contract instance
                factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
                console.log("✅ TokenFactory connected at:", FACTORY_ADDRESS);

                connectWalletBtn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
                connectWalletBtn.classList.add('connected');

                // Autofill owner field if empty
                const ownerInput = document.getElementById('ownerWallet');
                if (ownerInput && !ownerInput.value) {
                    ownerInput.value = userAddress;
                    tokenData.ownerWallet = userAddress;
                }

                console.log('Connected wallet:', userAddress);

                // Optional: listen for account changes and update UI
                window.ethereum.on('accountsChanged', async (accounts) => {
                    if (!accounts || accounts.length === 0) {
                        userAddress = null;
                        connectWalletBtn.textContent = 'Connect Wallet';
                    } else {
                        userAddress = accounts[0];
                        connectWalletBtn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
                        // update owner input if it matches previous address
                        if (document.getElementById('ownerWallet').value === '') {
                            document.getElementById('ownerWallet').value = userAddress;
                            tokenData.ownerWallet = userAddress;
                        }
                    }
                });

            } catch (err) {
                console.error('Wallet connection failed', err);
                alert('❌ Wallet connection failed: ' + (err?.message || err));
            }
        });
    }
}

// ---------- File upload handlers ----------
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            tokenData.logo = event.target.result;
            document.querySelector('.upload-placeholder').style.display = 'none';
            document.getElementById('uploadPreview').style.display = 'block';
            document.getElementById('previewImage').src = event.target.result;
            document.getElementById('previewLogo').innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        };
        reader.readAsDataURL(file);
    }
}

function clearImageUpload() {
    tokenData.logo = null;
    document.querySelector('.upload-placeholder').style.display = 'block';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('logoUpload').value = '';
    document.getElementById('previewLogo').innerHTML = '<span>🪙</span>';
}

// ---------- UI helpers ----------
function toggleFieldsByTokenType() {
    const isERC20 = tokenData.tokenType === 'ERC20';
    const totalSupplyGroup = document.getElementById('totalSupplyGroup');
    const decimalsGroup = document.getElementById('decimalsGroup');
    if (totalSupplyGroup) totalSupplyGroup.style.display = isERC20 ? 'block' : 'none';
    if (decimalsGroup) decimalsGroup.style.display = isERC20 ? 'block' : 'none';
}

function updateGasFee() {
    const gasFees = {
        'ethereum': '$15.00',
        'bnb': '$2.50',
        'base': '$0.50',
        'arbitrum': '$1.00',
        'blast': '$0.75',
        'opbnb': '$0.25',
        'polygon': '$0.10',
        'avalanche': '$1.50',
        'sepolia': '$0.05'
    };
    const fee = gasFees[tokenData.chain] || '$0.05';
    const el = document.getElementById('gasFee');
    if (el) el.textContent = fee;
}

function updateFeeTotal() {
    const total = tokenData.feeSplit.burn + tokenData.feeSplit.liquidity + tokenData.feeSplit.reflection;
    const el = document.getElementById('feeTotal');
    if (el) el.textContent = total + '%';

    const warning = document.getElementById('feeWarning');
    if (warning) warning.style.display = (total !== 100) ? 'inline' : 'none';
}

function updateTransactionExample() {
    const amount = 1000;
    const fee = tokenData.features.enableTransactionFee ? (amount * tokenData.transactionFee / 100) : 0;
    const received = amount - fee;

    const feeEl = document.getElementById('txFeeExample');
    const recvEl = document.getElementById('txReceiveExample');
    if (feeEl) feeEl.textContent = fee.toFixed(2);
    if (recvEl) recvEl.textContent = received.toFixed(2);
}

function updatePreview() {
    const pn = document.getElementById('previewName');
    const ps = document.getElementById('previewSymbol');
    const pt = document.getElementById('previewType');
    const pc = document.getElementById('previewChain');
    const psupply = document.getElementById('previewSupply');

    if (pn) pn.textContent = tokenData.name || 'Your Token';
    if (ps) ps.textContent = tokenData.symbol || 'SYMBOL';
    if (pt) pt.textContent = tokenData.tokenType;
    if (pc) {
        const chainNames = { 'ethereum': 'ETH', 'bnb': 'BNB', 'base': 'BASE', 'arbitrum': 'ARB', 'blast': 'BLAST', 'opbnb': 'opBNB', 'polygon': 'MATIC', 'avalanche': 'AVAX', 'sepolia': 'SEPOLIA' };
        pc.textContent = chainNames[tokenData.chain] || tokenData.chain;
    }
    if (psupply) psupply.textContent = tokenData.supply ? parseInt(tokenData.supply).toLocaleString() : '-';
}

function updateReview() {
    document.getElementById('reviewTokenType').textContent = tokenData.tokenType;
    const chainNames = { 'ethereum': 'Ethereum Mainnet', 'bnb': 'BNB Smart Chain', 'base': 'Base', 'arbitrum': 'Arbitrum', 'blast': 'Blast', 'opbnb': 'opBNB', 'polygon': 'Polygon', 'avalanche': 'Avalanche', 'sepolia': 'Sepolia' };
    document.getElementById('reviewChain').textContent = chainNames[tokenData.chain] || tokenData.chain;
    document.getElementById('reviewName').textContent = tokenData.name || '-';
    document.getElementById('reviewSymbol').textContent = tokenData.symbol || '-';
    document.getElementById('reviewSupply').textContent = tokenData.supply ? parseInt(tokenData.supply).toLocaleString() : '-';
    document.getElementById('reviewDecimals').textContent = tokenData.decimals;

    const gasFee = document.getElementById('gasFee').textContent;
    document.getElementById('reviewGasFee').textContent = gasFee;
    document.getElementById('reviewTotalCost').textContent = gasFee;

    const featuresContainer = document.getElementById('reviewFeatures');
    const enabledFeatures = [];
    if (tokenData.mintable) enabledFeatures.push('Mintable');
    if (tokenData.features.enableTransactionFee) enabledFeatures.push(`Transaction Fee (${tokenData.transactionFee}%)`);
    if (tokenData.features.enableBuyback) enabledFeatures.push('Buyback & Burn');
    if (tokenData.features.enableReflection) enabledFeatures.push('Holder Reflections');
    if (tokenData.features.autoLiquidity) enabledFeatures.push('Auto-Liquidity');
    if (tokenData.features.pausable) enabledFeatures.push('Pausable');
    if (tokenData.features.burnable) enabledFeatures.push('Burnable');
    if (tokenData.features.blacklistable) enabledFeatures.push('Blacklist');
    if (tokenData.features.whitelistable) enabledFeatures.push('Whitelist');
    if (tokenData.features.renounceOwnership) enabledFeatures.push('Auto-Renounce Ownership');

    if (enabledFeatures.length === 0) {
        featuresContainer.innerHTML = '<p class="empty-state">No additional features enabled</p>';
    } else {
        featuresContainer.innerHTML = '<ul style="color: var(--text-secondary); line-height: 2;">' +
            enabledFeatures.map(f => `<li>✓ ${f}</li>`).join('') +
            '</ul>';
    }
}

// ---------- Validation & Steps (unchanged) ----------
function validateStep(step) {
    switch (step) {
        case 1:
            return true;
        case 2:
            const name = document.getElementById('tokenName').value.trim();
            const symbol = document.getElementById('tokenSymbol').value.trim();
            const supply = document.getElementById('totalSupply').value;

            if (!name) { alert('Please enter a token name'); return false; }
            if (!symbol || symbol.length < 2) { alert('Please enter a valid token symbol (2-8 characters)'); return false; }
            if (tokenData.tokenType === 'ERC20' && (!supply || supply <= 0)) { alert('Please enter a valid total supply'); return false; }
            return true;
        case 3:
            if (tokenData.features.enableTransactionFee) {
                const total = tokenData.feeSplit.burn + tokenData.feeSplit.liquidity + tokenData.feeSplit.reflection;
                if (total !== 100) { alert('Fee distribution must equal 100%'); return false; }
            }
            return true;
        case 4:
            const wallet = document.getElementById('ownerWallet').value.trim();
            if (!wallet) { alert('Please enter an owner wallet address'); return false; }
            if (!wallet.startsWith('0x') || wallet.length !== 42) { alert('Please enter a valid Ethereum address'); return false; }
            return true;
        case 5:
            return document.getElementById('acceptTerms').checked;
        default:
            return true;
    }
}

function showStep(step) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const deployBtn = document.getElementById('deployBtn');

    prevBtn.style.display = step === 1 ? 'none' : 'inline-block';
    nextBtn.style.display = step === totalSteps ? 'none' : 'inline-block';
    deployBtn.style.display = step === totalSteps ? 'inline-block' : 'none';

    if (step === totalSteps) updateReview();
}

function updateProgress() {
    const percentage = (currentStep / totalSteps) * 100;
    const pf = document.getElementById('progressFill');
    if (pf) pf.style.width = percentage + '%';
    const pt = document.getElementById('progressText');
    if (pt) pt.textContent = `Step ${currentStep} of ${totalSteps}`;
}

function nextStep() {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        updateProgress();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
        updateProgress();
    }
}

// ---------- Deploy logic (replaces simulateDeployment) ----------
function deployToken() {
    if (!validateStep(currentStep)) {
        alert('Please complete required fields / accept terms.');
        return;
    }

    // write latest ownerWallet to tokenData
    const ownerInputVal = document.getElementById('ownerWallet').value.trim();
    tokenData.ownerWallet = ownerInputVal || userAddress;

    // show modal
    const deploymentModal = document.getElementById('deploymentModal');
    if (deploymentModal) deploymentModal.classList.add('active');

    // call actual on-chain deploy
    simulateDeployment();
}

async function simulateDeployment() {
    // check wallet connection
    if (!signer || !userAddress) {
        alert("⚠️ Please connect your MetaMask wallet first (Sepolia).");
        document.getElementById('deploymentModal').classList.remove('active');
        return;
    }

    if (!FACTORY_ADDRESS || FACTORY_ADDRESS === "REPLACE_WITH_YOUR_SEPOLIA_FACTORY_ADDRESS") {
        alert("⚠️ FACTORY_ADDRESS not set. Replace FACTORY_ADDRESS constant with your Sepolia TokenFactory address in wizard.js.");
        document.getElementById('deploymentModal').classList.remove('active');
        return;
    }

    // write latest ownerWallet to tokenData
    const ownerInputVal = document.getElementById('ownerWallet').value.trim();
    tokenData.ownerWallet = ownerInputVal || userAddress;

    // parse supply safely
    let initialSupply;
    try {
        if (!tokenData.supply || isNaN(tokenData.supply) || Number(tokenData.supply) <= 0) {
            throw new Error("Supply must be > 0");
        }
        initialSupply = ethers.parseUnits(tokenData.supply.toString(), tokenData.decimals);
    } catch (err) {
        alert("Invalid total supply or decimals: " + err.message);
        document.getElementById('deploymentModal').classList.remove('active');
        return;
    }

    const decimals = parseInt(tokenData.decimals) || 18;
    const owner = tokenData.ownerWallet;
    const mintable = !!tokenData.mintable;
    const burnable = !!tokenData.features.burnable;
    const pausable = !!tokenData.features.pausable;
    const blacklistable = !!tokenData.features.blacklistable;
    const whitelistable = !!tokenData.features.whitelistable;
    const reflectionWallet = owner;
    const liquidityWallet = owner;

    // force integer tx fee percent
    const txFeePercent = tokenData.features.enableTransactionFee
        ? Math.floor(tokenData.transactionFee)
        : 0;

    const burnShare = Math.floor(tokenData.feeSplit.burn);
    const liquidityShare = Math.floor(tokenData.feeSplit.liquidity);
    const reflectionShare = Math.floor(tokenData.feeSplit.reflection);

    // validate fee distribution
    const totalFeeSplit = burnShare + liquidityShare + reflectionShare;
    if (totalFeeSplit !== 100 && tokenData.features.enableTransactionFee) {
        alert(`⚠️ Fee split must equal 100%. Current: ${totalFeeSplit}%`);
        document.getElementById('deploymentModal').classList.remove('active');
        return;
    }

    // instantiate factory contract if not yet
    if (!factoryContract) {
        factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    }

    console.log("Deploying ERC20 with params:", {
        name: tokenData.name,
        symbol: tokenData.symbol,
        initialSupply: initialSupply.toString(),
        decimals,
        owner,
        mintable,
        burnable,
        pausable,
        blacklistable,
        whitelistable,
        reflectionWallet,
        liquidityWallet,
        txFeePercent,
        burnShare,
        liquidityShare,
        reflectionShare
    });

    try {
        document.getElementById('deploymentStatusText').textContent = "⏳ Waiting for wallet confirmation...";

        const tx = await factoryContract.createERC20(
            tokenData.name,
            tokenData.symbol,
            initialSupply,
            decimals,
            owner,
            mintable,
            burnable,
            pausable,
            blacklistable,
            whitelistable,
            reflectionWallet,
            liquidityWallet,
            txFeePercent,
            burnShare,
            liquidityShare,
            reflectionShare,
            { gasLimit: 2_000_000 } // explicit gas limit to avoid estimation errors
        );

        console.log("Transaction sent:", tx.hash);
        document.getElementById('deploymentStatusText').textContent = "📡 Transaction sent. Waiting for confirmation...";

        const receipt = await tx.wait();
        console.log("Transaction receipt:", receipt);

        // parse TokenCreated event
        const parsedEvent = receipt.logs
            .map(log => {
                try { return factoryContract.interface.parseLog(log); } catch (e) { return null; }
            })
            .find(ev => ev && ev.name === "TokenCreated");

        const tokenAddress = parsedEvent ? parsedEvent.args.tokenAddress : null;

        if (tokenAddress) {
            showSuccess(tokenAddress);
        } else {
            console.warn("TokenCreated event not found. Using fallback address '0xUnknown'.");
            showSuccess("0xUnknown");
        }

    } catch (err) {
        console.error("Deployment error:", err);
        alert("❌ Deployment failed: " + (err?.message || err));
        document.getElementById('deploymentModal').classList.remove('active');
    }
}


// ---------- Success modal (updated to accept address) ----------
function showSuccess(contractAddress) {
    document.getElementById('deploymentModal').classList.remove('active');

    const successModal = document.getElementById('successModal');
    successModal.classList.add('active');

    document.getElementById('contractAddress').value = contractAddress;

    const copyBtn = document.querySelector('.copy-btn');
    if (copyBtn) {
        copyBtn.onclick = function () {
            const input = document.getElementById('contractAddress');
            input.select();
            document.execCommand('copy');
            this.textContent = 'Copied!';
            setTimeout(() => this.textContent = 'Copy', 2000);
        };
    }

    // Sepolia explorer link
    const explorerUrl = `https://sepolia.etherscan.io/address/${contractAddress}`;
    const viewBtn = document.getElementById('viewOnExplorer');
    if (viewBtn) {
        viewBtn.href = explorerUrl;
        viewBtn.target = '_blank';
    }
}

// initialize some UI values after load
updateTransactionExample();
updateFeeTotal();
updateGasFee();
