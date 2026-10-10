const { COMPANY_LIST, SECTOR_INDEX_NAMES } = require('./companies');

class MarketEngine {
  constructor() {
    this.simSpeed = 1;
    this.isPaused = false;
    this.marketMood = 50; // 0 (extreme fear) to 100 (extreme greed)
    this.stocks = new Map();
    this.sectorTrends = {
      TECH: 0,
      PHARMA: 0,
      BANK: 0,
      ENERGY: 0,
      CONSUMER: 0,
      INFRA: 0
    };

    this._initStocks();
  }

  _initStocks() {
    const now = Date.now();
    for (const company of COMPANY_LIST) {
      const price = company.basePrice;
      const history = [];
      // Generate initial 20 historical prices for sparkline / chart
      let p = price;
      for (let i = 20; i >= 0; i--) {
        const change = (Math.random() - 0.49) * 0.01 * p;
        p = Math.max(1, Math.round((p + change) * 100) / 100);
        history.push(p);
      }

      this.stocks.set(company.ticker, {
        ...company,
        price,
        open: history[0],
        high: Math.max(...history),
        low: Math.min(...history),
        close: price,
        prevPrice: history[history.length - 2] || price,
        change: Math.round((price - history[0]) * 100) / 100,
        changePercent: Math.round(((price - history[0]) / history[0]) * 10000) / 100,
        volume: Math.floor(Math.random() * 50000) + 10000,
        sparklineData: history.slice(-20),
        history: history.map((val, idx) => ({
          time: Math.floor((now - (20 - idx) * 5000) / 1000),
          open: val,
          high: val * 1.002,
          low: val * 0.998,
          close: val,
          volume: Math.floor(Math.random() * 2000) + 500
        }))
      });
    }
  }

  tick() {
    if (this.isPaused) return null;

    const tickTime = Math.floor(Date.now() / 1000);
    const updatedTicks = [];

    // Market-wide sentiment drift (-0.2% to +0.2%)
    const marketDrift = (Math.random() - 0.49) * 0.003 * (this.marketMood / 50);

    // Update sector trends slightly
    for (const sector in this.sectorTrends) {
      this.sectorTrends[sector] += (Math.random() - 0.5) * 0.002;
      this.sectorTrends[sector] = Math.max(-0.05, Math.min(0.05, this.sectorTrends[sector]));
    }

    let totalVal = 0;
    let baseVal = 0;

    for (const [ticker, stock] of this.stocks.entries()) {
      const volMultiplier = stock.volatility === 'very-high' ? 2.2 :
                            stock.volatility === 'high' ? 1.6 :
                            stock.volatility === 'medium' ? 1.0 : 0.6;

      const sectorDrift = this.sectorTrends[stock.sector] || 0;
      const stockNoise = (Math.random() - 0.495) * 0.006 * stock.beta * volMultiplier * this.simSpeed;

      const totalReturn = marketDrift + sectorDrift + stockNoise;
      const priceDelta = stock.price * totalReturn;

      let newPrice = Math.max(1, Math.round((stock.price + priceDelta) * 100) / 100);
      const change = Math.round((newPrice - stock.open) * 100) / 100;
      const changePercent = Math.round((change / stock.open) * 10000) / 100;
      const tickVol = Math.floor(Math.random() * 500 * volMultiplier) + 10;

      stock.prevPrice = stock.price;
      stock.price = newPrice;
      stock.high = Math.max(stock.high, newPrice);
      stock.low = Math.min(stock.low, newPrice);
      stock.change = change;
      stock.changePercent = changePercent;
      stock.volume += tickVol;

      stock.sparklineData.push(newPrice);
      if (stock.sparklineData.length > 30) stock.sparklineData.shift();

      stock.history.push({
        time: tickTime,
        open: stock.prevPrice,
        high: Math.max(stock.prevPrice, newPrice),
        low: Math.min(stock.prevPrice, newPrice),
        close: newPrice,
        volume: tickVol
      });
      if (stock.history.length > 500) stock.history.shift();

      updatedTicks.push({
        ticker: stock.ticker,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
        high: stock.high,
        low: stock.low,
        open: stock.open,
        sparklineData: [...stock.sparklineData]
      });

      totalVal += newPrice;
      baseVal += stock.basePrice;
    }

    // Update overall mood randomly
    this.marketMood = Math.max(10, Math.min(90, this.marketMood + (Math.random() - 0.5) * 2));

    const indices = this.getIndices();
    const px24 = Math.round((totalVal / baseVal) * 10000) / 100;

    return {
      ticks: updatedTicks,
      indices,
      px24,
      mood: Math.round(this.marketMood)
    };
  }

