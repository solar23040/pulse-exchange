const { v4: uuidv4 } = require('uuid');

class NewsGenerator {
  constructor() {
    this.newsHistory = [];
  }

  createNews({ title, body, ticker, sector, sentiment = 'neutral', source = 'system', isHostAction = false }) {
    const item = {
      id: uuidv4(),
      timestamp: Date.now(),
      title,
      body,
      ticker,
      sector,
      sentiment,
      source,
      isHostAction
    };

    this.newsHistory.unshift(item);
    if (this.newsHistory.length > 100) this.newsHistory.pop();

    return item;
  }

  getRecentNews(limit = 30) {
    return this.newsHistory.slice(0, limit);
  }

  generateMarketCommentary(ticks) {
    // Pick the most dramatic move in this tick if any
    const bigMover = ticks.find(t => Math.abs(t.changePercent) >= 2.5);
    if (!bigMover) return null;

    const isBull = bigMover.changePercent > 0;
    const headline = isBull
      ? `${bigMover.ticker} Surge: Up ${bigMover.changePercent}% on heavy volume`
      : `${bigMover.ticker} Plunge: Drops ${Math.abs(bigMover.changePercent)}% in fast market`;

    const body = isBull
      ? `Institutional buying pressure accelerates in ${bigMover.ticker} as price reaches ₹${bigMover.price}.`
      : `Selling pressure spikes in ${bigMover.ticker} with heavy liquidations recorded at ₹${bigMover.price}.`;

    return this.createNews({
      title: headline,
      body,
      ticker: bigMover.ticker,
      sentiment: isBull ? 'bullish' : 'bearish',
      source: 'engine'
    });
  }
}

module.exports = NewsGenerator;
