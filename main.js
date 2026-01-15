/**
 * Main - Initializes game and handles Solana Wallet Auth
 */

// ⚠️ IMPORTANT: Replace this with your Ably API key from https://ably.com
// Sign up for free - 6 million messages/month included!
const ABLY_API_KEY = 'YOUR_ABLY_API_KEY_HERE';

// DOM Elements
const nameModal = document.getElementById('nameModal');
const joinBtn = document.getElementById('joinBtn');
const playerCountEl = document.getElementById('playerCount');
const walletStatus = document.getElementById('walletStatus');

// Initialize game
const game = new Game('gameCanvas');
let multiplayer = null;

// Check if Ably key is configured
function isAblyConfigured() {
    return ABLY_API_KEY && ABLY_API_KEY !== 'YOUR_ABLY_API_KEY_HERE';
}

function truncateAddress(address) {
    if (!address) return '';
    return address.slice(0, 4) + '...' + address.slice(-4);
}

// Solana Wallet Connection
async function connectWallet() {
    try {
        const isPhantomInstalled = window.solana && window.solana.isPhantom;

        if (!window.solana) {
            walletStatus.textContent = 'Please install a Solana wallet like Phantom';
            return;
        }

        joinBtn.disabled = true;
        joinBtn.textContent = 'Connecting...';

        // Connect to wallet
        const resp = await window.solana.connect();
        const publicKey = resp.publicKey.toString();
        const shortName = truncateAddress(publicKey);

        console.log('Connected with Public Key:', publicKey);

        // Start Game
        joinGame(publicKey, shortName);

    } catch (err) {
        console.error('Wallet connection failed:', err);
        walletStatus.textContent = 'Connection failed. Please try again.';
        joinBtn.disabled = false;
        joinBtn.textContent = 'Connect Wallet';
    }
}

// Mode Selection Elements
const modeModal = document.getElementById('modeModal');
const paidModeBtn = document.getElementById('paidModeBtn');
const demoModeBtn = document.getElementById('demoModeBtn');
const backToModeBtn = document.getElementById('backToModeBtn');

let isDemoMode = false;

// Mode Handlers
demoModeBtn.addEventListener('click', () => {
    isDemoMode = true;
    modeModal.classList.add('hidden');
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 6);
    const guestName = 'Guest_' + guestId.split('_')[1];
    joinGame(guestId, guestName);
});

paidModeBtn.addEventListener('click', () => {
    isDemoMode = false;
    modeModal.classList.add('hidden');
    nameModal.classList.remove('hidden');
});

backToModeBtn.addEventListener('click', () => {
    nameModal.classList.add('hidden');
    modeModal.classList.remove('hidden');
});

const tournamentModal = document.getElementById('tournamentModal');
const tournamentTimer = document.getElementById('tournamentTimer');
const tournamentHUD = document.getElementById('tournamentHUD');
const prizePoolEl = document.getElementById('prizePool');
const leaderboardEl = document.getElementById('leaderboard');
const startTournamentBtn = document.getElementById('startTournamentBtn');
const skipTournamentBtn = document.getElementById('skipTournamentBtn');
const tournamentStatus = document.getElementById('tournamentStatus');

// Treasury address (Replace with your actual wallet for real testing!)
// For demo purposes, we'll just use a burner or the user's own address
let treasuryAddress = 'ENvbgE1i87X6uT6vG59P2U1NpkcM3cM7h98v9pP1qN77'; // Example

