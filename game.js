/**
 * Game Engine - Handles rendering and local player logic
 */

class Player {
    constructor(id, name, x, y, color) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.score = 0; // Tournament score
        this.color = color;
        this.size = 24;
        this.speed = 200; // pixels per second
    }

    // Smooth interpolation for remote players
    interpolate(dt) {
        const lerp = 0.15;
        this.x += (this.targetX - this.x) * lerp;
        this.y += (this.targetY - this.y) * lerp;
    }

    draw(ctx, isLocal = false) {
        // Shadow
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.size / 2 + 2, this.size / 2, this.size / 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Outline
        ctx.strokeStyle = isLocal ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = isLocal ? 3 : 2;
        ctx.stroke();

        // Eyes
        const eyeOffset = 5;
        const eyeSize = 4;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset, this.y - 2, eyeSize, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffset, this.y - 2, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset + 1, this.y - 1, eyeSize / 2, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffset + 1, this.y - 1, eyeSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Name tag
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const textWidth = ctx.measureText(this.name).width;
        const padding = 6;
        const tagY = this.y - this.size / 2 - 8;

        // Name background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(this.x - textWidth / 2 - padding, tagY - 14, textWidth + padding * 2, 18, 4);
        ctx.fill();

        // Name text
        ctx.fillStyle = isLocal ? '#a5b4fc' : '#fff';
        ctx.fillText(this.name, this.x, tagY);

        // Score display (if any)
        if (this.score > 0) {
            ctx.fillStyle = '#fca311';
            ctx.font = 'bold 10px Inter';
            ctx.fillText(`⭐ ${this.score}`, this.x, tagY - 18);
        }
    }
}

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // World dimensions (larger than viewport)
        this.width = 2400;
        this.height = 1800;

        // Viewport dimensions
        this.viewportWidth = 800;
        this.viewportHeight = 600;
        this.canvas.width = this.viewportWidth;
        this.canvas.height = this.viewportHeight;

        // Camera position
        this.cameraX = 0;
        this.cameraY = 0;

        this.players = new Map();
        this.coins = []; // {id, x, y}
        this.localPlayer = null;
        this.keys = {};
        this.lastTime = 0;
        this.running = false;
        this.showGrid = false; // For debugging AOI

        // Tournament state
        this.tournamentActive = false;
        this.onCoinCollected = null; // Callback for multiplayer sync

        // Decorations
        this.decorations = this.generateDecorations();

        this.setupInput();
    }

    generateDecorations() {
        const decorations = [];
        for (let i = 0; i < 150; i++) {
            decorations.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                type: Math.random() > 0.7 ? 'tree' : 'grass',
                size: 10 + Math.random() * 20
            });
        }
        return decorations.sort((a, b) => a.y - b.y);
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                this.keys[e.code] = true;
            }
            if (e.code === 'KeyG') this.showGrid = !this.showGrid;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    generatePlayerColor() {
        const colors = [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
            '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createLocalPlayer(name) {
        const id = this.generatePlayerId();
        const x = 100 + Math.random() * (this.width - 200);
        const y = 100 + Math.random() * (this.height - 200);
        const color = this.generatePlayerColor();

        this.localPlayer = new Player(id, name, x, y, color);
        this.players.set(id, this.localPlayer);

        return this.localPlayer;
    }

    addRemotePlayer(data) {
        if (data.id === this.localPlayer?.id) return;

        let player = this.players.get(data.id);
        if (!player) {
            player = new Player(data.id, data.name, data.x, data.y, data.color);
            this.players.set(data.id, player);
        } else {
            player.targetX = data.x;
            player.targetY = data.y;
            player.name = data.name;
            player.color = data.color;
        }
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    update(dt) {
        if (!this.localPlayer) return;

        // Handle local player movement
        let dx = 0, dy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

        const speed = this.localPlayer.speed * dt;
        this.localPlayer.x += dx * speed;
        this.localPlayer.y += dy * speed;

        // World Boundary collision
        const margin = this.localPlayer.size;
        this.localPlayer.x = Math.max(margin, Math.min(this.width - margin, this.localPlayer.x));
        this.localPlayer.y = Math.max(margin, Math.min(this.height - margin, this.localPlayer.y));

        // Coin collection
        if (this.tournamentActive) {
            for (let i = this.coins.length - 1; i >= 0; i--) {
                const coin = this.coins[i];
                const dist = Math.hypot(this.localPlayer.x - coin.x, this.localPlayer.y - coin.y);
                if (dist < 25) {
                    this.localPlayer.score++;
                    if (this.onCoinCollected) this.onCoinCollected(coin.id);
                    this.coins.splice(i, 1);
                }
            }
        }

        // Interpolate remote players
        for (const [id, player] of this.players) {
            if (id !== this.localPlayer.id) player.interpolate(dt);
        }

        // Update Camera to follow player
        this.cameraX = this.localPlayer.x - this.viewportWidth / 2;
        this.cameraY = this.localPlayer.y - this.viewportHeight / 2;

        // Clamp camera to world bounds
        this.cameraX = Math.max(0, Math.min(this.width - this.viewportWidth, this.cameraX));
        this.cameraY = Math.max(0, Math.min(this.height - this.viewportHeight, this.cameraY));
    }

    draw() {
        this.ctx.save();
        this.ctx.translate(-this.cameraX, -this.cameraY);

        // Clear canvas
        this.ctx.fillStyle = '#2d5a3d';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw ground pattern
        this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
        const gridSize = 100;
        for (let x = 0; x < this.width; x += gridSize) {
            for (let y = 0; y < this.height; y += gridSize) {
                if ((x + y) / gridSize % 2 < 1) this.ctx.fillRect(x, y, gridSize, gridSize);
            }
        }

        // Draw Coins
        if (this.tournamentActive) {
            for (const coin of this.coins) {
                this.ctx.fillStyle = '#fca311';
                this.ctx.beginPath();
                this.ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                // Inner "$"
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 8px Inter';
                this.ctx.textAlign = 'center'; // Ensure text is centered
                this.ctx.textBaseline = 'middle'; // Ensure text is vertically centered
                this.ctx.fillText('$', coin.x, coin.y + 1); // Adjusted Y for better visual centering
            }
        }

        // Draw AOI Debug Grid
        if (this.showGrid) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            this.ctx.lineWidth = 2;
            const cellSize = 400;
            for (let x = 0; x <= this.width; x += cellSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.height);
                this.ctx.stroke();
            }
            for (let y = 0; y <= this.height; y += cellSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.width, y);
                this.ctx.stroke();
            }
        }

        this.drawDecorations();

        const sortedPlayers = [...this.players.values()].sort((a, b) => a.y - b.y);
        for (const player of sortedPlayers) {
            player.draw(this.ctx, player === this.localPlayer);
        }

        this.ctx.restore();

        // UI Overlay (static)
        if (this.showGrid) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px monospace';
            this.ctx.fillText(`Pos: ${Math.round(this.localPlayer?.x)},${Math.round(this.localPlayer?.y)}`, 10, 20);
            this.ctx.fillText(`Cell: ${Math.floor(this.localPlayer?.x / 400)},${Math.floor(this.localPlayer?.y / 400)}`, 10, 40);
        }
    }

    gameLoop(currentTime) {
        if (!this.running) return;

        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    stop() {
        this.running = false;
    }

    getLocalPlayerState() {
        if (!this.localPlayer) return null;
        return {
            id: this.localPlayer.id,
            name: this.localPlayer.name,
            x: this.localPlayer.x,
            y: this.localPlayer.y,
            color: this.localPlayer.color,
            score: this.localPlayer.score
        };
    }
}

// Export for use in other modules
window.Game = Game;
window.Player = Player;
