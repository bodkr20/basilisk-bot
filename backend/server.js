require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const PocketOptionWS = require('./websocket/pocket-ws');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS مفتوح للجميع
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.options('*', cors());
app.use(express.json());

const CONFIG = {
    symbol: process.env.SYMBOL || 'AUD/CHF',
    market: 'real',
    timeframes: [1, 2, 3, 5],
    minStrength: parseInt(process.env.MIN_SIGNAL_STRENGTH) || 6,
    baseAmount: parseFloat(process.env.BASE_AMOUNT) || 10
};

const botState = {
    isRunning: false,
    market: 'real',
    currentSignals: {
        real: {},
        otc: {}
    },
    history: {
        real: [],
        otc: []
    },
    stats: {
        real: { totalTrades: 0, winRate: 0, profit: 0, trades: [] },
        otc: { totalTrades: 0, winRate: 0, profit: 0, trades: [] }
    }
};

const wsClient = new PocketOptionWS();
wsClient.connect();

wsClient.on('candle', async (candle) => {
    const market = candle.market || 'real';
    console.log(`📊 شمعة ${market.toUpperCase()}: ${candle.asset} - سعر الإغلاق: ${candle.close}`);
    
    try {
        for (const tf of CONFIG.timeframes) {
            const signal = await analyzeCandle(candle, tf, market);
            
            if (signal && signal.action !== 'WAIT' && signal.strength >= CONFIG.minStrength) {
                console.log(`🚨 إشارة ${signal.action} على ${tf}m - سوق ${market.toUpperCase()} (القوة: ${signal.strength})`);
                botState.currentSignals[market][tf] = signal;
                botState.history[market].push({ ...signal, timeframe: tf, market });
                botState.stats[market].totalTrades++;
            }
        }
    } catch (error) {
        console.error('خطأ في معالجة الشمعة:', error);
    }
});

async function analyzeCandle(candle, timeframe, market) {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python', [
            './analyzer/process_candle.py',
            JSON.stringify({ ...candle, timeframe, market })
        ]);
        
        let result = '';
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });
        
        pythonProcess.stdout.on('end', () => {
            try {
                const signal = JSON.parse(result);
                resolve(signal);
            } catch (e) {
                resolve({ action: 'WAIT', strength: 0 });
            }
        });
        
        pythonProcess.stderr.on('data', (data) => {
            console.error('خطأ في Python:', data.toString());
            resolve({ action: 'WAIT', strength: 0 });
        });
    });
}

// ==================== API Routes ====================

app.post('/api/market', (req, res) => {
    const { market } = req.body;
    if (market && ['real', 'otc'].includes(market)) {
        CONFIG.market = market;
        botState.market = market;
        wsClient.setMarket(market);
        res.json({ success: true, market: market });
    } else {
        res.json({ success: false, error: 'السوق غير صالح' });
    }
});

app.get('/api/market', (req, res) => {
    res.json({ market: CONFIG.market || 'real' });
});

app.get('/api/status', (req, res) => {
    res.json({
        isRunning: wsClient.isConnected,
        symbol: CONFIG.symbol,
        market: CONFIG.market || 'real',
        timeframes: CONFIG.timeframes,
        currentSignals: botState.currentSignals,
        stats: botState.stats,
        lastSignals: {
            real: botState.history.real.slice(-10),
            otc: botState.history.otc.slice(-10)
        }
    });
});

app.get('/api/signal/:market/:timeframe', (req, res) => {
    const market = req.params.market;
    const tf = parseInt(req.params.timeframe);
    if (botState.currentSignals[market] && botState.currentSignals[market][tf]) {
        res.json(botState.currentSignals[market][tf]);
    } else {
        res.json({ action: 'WAIT', strength: 0, timeframe: tf, market: market });
    }
});

app.get('/api/history/:market', (req, res) => {
    const market = req.params.market;
    if (botState.history[market]) {
        res.json(botState.history[market].slice(-50));
    } else {
        res.json([]);
    }
});

app.get('/api/stats/:market', (req, res) => {
    const market = req.params.market;
    if (botState.stats[market]) {
        res.json(botState.stats[market]);
    } else {
        res.json({ totalTrades: 0, winRate: 0, profit: 0 });
    }
});

app.get('/api/trades/:market', (req, res) => {
    const market = req.params.market;
    if (botState.stats[market]) {
        res.json({
            total: botState.stats[market].totalTrades,
            winRate: botState.stats[market].winRate,
            profit: botState.stats[market].profit,
            recent: botState.stats[market].trades.slice(-20)
        });
    } else {
        res.json({ total: 0, winRate: 0, profit: 0, recent: [] });
    }
});

app.post('/api/settings', (req, res) => {
    const { symbol, timeframes, minStrength, baseAmount } = req.body;
    if (symbol) CONFIG.symbol = symbol;
    if (timeframes) CONFIG.timeframes = timeframes;
    if (minStrength) CONFIG.minStrength = minStrength;
    if (baseAmount) CONFIG.baseAmount = baseAmount;
    res.json({ success: true, config: CONFIG });
});

app.post('/api/simulate-trade', (req, res) => {
    const { market, tradeId, result } = req.body;
    const trade = botState.stats[market]?.trades.find(t => t.id === tradeId);
    if (!trade) {
        return res.json({ success: false, error: 'الصفقة غير موجودة' });
    }
    
    trade.status = result === 'win' ? 'won' : 'lost';
    trade.closedAt = new Date();
    trade.profit = result === 'win' ? trade.amount * 0.8 : -trade.amount;
    
    const marketStats = botState.stats[market];
    const totalWon = marketStats.trades.filter(t => t.status === 'won').length;
    const totalClosed = marketStats.trades.filter(t => t.status !== 'pending').length;
    marketStats.winRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;
    marketStats.profit = marketStats.trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    res.json({ success: true, trade });
});

// ✅ إضافة route اختبار بسيط
app.get('/', (req, res) => {
    res.json({ message: 'Basilisk API is running!' });
});

app.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════
    🦎 Basilisk Bot - Real & OTC Markets
    ═══════════════════════════════════════
    🚀 API: http://localhost:${PORT}
    📊 الزوج: ${CONFIG.symbol}
    📍 السوق: ${CONFIG.market}
    ⏱ الأطر: ${CONFIG.timeframes.join('m, ')}m
    💰 الحد الأدنى: $${CONFIG.baseAmount}
    ═══════════════════════════════════════
    `);
});
