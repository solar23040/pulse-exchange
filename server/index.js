require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const MarketEngine = require('./market-engine');
const PlayerManager = require('./player-manager');
const OrderEngine = require('./order-engine');
const NewsGenerator = require('./news-generator');

const PORT = process.env.PORT || 4200;
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'pulseadmin';
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '500', 10);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Simulation Core Instances
const marketEngine = new MarketEngine();
const playerManager = new PlayerManager();
const orderEngine = new OrderEngine(playerManager, marketEngine);
const newsGenerator = new NewsGenerator();

// Socket map: ws -> playerId
const clientSockets = new Map();
// Socket map: playerId -> ws
const playerSockets = new Map();

// Session State
const sessionState = {
  id: uuidv4(),
  status: 'active',
  connectedPlayers: 0,
  startedAt: Date.now(),
  simSpeed: 1,
  marketMood: 50,
  round: {
    roundNumber: 1,
    duration: 300,
    startedAt: Date.now(),
    endsAt: Date.now() + 300000,
    isActive: true
  }
};

// Initial welcome news
newsGenerator.createNews({
  title: 'PULSE EXCHANGE Live Floor Active',
  body: 'Trading floor is open for simulation. Welcome all traders and institutional banks.',
  sentiment: 'bullish',
  source: 'system'
});

// Helper functions to broadcast
function broadcast(msgObj) {
  const json = JSON.stringify(msgObj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

function sendToPlayer(playerId, msgObj) {
  const ws = playerSockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msgObj));
  }
}

// ── WebSocket Connection Handler ──
wss.on('connection', (ws) => {
  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw.toString());
      handleClientMessage(ws, msg);
    } catch (err) {
      console.error('Error handling WS message:', err);
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid JSON payload' } }));
    }
  });

  ws.on('close', () => {
    const playerId = clientSockets.get(ws);
    if (playerId) {
      console.log(`Player disconnected: ${playerId}`);
      clientSockets.delete(ws);
      playerSockets.delete(playerId);
      sessionState.connectedPlayers = playerSockets.size;
      broadcast({ type: 'SESSION_STATE', payload: sessionState });
      broadcast({ type: 'LEADERBOARD', payload: playerManager.getLeaderboard() });
    }
  });
});

