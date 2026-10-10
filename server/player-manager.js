const INITIAL_CASH = {
  retail: 1000000,
  bank: 100000000,
  host: 0
};

class PlayerManager {
  constructor() {
    this.players = new Map(); // id -> player object
    this.holdings = new Map(); // id -> Map(ticker -> { quantity, avgPrice })
    this.alerts = new Map(); // id -> Map(alertId -> alert object)
    this.equityCurves = new Map(); // id -> [{ time, value }]
    this.previousRanks = new Map(); // id -> previous rank
  }

  addPlayer({ id, name, role, firm }) {
    const initialCash = INITIAL_CASH[role] || 1000000;
    const player = {
      id,
      name,
      role,
      firm: role === 'bank' ? firm || 'Institutional Capital' : undefined,
      cash: initialCash,
      portfolioValue: 0,
      totalValue: initialCash,
      returnPercent: 0,
      rank: this.players.size + 1,
      joinedAt: Date.now(),
      initialCash
    };

    this.players.set(id, player);
    this.holdings.set(id, new Map());
    this.alerts.set(id, new Map());
    this.equityCurves.set(id, [{ time: Math.floor(Date.now() / 1000), value: initialCash }]);

    return player;
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  removePlayer(id) {
    this.players.delete(id);
    this.holdings.delete(id);
    this.alerts.delete(id);
    this.equityCurves.delete(id);
    this.previousRanks.delete(id);
  }

  getHoldings(playerId) {
    const playerHoldings = this.holdings.get(playerId);
    return playerHoldings ? Array.from(playerHoldings.values()) : [];
  }

  getHolding(playerId, ticker) {
    const playerHoldings = this.holdings.get(playerId);
    return playerHoldings ? playerHoldings.get(ticker) : undefined;
  }

  setHolding(playerId, ticker, quantity, avgPrice) {
    let playerHoldings = this.holdings.get(playerId);
    if (!playerHoldings) {
      playerHoldings = new Map();
      this.holdings.set(playerId, playerHoldings);
    }

    if (quantity <= 0) {
      playerHoldings.delete(ticker);
    } else {
      playerHoldings.set(ticker, { ticker, quantity, avgPrice });
    }
  }

  addAlert(playerId, alert) {
    let playerAlerts = this.alerts.get(playerId);
    if (!playerAlerts) {
      playerAlerts = new Map();
      this.alerts.set(playerId, playerAlerts);
    }
    playerAlerts.set(alert.id, alert);
  }

  removeAlert(playerId, alertId) {
    const playerAlerts = this.alerts.get(playerId);
    if (playerAlerts) {
      playerAlerts.delete(alertId);
    }
  }

  getAlerts(playerId) {
    const playerAlerts = this.alerts.get(playerId);
    return playerAlerts ? Array.from(playerAlerts.values()) : [];
  }

  getPortfolio(playerId, marketEngine) {
    const player = this.players.get(playerId);
    if (!player) return null;

    const playerHoldings = this.holdings.get(playerId) || new Map();
    let totalPositionValue = 0;
    let totalUnrealizedPnl = 0;
    const positions = [];

    for (const [ticker, h] of playerHoldings.entries()) {
      const stock = marketEngine.getStock(ticker);
      const currentPrice = stock ? stock.price : h.avgPrice;
      const positionValue = h.quantity * currentPrice;
      const costBasis = h.quantity * h.avgPrice;
      const pnl = positionValue - costBasis;
      const pnlPercent = costBasis > 0 ? Math.round((pnl / costBasis) * 10000) / 100 : 0;

      totalPositionValue += positionValue;
      totalUnrealizedPnl += pnl;

      positions.push({
        ticker,
        quantity: h.quantity,
        avgPrice: h.avgPrice,
        currentPrice,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent,
        value: Math.round(positionValue * 100) / 100,
        allocation: 0, // Calculated below
        side: 'long'
      });
    }

    const totalValue = player.cash + totalPositionValue;
    const totalPnl = totalValue - player.initialCash;

    // Calculate allocation %
    for (const pos of positions) {
      pos.allocation = totalValue > 0 ? Math.round((pos.value / totalValue) * 10000) / 100 : 0;
    }

    // Update player object cached properties
    player.portfolioValue = Math.round(totalPositionValue * 100) / 100;
    player.totalValue = Math.round(totalValue * 100) / 100;
    player.returnPercent = Math.round((totalPnl / player.initialCash) * 10000) / 100;

    // Update equity curve
    const curve = this.equityCurves.get(playerId) || [];
    curve.push({ time: Math.floor(Date.now() / 1000), value: player.totalValue });
    if (curve.length > 200) curve.shift();
    this.equityCurves.set(playerId, curve);

    return {
      cash: Math.round(player.cash * 100) / 100,
      positions,
      totalValue: Math.round(totalValue * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      realizedPnl: 0,
      unrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      peakValue: Math.max(...curve.map(c => c.value), totalValue),
      drawdown: 0,
      equityCurve: [...curve],
      deltaExposure: 1.0,
      gammaExposure: 0
    };
  }

  getLeaderboard() {
    const list = Array.from(this.players.values());

    // Sort by returnPercent descending
    list.sort((a, b) => b.returnPercent - a.returnPercent);

    return list.map((player, idx) => {
      const rank = idx + 1;
      const prevRank = this.previousRanks.get(player.id) || rank;
      this.previousRanks.set(player.id, rank);
      player.rank = rank;

      return {
        playerId: player.id,
        name: player.name,
        role: player.role,
        firm: player.firm,
        totalReturn: player.returnPercent,
        rank,
        previousRank: prevRank,
        totalValue: player.totalValue
      };
    });
  }
}

module.exports = PlayerManager;
