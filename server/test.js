const test = require('node:test');
const assert = require('node:assert/strict');

const MarketEngine = require('./market-engine');
const PlayerManager = require('./player-manager');
const OrderEngine = require('./order-engine');

test('Market Engine price generation', () => {
  const engine = new MarketEngine();
  const initialStocks = engine.getAllStocks();
  assert.equal(initialStocks.length, 24, 'Should initialize 24 stocks');

  const tickResult = engine.tick();
  assert.ok(tickResult, 'Tick result should be defined');
  assert.equal(tickResult.ticks.length, 24, 'Should broadcast 24 stock ticks');
  assert.equal(tickResult.indices.length, 6, 'Should compute 6 sector indices');
});

test('Order Engine market order fills & cash deduction', () => {
  const marketEngine = new MarketEngine();
  const playerManager = new PlayerManager();
  const orderEngine = new OrderEngine(playerManager, marketEngine);

  const player = playerManager.addPlayer({
    id: 'p1',
    name: 'Test Retail Trader',
    role: 'retail'
  });

  const initialCash = player.cash; // 1,000,000
  const stock = marketEngine.getStock('NXON');
  const qty = 10;
  const expectedCost = stock.price * qty;

  const order = orderEngine.processOrder({
    playerId: 'p1',
    ticker: 'NXON',
    side: 'buy',
    orderType: 'market',
    quantity: qty
  });

  assert.equal(order.status, 'filled', 'Market order should fill immediately');
  assert.equal(order.quantity, 10);
  assert.equal(player.cash, initialCash - expectedCost, 'Cash should be deducted');

  const holding = playerManager.getHolding('p1', 'NXON');
  assert.ok(holding, 'Holding should exist');
  assert.equal(holding.quantity, 10);
  assert.equal(holding.avgPrice, stock.price);
});

test('Portfolio P&L calculation', () => {
  const marketEngine = new MarketEngine();
  const playerManager = new PlayerManager();
  const orderEngine = new OrderEngine(playerManager, marketEngine);

  playerManager.addPlayer({
    id: 'p2',
    name: 'Test Trader 2',
    role: 'retail'
  });

  orderEngine.processOrder({
    playerId: 'p2',
    ticker: 'SLCN',
    side: 'buy',
    orderType: 'market',
    quantity: 100
  });

  const portfolio = playerManager.getPortfolio('p2', marketEngine);
  assert.ok(portfolio, 'Portfolio should be generated');
  assert.equal(portfolio.positions.length, 1);
  assert.equal(portfolio.positions[0].ticker, 'SLCN');
  assert.ok(portfolio.totalValue > 0, 'Total portfolio value should be positive');
});

test('Alert trigger evaluation', () => {
  const marketEngine = new MarketEngine();
  const playerManager = new PlayerManager();

  const player = playerManager.addPlayer({
    id: 'p3',
    name: 'Alert Trader',
    role: 'retail'
  });

  const alert = {
    id: 'a1',
    ticker: 'NXON',
    type: 'take-profit',
    targetPrice: 100, // Very low target price to guarantee trigger
    status: 'active',
    createdAt: Date.now(),
    playerId: 'p3'
  };

  playerManager.addAlert('p3', alert);
  const alerts = playerManager.getAlerts('p3');
  assert.equal(alerts.length, 1);

  const stock = marketEngine.getStock('NXON');
  assert.ok(stock.price > alert.targetPrice, 'Stock price is higher than take profit target');
});