async function joinTournament() {
    try {
        if (isDemoMode) {
            // Simulated free entry for Demo
            tournamentActive = true;
            game.tournamentActive = true;
            tournamentModal.classList.add('hidden');
            tournamentHUD.classList.remove('hidden');
            return;
        }

        if (!window.solana) return;

        startTournamentBtn.disabled = true;
        startTournamentBtn.textContent = 'Processing...';
        tournamentStatus.textContent = 'Please approve the transaction in your wallet';

        const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'));
        const fromPubkey = window.solana.publicKey;

        // 0.1 SOL in Lamports
        const lamports = 0.1 * solanaWeb3.LAMPORTS_PER_SOL;

        // Create Transaction
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: fromPubkey,
                toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                lamports: lamports,
            })
        );

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        // Sign and Send
        const { signature } = await window.solana.signAndSendTransaction(transaction);
        await connection.confirmTransaction(signature);

        console.log('Transaction confirmed:', signature);

        // Start Tournament for this player
        game.tournamentActive = true;
        tournamentModal.classList.add('hidden');
        tournamentHUD.classList.remove('hidden');

        // Sync entry with others
        if (multiplayer) {
            game.prizePool += 0.1;
            multiplayer.sendTournamentState({
                prizePool: game.prizePool,
                // If round not started, start it
                roundStarted: true,
                timeLeft: 120
            });
        }

    } catch (err) {
        console.error('Tournament join failed:', err);
        tournamentStatus.textContent = 'Transaction failed. Devnet SOL required?';
        startTournamentBtn.disabled = false;
        startTournamentBtn.textContent = 'Pay 0.1 SOL & Join';
    }
}

async function joinGame(id, name) {
    // Create local player using wallet address as ID and short name as display name
    // We override generatePlayerId in game.js logic by passing ID directly if needed
    // But game.createLocalPlayer currently generates its own ID. Let's fix that.

    // Modification: Use public key as ID
    const player = game.createLocalPlayer(name);
    player.id = id; // Override generated ID with wallet address

    // Hide modal and start game
    nameModal.classList.add('hidden');
    game.start();

    // Show Tournament Invitation after a short delay
    setTimeout(() => {
        if (!game.tournamentActive) tournamentModal.classList.remove('hidden');
    }, 2000);

    // Connect to multiplayer
    if (isAblyConfigured()) {
        try {
            multiplayer = new Multiplayer(ABLY_API_KEY);

            multiplayer.onPlayerJoin = (data) => game.addRemotePlayer(data);
            multiplayer.onPlayerLeave = (id) => game.removePlayer(id);
            multiplayer.onPlayerUpdate = (data) => {
                game.addRemotePlayer(data);
                updateLeaderboard();
            };
            multiplayer.onPlayerCountChange = (count) => { playerCountEl.textContent = count; };

            // Tournament Sync
            multiplayer.onTournamentUpdate = (state) => {
                game.prizePool = state.prizePool;
                game.timer = state.timeLeft;
                game.tournamentActive = state.roundStarted;

                prizePoolEl.textContent = game.prizePool.toFixed(1);
                tournamentTimer.textContent = `Time Left: ${Math.floor(game.timer / 60)}:${(game.timer % 60).toString().padStart(2, '0')}`;

                if (game.tournamentActive) tournamentHUD.classList.remove('hidden');
            };

            multiplayer.onCoinSpawn = (coin) => {
                if (!game.coins.find(c => c.id === coin.id)) game.coins.push(coin);
            };

            multiplayer.onCoinRemoved = (coinId) => {
                game.coins = game.coins.filter(c => c.id !== coinId);
            };

            await multiplayer.connect(game.getLocalPlayerState());
            multiplayer.startPositionBroadcast(() => game.getLocalPlayerState(), 50);

            // Handle combat events from local game
            game.onPlayerDash = () => {
                if (multiplayer) multiplayer.dash();
            };

            game.onPlayerHit = (targetId, damage) => {
                if (multiplayer) multiplayer.hit(targetId, damage);
                // Also update local visual immediately
                game.handleHit(targetId, damage);
            };

            // Handle combat events from remote players
            multiplayer.onRemoteDash = (clientId) => {
                const p = game.players.get(clientId);
                if (p) {
                    p.isDashing = true;
                    p.dashTimer = 0.2;
                }
            };

            multiplayer.onRemoteHit = (data) => {
                // If I am the target, I take damage
                if (data.targetId === game.localPlayer.id) {
                    game.localPlayer.hp = Math.max(0, game.localPlayer.hp - data.damage);
                    if (game.localPlayer.hp <= 0) {
                        game.localPlayer.isAlive = false;
                        alert('💀 You have been eliminated!');
                    }
                } else {
                    // Otherwise, someone else hit someone else
                    game.handleHit(data.targetId, data.damage);
                }
            };

            // Handle coin collection broadcast
            game.onCoinCollected = (coinId) => multiplayer.collectCoin(coinId);

            // Timer Loop (Simple authoritative-ish timer)
            setInterval(() => {
                if (game.tournamentActive && game.timer > 0) {
                    game.timer--;
                    // Only one person (oldest?) should ideally sync the timer, 
                    // but for simplicity we'll just let the local player update their UI
                    tournamentTimer.textContent = `Time Left: ${Math.floor(game.timer / 60)}:${(game.timer % 60).toString().padStart(2, '0')}`;

                    // Coin Spawning (Randomly)
                    if (Math.random() > 0.95 && game.coins.length < 20) {
                        const newCoin = {
                            id: 'coin_' + Math.random().toString(36).substr(2, 9),
                            x: Math.random() * game.width,
                            y: Math.random() * game.height
                        };
                        multiplayer.spawnCoin(newCoin);
                    }
                } else if (game.timer === 0 && game.tournamentActive) {
                    endTournament();
                }
            }, 1000);

            console.log('Multiplayer connected with wallet:', id);
        } catch (err) {
            console.warn('Multiplayer failed, single-player mode active:', err);
        }
    } else {
        playerCountEl.textContent = '1';
    }
}