function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'JOIN': {
      const { name, role, firm } = msg.payload;
      const existingId = clientSockets.get(ws);
      let player;

      if (existingId) {
        player = playerManager.getPlayer(existingId);
      }

      if (!player) {
        const id = uuidv4();
        player = playerManager.addPlayer({ id, name, role, firm });
        clientSockets.set(ws, id);
        playerSockets.set(id, ws);
      }

      sessionState.connectedPlayers = playerSockets.size;

      // Initial portfolio payload
      const portfolio = playerManager.getPortfolio(player.id, marketEngine);

      // Send WELCOME to joining player
      ws.send(JSON.stringify({
        type: 'WELCOME',
        payload: {
          playerId: player.id,
          session: sessionState,
          portfolio
        }
      }));

      // Broadcast updated player list & leaderboard
      broadcast({ type: 'SESSION_STATE', payload: sessionState });
      broadcast({ type: 'LEADERBOARD', payload: playerManager.getLeaderboard() });
      broadcast({ type: 'PLAYER_LIST', payload: playerManager.getAllPlayers() });

      // News broadcast
      newsGenerator.createNews({
        title: `${player.name} joined floor`,
        body: `${player.name} (${player.role.toUpperCase()}${player.firm ? ' - ' + player.firm : ''}) entered the trading floor.`,
        sentiment: 'neutral',
        source: 'system'
      });

      console.log(`Player joined: ${player.name} (${player.role}) [${player.id}]`);
      break;
    }

    case 'ORDER': {
      const playerId = clientSockets.get(ws);
      if (!playerId) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Must JOIN before placing orders' } }));
        return;
      }

      try {
        const orderResult = orderEngine.processOrder({
          playerId,
          ...msg.payload
        });

        if (orderResult.status === 'filled') {
          ws.send(JSON.stringify({ type: 'ORDER_FILL', payload: orderResult }));
          
          // Send updated portfolio
          const updatedPortfolio = playerManager.getPortfolio(playerId, marketEngine);
          ws.send(JSON.stringify({ type: 'PORTFOLIO_UPDATE', payload: updatedPortfolio }));

          // Broadcast leaderboard update
          broadcast({ type: 'LEADERBOARD', payload: playerManager.getLeaderboard() });

          const p = playerManager.getPlayer(playerId);
          newsGenerator.createNews({
            title: `Trade Executed: ${orderResult.side.toUpperCase()} ${orderResult.quantity} ${orderResult.ticker}`,
            body: `${p ? p.name : 'Trader'} executed ${orderResult.side} of ${orderResult.quantity} shares of ${orderResult.ticker} @ ₹${orderResult.price}`,
            ticker: orderResult.ticker,
            sentiment: orderResult.side === 'buy' ? 'bullish' : 'bearish',
            source: 'system'
          });
        } else if (orderResult.status === 'pending') {
          ws.send(JSON.stringify({
            type: 'NEWS',
            payload: newsGenerator.createNews({
              title: `Order Pending: ${orderResult.type.toUpperCase()} ${orderResult.side.toUpperCase()} ${orderResult.ticker}`,
              body: `Order for ${orderResult.quantity} shares @ target ₹${orderResult.price} queued`,
              ticker: orderResult.ticker,
              sentiment: 'neutral',
              source: 'system'
            })
          }));
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'ORDER_REJECTED',
          payload: { orderId: uuidv4(), reason: err.message }
        }));
      }
      break;
    }

    case 'CANCEL_ORDER': {
      const playerId = clientSockets.get(ws);
      if (playerId) {
        try {
          const cancelled = orderEngine.cancelOrder(msg.payload.orderId, playerId);
          ws.send(JSON.stringify({
            type: 'NEWS',
            payload: newsGenerator.createNews({
              title: `Order Cancelled`,
              body: `Pending order ${cancelled.id.slice(0, 8)} was cancelled`,
              sentiment: 'neutral',
              source: 'system'
            })
          }));
        } catch (err) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: { message: err.message } }));
        }
      }
      break;
    }

    case 'ALERT_CREATE': {
      const playerId = clientSockets.get(ws);
      if (playerId) {
        const alertObj = {
          id: uuidv4(),
          ticker: msg.payload.ticker,
          type: msg.payload.alertType,
          targetPrice: msg.payload.targetPrice,
          deltaThreshold: msg.payload.deltaThreshold,
          status: 'active',
          createdAt: Date.now(),
          playerId
        };
        playerManager.addAlert(playerId, alertObj);
        ws.send(JSON.stringify({
          type: 'NEWS',
          payload: newsGenerator.createNews({
            title: `Alert Set: ${msg.payload.ticker}`,
            body: `${msg.payload.alertType.toUpperCase()} target set at ₹${msg.payload.targetPrice}`,
            ticker: msg.payload.ticker,
            sentiment: 'neutral',
            source: 'system'
          })
        }));
      }
      break;
    }

    case 'ALERT_CANCEL': {
      const playerId = clientSockets.get(ws);
      if (playerId) {
        playerManager.removeAlert(playerId, msg.payload.alertId);
      }
      break;
    }

    case 'HOST_ACTION': {
      const { password, ...actionData } = msg.payload;
      if (password !== HOST_PASSWORD) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid Host Password' } }));
        return;
      }

      const resultMsg = marketEngine.applyHostAction(actionData);

      if (actionData.action === 'set-speed') {
        sessionState.simSpeed = marketEngine.simSpeed;
      } else if (actionData.action === 'pause') {
        sessionState.status = 'paused';
      } else if (actionData.action === 'resume') {
        sessionState.status = 'active';
      } else if (actionData.action === 'reset') {
        // Reset player portfolios too
        for (const p of playerManager.getAllPlayers()) {
          p.cash = p.initialCash;
          playerManager.holdings.set(p.id, new Map());
        }
      } else if (actionData.action === 'kick-player') {
        const targetId = actionData.playerId;
        const targetWs = playerSockets.get(targetId);
        if (targetWs) {
          targetWs.send(JSON.stringify({ type: 'ERROR', payload: { message: 'You have been kicked by the Host' } }));
          targetWs.close();
        }
        playerManager.removePlayer(targetId);
      }

      broadcast({ type: 'SESSION_STATE', payload: sessionState });
      broadcast({
        type: 'HOST_EVENT',
        payload: { action: actionData.action, detail: resultMsg }
      });

      const newsItem = newsGenerator.createNews({
        title: `HOST ACTION: ${actionData.action.toUpperCase()}`,
        body: resultMsg,
        sentiment: actionData.action.includes('shock') || actionData.action === 'black-swan' ? 'urgent' : 'neutral',
        source: 'host',
        isHostAction: true
      });

      broadcast({ type: 'NEWS', payload: newsItem });
      break;
    }

    case 'BROADCAST': {
      const item = newsGenerator.createNews({
        title: msg.payload.title,
        body: msg.payload.body,
        ticker: msg.payload.ticker,
        sector: msg.payload.sector,
        sentiment: msg.payload.sentiment || 'neutral',
        source: 'host',
        isHostAction: true
      });
      broadcast({ type: 'NEWS', payload: item });
      break;
    }

    case 'PING': {
      ws.send(JSON.stringify({ type: 'PONG', payload: { serverTime: Date.now() } }));
      break;
    }
  }
}

