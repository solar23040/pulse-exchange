const { v4: uuidv4 } = require('uuid');

class OrderEngine {
  constructor(playerManager, marketEngine) {
    this.playerManager = playerManager;
    this.marketEngine = marketEngine;
    this.pendingOrders = []; // list of limit/stop orders
  }

  processOrder({ playerId, ticker, side, orderType, quantity, price }) {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) throw new Error('Player not found');

    const stock = this.marketEngine.getStock(ticker);
    if (!stock) throw new Error(`Invalid stock ticker: ${ticker}`);

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Quantity must be a positive integer');
    }

    if (orderType === 'market') {
      return this._executeMarketOrder(player, stock, side, quantity);
    } else if (orderType === 'limit' || orderType === 'stop') {
      if (!price || price <= 0) {
        throw new Error(`${orderType.toUpperCase()} order requires a valid target price`);
      }
      return this._placePendingOrder(player, stock, side, orderType, quantity, price);
    } else {
      throw new Error(`Unsupported order type: ${orderType}`);
    }
  }

  _executeMarketOrder(player, stock, side, quantity) {
    const executionPrice = stock.price;
    const totalCost = executionPrice * quantity;

    if (side === 'buy') {
      if (player.cash < totalCost) {
        throw new Error(`Insufficient cash! Required: ₹${totalCost.toLocaleString('en-IN')}, Available: ₹${player.cash.toLocaleString('en-IN')}`);
      }

      // Deduct cash
      player.cash -= totalCost;

      // Update position
      const holding = this.playerManager.getHolding(player.id, stock.ticker);
      if (holding) {
        const totalQty = holding.quantity + quantity;
        const totalSpent = (holding.quantity * holding.avgPrice) + totalCost;
        const newAvg = Math.round((totalSpent / totalQty) * 100) / 100;
        this.playerManager.setHolding(player.id, stock.ticker, totalQty, newAvg);
      } else {
        this.playerManager.setHolding(player.id, stock.ticker, quantity, executionPrice);
      }
    } else if (side === 'sell') {
      const holding = this.playerManager.getHolding(player.id, stock.ticker);
      if (!holding || holding.quantity < quantity) {
        const avail = holding ? holding.quantity : 0;
        throw new Error(`Insufficient shares! Required: ${quantity}, Available: ${avail}`);
      }

      // Add cash
      player.cash += totalCost;

      // Update position
      const remainingQty = holding.quantity - quantity;
      this.playerManager.setHolding(player.id, stock.ticker, remainingQty, holding.avgPrice);
    }

    return {
      id: uuidv4(),
      ticker: stock.ticker,
      side,
      type: 'market',
      quantity,
      price: executionPrice,
      filledPrice: executionPrice,
      status: 'filled',
      timestamp: Date.now(),
      playerId: player.id,
      filledAt: Date.now()
    };
  }

  _placePendingOrder(player, stock, side, orderType, quantity, price) {
    // Validate balance/holding reserve before placing order
    if (side === 'buy') {
      const totalCost = price * quantity;
      if (player.cash < totalCost) {
        throw new Error(`Insufficient cash for pending order! Required: ₹${totalCost.toLocaleString('en-IN')}`);
      }
    } else if (side === 'sell') {
      const holding = this.playerManager.getHolding(player.id, stock.ticker);
      if (!holding || holding.quantity < quantity) {
        const avail = holding ? holding.quantity : 0;
        throw new Error(`Insufficient shares for pending sell order! Required: ${quantity}, Avail: ${avail}`);
      }
    }

    const order = {
      id: uuidv4(),
      ticker: stock.ticker,
      side,
      type: orderType,
      quantity,
      price,
      status: 'pending',
      timestamp: Date.now(),
      playerId: player.id
    };

    this.pendingOrders.push(order);
    return order;
  }

  cancelOrder(orderId, playerId) {
    const idx = this.pendingOrders.findIndex(o => o.id === orderId && o.playerId === playerId);
    if (idx === -1) {
      throw new Error('Pending order not found');
    }
    const cancelled = this.pendingOrders.splice(idx, 1)[0];
    cancelled.status = 'cancelled';
    return cancelled;
  }

  evaluatePendingOrdersOnTick() {
    const filledOrders = [];
    const remaining = [];

    for (const order of this.pendingOrders) {
      const stock = this.marketEngine.getStock(order.ticker);
      const player = this.playerManager.getPlayer(order.playerId);

      if (!stock || !player) {
        // Player disconnected or stock invalid, discard order
        continue;
      }

      let shouldFill = false;

      if (order.type === 'limit') {
        if (order.side === 'buy' && stock.price <= order.price) shouldFill = true;
        if (order.side === 'sell' && stock.price >= order.price) shouldFill = true;
      } else if (order.type === 'stop') {
        if (order.side === 'buy' && stock.price >= order.price) shouldFill = true;
        if (order.side === 'sell' && stock.price <= order.price) shouldFill = true;
      }

      if (shouldFill) {
        try {
          const filled = this._executeMarketOrder(player, stock, order.side, order.quantity);
          filled.id = order.id; // Keep original order id
          filled.type = order.type;
          filled.price = order.price;
          filledOrders.push(filled);
        } catch (err) {
          // If execution failed (e.g. cash ran out), discard or keep pending
          order.status = 'rejected';
        }
      } else {
        remaining.push(order);
      }
    }

    this.pendingOrders = remaining;
    return filledOrders;
  }
}

module.exports = OrderEngine;