function updateLeaderboard() {
    const players = [...game.players.values()].sort((a, b) => b.score - a.score);
    leaderboardEl.innerHTML = players.map(p => `
        <div class="leader-item ${p.id === game.localPlayer.id ? 'local' : ''}">
            <span>${p.name}</span>
            <span>⭐ ${p.score}</span>
        </div>
    `).join('');
}

function endTournament() {
    game.tournamentActive = false;
    const players = [...game.players.values()];

    // Winner is the one with highest score OR last survivor
    const alivePlayers = players.filter(p => p.isAlive);
    const winner = alivePlayers.length === 1 ? alivePlayers[0] : players.sort((a, b) => b.score - a.score)[0];

    if (winner) {
        alert(`🏆 Tournament Over!\nWinner: ${winner.name}!\n${isDemoMode ? 'Demo Prize: Virtual Glory' : 'Prize Pool: ' + game.prizePool.toFixed(1) + ' SOL'}`);

        if (!isDemoMode && winner.id === game.localPlayer.id) {
            console.log('%c💰 CLAIM YOUR REWARD: Visit the smart contract to claim ' + game.prizePool.toFixed(1) + ' SOL', 'color: #4ade80; font-weight: bold;');
        }
    }

    // Reset players for next round
    players.forEach(p => {
        p.hp = 100;
        p.isAlive = true;
        p.score = 0;
    });

    // UI Reset
    game.timer = 0;
    game.coins = [];
    tournamentHUD.classList.add('hidden');
    setTimeout(() => tournamentModal.classList.remove('hidden'), 5000);
}

// Event listeners
joinBtn.addEventListener('click', connectWallet);
startTournamentBtn.addEventListener('click', joinTournament);
skipTournamentBtn.addEventListener('click', () => tournamentModal.classList.add('hidden'));

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (multiplayer) {
        multiplayer.disconnect();
    }
});

// Show helpful message
if (!isAblyConfigured()) {
    console.log('%c🎮 Simple MMO - Solana Edition', 'font-size: 16px; font-weight: bold;');
    console.log('Running in single-player mode. Add Ably key to enabling persistent world.');
}