  getIndices() {
    const sectorSums = {};
    const sectorBases = {};

    for (const stock of this.stocks.values()) {
      if (!sectorSums[stock.sector]) {
        sectorSums[stock.sector] = 0;
        sectorBases[stock.sector] = 0;
      }
      sectorSums[stock.sector] += stock.price;
      sectorBases[stock.sector] += stock.open;
    }

    return Object.keys(SECTOR_INDEX_NAMES).map(sector => {
      const current = sectorSums[sector] || 1;
      const base = sectorBases[sector] || 1;
      const change = current - base;
      const changePercent = Math.round((change / base) * 10000) / 100;

      return {
        sector,
        name: SECTOR_INDEX_NAMES[sector],
        value: Math.round(current * 10) / 10,
        change: Math.round(change * 10) / 10,
        changePercent
      };
    });
  }

  getStock(ticker) {
    return this.stocks.get(ticker);
  }

  getAllStocks() {
    return Array.from(this.stocks.values());
  }

  applyHostAction(action) {
    let message = '';
    switch (action.action) {
      case 'set-price': {
        const stock = this.stocks.get(action.ticker);
        if (stock && typeof action.price === 'number') {
          stock.prevPrice = stock.price;
          stock.price = action.price;
          stock.change = Math.round((stock.price - stock.open) * 100) / 100;
          stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
          message = `Price for ${stock.ticker} manually set to ₹${action.price}`;
        }
        break;
      }

      case 'shock-stock': {
        const stock = this.stocks.get(action.ticker);
        if (stock && typeof action.percent === 'number') {
          const factor = 1 + action.percent / 100;
          stock.prevPrice = stock.price;
          stock.price = Math.max(1, Math.round(stock.price * factor * 100) / 100);
          stock.high = Math.max(stock.high, stock.price);
          stock.low = Math.min(stock.low, stock.price);
          stock.change = Math.round((stock.price - stock.open) * 100) / 100;
          stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
          message = `SHOCK: ${stock.ticker} experienced a ${action.percent}% movement!`;
        }
        break;
      }

      case 'shock-sector': {
        const factor = 1 + action.percent / 100;
        for (const stock of this.stocks.values()) {
          if (stock.sector === action.sector) {
            stock.prevPrice = stock.price;
            stock.price = Math.max(1, Math.round(stock.price * factor * 100) / 100);
            stock.high = Math.max(stock.high, stock.price);
            stock.low = Math.min(stock.low, stock.price);
            stock.change = Math.round((stock.price - stock.open) * 100) / 100;
            stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
          }
        }
        message = `SECTOR SHOCK: ${action.sector} sector moved by ${action.percent}%!`;
        break;
      }

      case 'bull-run': {
        this.marketMood = 85;
        for (const stock of this.stocks.values()) {
          stock.price = Math.round(stock.price * 1.08 * 100) / 100;
          stock.change = Math.round((stock.price - stock.open) * 100) / 100;
          stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
        }
        message = `BULL RUN TRIGGERED: Market sentiment shifted to Extreme Greed!`;
        break;
      }

      case 'black-swan': {
        this.marketMood = 15;
        for (const stock of this.stocks.values()) {
          stock.price = Math.max(1, Math.round(stock.price * 0.85 * 100) / 100);
          stock.change = Math.round((stock.price - stock.open) * 100) / 100;
          stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
        }
        message = `BLACK SWAN EVENT: Market crashed by 15%!`;
        break;
      }

      case 'pause':
        this.isPaused = true;
        message = `Market trading paused by Host.`;
        break;

      case 'resume':
        this.isPaused = false;
        message = `Market trading resumed.`;
        break;

      case 'set-speed':
        this.simSpeed = Math.max(0.5, Math.min(10, action.speed || 1));
        message = `Simulation speed set to ${this.simSpeed}x`;
        break;

      case 'reset':
        this._initStocks();
        this.isPaused = false;
        this.simSpeed = 1;
        this.marketMood = 50;
        message = `Market reset to default state.`;
        break;

      default:
        message = `Host action ${action.action} executed.`;
    }
    return message;
  }
}

module.exports = MarketEngine;
