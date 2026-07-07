const WebSocket = require('ws');
const EventEmitter = require('events');

class PocketOptionWS extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnect = 10;
        this.pingInterval = null;
        this.subscriptions = new Set();
        this.currentMarket = 'real';
    }

    connect() {
        const wsUrl = process.env.POCKET_WS_URL || 'wss://ws.pocketoption.com/echo/websocket';
        
        console.log('🔄 جاري الاتصال بـ Pocket Option...');
        
        this.ws = new WebSocket(wsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        this.ws.on('open', () => {
            console.log('✅ متصل بـ Pocket Option WebSocket');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            this.startPing();
            this.authenticate();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (e) {
                // تجاهل
            }
        });

        this.ws.on('close', () => {
            console.log('❌ تم قطع الاتصال');
            this.isConnected = false;
            this.stopPing();
            this.reconnect();
        });

        this.ws.on('error', (error) => {
            console.error('⚠️ خطأ في WebSocket:', error.message);
        });
    }

    setMarket(market) {
        this.currentMarket = market;
        console.log(`🔄 تم التبديل إلى سوق ${market === 'real' ? 'Real (العادي)' : 'OTC'}`);
        
        // إعادة الاشتراك
        this.subscriptions.forEach(sub => {
            this.unsubscribe(sub);
        });
        this.subscriptions.clear();
        
        const symbol = process.env.SYMBOL || 'AUD/CHF';
        const timeframe = parseInt(process.env.TIMEFRAME || 60);
        this.subscribeToCandles(symbol, timeframe);
    }

    authenticate() {
        const authMessage = {
            name: "candle-generated",
            msg: {
                name: "candle-generated",
                version: 1.0,
                body: []
            }
        };
        this.send(authMessage);
        
        const symbol = process.env.SYMBOL || 'AUD/CHF';
        const timeframe = parseInt(process.env.TIMEFRAME || 60);
        this.subscribeToCandles(symbol, timeframe);
    }

    subscribeToCandles(asset, timeframe = 60) {
        // إرسال طلب اشتراك مع نوع السوق
        const subscription = {
            name: "subscribe",
            msg: {
                name: "subscribe",
                params: {
                    asset: asset,
                    timeframe: timeframe,
                    market: this.currentMarket // إضافة نوع السوق
                }
            }
        };
        this.send(subscription);
        this.subscriptions.add(`${asset}-${timeframe}-${this.currentMarket}`);
        console.log(`📊 مشترك في ${asset} - ${timeframe}s - سوق ${this.currentMarket.toUpperCase()}`);
    }

    unsubscribe(sub) {
        const parts = sub.split('-');
        const asset = parts[0];
        const timeframe = parseInt(parts[1]);
        const market = parts[2] || 'real';
        
        const unsubMsg = {
            name: "unsubscribe",
            msg: {
                name: "unsubscribe",
                params: {
                    asset: asset,
                    timeframe: timeframe,
                    market: market
                }
            }
        };
        this.send(unsubMsg);
    }

    handleMessage(message) {
        if (message.name === 'candle-generated') {
            try {
                const candleData = message.msg.body;
                if (Array.isArray(candleData) && candleData.length > 0) {
                    const candle = candleData[0];
                    this.emit('candle', {
                        asset: candle.asset || process.env.SYMBOL || 'AUD/CHF',
                        timeframe: candle.timeframe || parseInt(process.env.TIMEFRAME || 60),
                        open: parseFloat(candle.open) || 0,
                        high: parseFloat(candle.high) || 0,
                        low: parseFloat(candle.low) || 0,
                        close: parseFloat(candle.close) || 0,
                        volume: parseFloat(candle.volume) || 0,
                        time: candle.time || Date.now(),
                        market: candle.market || this.currentMarket || 'real'
                    });
                }
            } catch (e) {
                // تجاهل
            }
        }
    }

    send(data) {
        if (this.ws && this.isConnected) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (e) {
                console.error('خطأ في الإرسال:', e.message);
            }
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ name: "ping" });
            }
        }, 30000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnect) {
            this.reconnectAttempts++;
            console.log(`🔄 محاولة إعادة الاتصال ${this.reconnectAttempts}/${this.maxReconnect}`);
            setTimeout(() => this.connect(), 5000 * this.reconnectAttempts);
        } else {
            console.log('❌ فشل إعادة الاتصال بعد عدة محاولات');
        }
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

module.exports = PocketOptionWS;