// ── Main Simulation Tick Loop ──
let tickCount = 0;

setInterval(() => {
  const tickData = marketEngine.tick();
  if (!tickData) return; // Market is paused

  sessionState.marketMood = tickData.mood;

  // 1. Broadcast Market Tick to all clients
  broadcast({
    type: 'TICK',
    payload: tickData
  });

  // 2. Evaluate Limit & Stop orders
  const filledOrders = orderEngine.evaluatePendingOrdersOnTick();
  for (const fill of filledOrders) {
    sendToPlayer(fill.playerId, { type: 'ORDER_FILL', payload: fill });

    // Send updated portfolio to the player
    const updatedPortfolio = playerManager.getPortfolio(fill.playerId, marketEngine);
    sendToPlayer(fill.playerId, { type: 'PORTFOLIO_UPDATE', payload: updatedPortfolio });
  }

  // 3. Evaluate Alerts
  for (const player of playerManager.getAllPlayers()) {
    const alerts = playerManager.getAlerts(player.id);
    for (const alert of alerts) {
      if (alert.status !== 'active') continue;
      const stock = marketEngine.getStock(alert.ticker);
      if (!stock) continue;

      let triggered = false;
      if (alert.type === 'take-profit' && stock.price >= alert.targetPrice) triggered = true;
      if (alert.type === 'stop-loss' && stock.price <= alert.targetPrice) triggered = true;

      if (triggered) {
        alert.status = 'triggered';
        alert.triggeredAt = Date.now();
        sendToPlayer(player.id, { type: 'ALERT_TRIGGERED', payload: alert });
      }
    }
  }

  // 4. Periodic Updates (every ~4 ticks = 2 sec)
  tickCount++;
  if (tickCount % 4 === 0) {
    // Send portfolio updates to active players
    for (const player of playerManager.getAllPlayers()) {
      const p = playerManager.getPortfolio(player.id, marketEngine);
      sendToPlayer(player.id, { type: 'PORTFOLIO_UPDATE', payload: p });
    }

    // Broadcast Leaderboard
    broadcast({
      type: 'LEADERBOARD',
      payload: playerManager.getLeaderboard()
    });

    // Check for dramatic market moves commentary
    const commentary = newsGenerator.generateMarketCommentary(tickData.ticks);
    if (commentary) {
      broadcast({ type: 'NEWS', payload: commentary });
    }
  }
}, TICK_INTERVAL_MS);

// Express Health Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    connectedPlayers: sessionState.connectedPlayers,
    stocks: marketEngine.getAllStocks().length,
    marketMood: sessionState.marketMood
  });
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  PULSE EXCHANGE Backend Server Running on Port ${PORT}`);
  console.log(`  WebSocket Endpoint: ws://localhost:${PORT}`);
  console.log(`===================================================`);
});
