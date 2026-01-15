/**
 * Multiplayer - Handles Ably real-time communication with Spatial Partitioning (AOI)
 */

class Multiplayer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ably = null;
        this.presenceChannel = null;
        this.clientId = null;

        // Grid configuration
        this.cellSize = 400;
        this.currentCell = { x: -1, y: -1 };
        this.subscribedCells = new Map(); // name -> channel object

        // Callbacks
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onPlayerUpdate = null;
        this.onPlayerCountChange = null;

        this.connected = false;
        this.updateInterval = null;
    }

    async connect(playerData) {
        return new Promise((resolve, reject) => {
            try {
                this.clientId = playerData.id;
                this.ably = new Ably.Realtime({
                    key: this.apiKey,
                    clientId: this.clientId
                });

                this.ably.connection.on('connected', () => {
                    console.log('Connected to Ably');
                    this.connected = true;
                    this.setupPresence(playerData);
                    this.updatePosition(playerData); // This will trigger initial subscriptions
                    resolve();
                });

                this.ably.connection.on('failed', (err) => reject(err));
            } catch (err) {
                reject(err);
            }
        });
    }

    setupPresence(playerData) {
        // Presence is still global so we can count players, 
        // but we'll use it mostly for join/leave detection
        this.presenceChannel = this.ably.channels.get('game:presence');

        this.presenceChannel.presence.enter(playerData);

        this.presenceChannel.presence.subscribe('enter', (member) => {
            if (member.clientId !== this.clientId && this.onPlayerJoin) {
                this.onPlayerJoin(member.data);
            }
            this.updatePlayerCount();
        });

        this.presenceChannel.presence.subscribe('leave', (member) => {
            if (this.onPlayerLeave) this.onPlayerLeave(member.clientId);
            this.updatePlayerCount();
        });

        // Tournament State Channel (one global channel for high-level sync)
        this.tournamentChannel = this.ably.channels.get('game:tournament');

        this.tournamentChannel.subscribe('state', (msg) => {
            if (this.onTournamentUpdate) this.onTournamentUpdate(msg.data);
        });

        this.tournamentChannel.subscribe('coin_spawn', (msg) => {
            if (this.onCoinSpawn) this.onCoinSpawn(msg.data);
        });

        this.tournamentChannel.subscribe('coin_collected', (msg) => {
            if (this.onCoinRemoved) this.onCoinRemoved(msg.data);
        });

        this.tournamentChannel.subscribe('dash', (msg) => {
            if (msg.clientId !== this.clientId && this.onRemoteDash) {
                this.onRemoteDash(msg.clientId);
            }
        });

        this.tournamentChannel.subscribe('hit', (msg) => {
            if (this.onRemoteHit) this.onRemoteHit(msg.data); // { targetId, damage }
        });

        this.updatePlayerCount();
    }

    sendTournamentState(state) {
        if (this.connected) this.tournamentChannel.publish('state', state);
    }

    spawnCoin(coinData) {
        if (this.connected) this.tournamentChannel.publish('coin_spawn', coinData);
    }

    collectCoin(coinId) {
        if (this.connected) this.tournamentChannel.publish('coin_collected', coinId);
    }

    dash() {
        if (this.connected) this.tournamentChannel.publish('dash', {});
    }

    hit(targetId, damage) {
        if (this.connected) this.tournamentChannel.publish('hit', { targetId, damage });
    }

    updatePlayerCount() {
        if (!this.presenceChannel) return;
        this.presenceChannel.presence.get((err, members) => {
            if (!err && this.onPlayerCountChange) this.onPlayerCountChange(members.length);
        });
    }

    getCellCoords(x, y) {
        return {
            x: Math.floor(x / this.cellSize),
            y: Math.floor(y / this.cellSize)
        };
    }

    updatePosition(playerData) {
        if (!this.connected) return;

        const cell = this.getCellCoords(playerData.x, playerData.y);

        // Check if cell changed
        if (cell.x !== this.currentCell.x || cell.y !== this.currentCell.y) {
            this.handleCellChange(cell);
        }

        // Publish to current cell channel
        const channelName = `game:cell:${cell.x}:${cell.y}`;
        const channel = this.ably.channels.get(channelName);
        channel.publish('position', playerData);
    }

    handleCellChange(newCell) {
        console.log(`Entering cell ${newCell.x}:${newCell.y}`);
        this.currentCell = newCell;

        // Calculate 3x3 grid around new cell
        const neededCells = new Set();
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                neededCells.add(`game:cell:${newCell.x + dx}:${newCell.y + dy}`);
            }
        }

        // Unsubscribe from cells no longer needed
        for (const [name, channel] of this.subscribedCells) {
            if (!neededCells.has(name)) {
                console.log(`Unsubscribing from ${name}`);
                channel.unsubscribe();
                this.subscribedCells.delete(name);
            }
        }

        // Subscribe to new cells
        for (const name of neededCells) {
            if (!this.subscribedCells.has(name)) {
                console.log(`Subscribing to ${name}`);
                const channel = this.ably.channels.get(name);
                channel.subscribe('position', (msg) => {
                    if (msg.clientId !== this.clientId && this.onPlayerUpdate) {
                        this.onPlayerUpdate(msg.data);
                    }
                });
                this.subscribedCells.set(name, channel);
            }
        }
    }

    startPositionBroadcast(getPlayerState, intervalMs = 50) {
        if (this.updateInterval) clearInterval(this.updateInterval);

        let lastState = null;
        this.updateInterval = setInterval(() => {
            const state = getPlayerState();
            if (!state) return;

            if (!lastState ||
                Math.abs(state.x - lastState.x) > 1 ||
                Math.abs(state.y - lastState.y) > 1) {
                this.updatePosition(state);
                lastState = { ...state };
            }
        }, intervalMs);
    }

    disconnect() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        if (this.presenceChannel) this.presenceChannel.presence.leave();
        for (const channel of this.subscribedCells.values()) channel.unsubscribe();
        if (this.ably) this.ably.close();
        this.connected = false;
    }
}

window.Multiplayer = Multiplayer;
