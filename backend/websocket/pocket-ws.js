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
        // ✅ روابط WebSocket بديلة للتجربة
        const wsUrls = [
            'wss://ws.pocketoption.com/echo/websocket',
            'wss://ws.pocketoption.com/echo',
            'wss://ws.binaryoptions.com/echo/websocket'
        ];
        
        const wsUrl = wsUrls[0]; // جرب الأول، وإذا ما اشتغل غيره يدويًا
        console.log('🔄 جاري الاتصال بـ Pocket Option WebSocket...');
        console.log(`📍 الرابط: ${wsUrl}`);
        
        try {
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
                this.subscribeToChannels();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(message);
                } catch (e) {
                    // تجاهل الأخطاء
                }
            });

            this.ws.on('close', (code, reason) => {
                console.log(`❌ تم قطع الاتصال (الكود: ${code})`);
                this.isConnected = false;
                this.stopPing();
                setTimeout(() => this.reconnect(), 3000);
            });

            this.ws.on('error', (error) => {
                console.error('⚠️ خطأ في WebSocket:', error.message);
            });
        } catch (error) {
            console.error('❌ فشل إنشاء اتصال WebSocket:', error.message);
            setTimeout(() => this.reconnect(), 5000);
        }
    }

    subscribeToChannels() {
        const symbol = process.env.SYMBOL || 'AUD/CHF';
        const timeframe = parseInt(process.env.TIMEFRAME || 60);
        this.subscribeToCandles(symbol, timeframe);
    }

    setMarket(market) {
        this.currentMarket = market;
        console.log(`🔄 تم التبديل إلى سوق ${market === 'real' ? 'Real (العادي)' : 'OTC'}`);
        
        this.subscriptions.forEach(sub => this.unsubscribe(sub));
        this.subscriptions.clear();
        
        const symbol = process.env.SYMBOL || 'AUD/CHF';
        const timeframe = parseInt(process.env.TIMEFRAME || 60);
        this.subscribeToCandles(symbol, timeframe);
    }

    subscribeToCandles(asset, timeframe = 60) {
        const subscription = {
            name: "subscribe",
            msg: {
                name: "subscribe",
                params: {
                    asset: asset,
                    timeframe: timeframe,
                    market: this.currentMarket
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
        if (message.name === 'candle-generated' || message.name === 'candle') {
            try {
                let candleData = message.msg?.body || message.body || [];
                if (!Array.isArray(candleData)) candleData = [candleData];
                if (candleData.length > 0) {
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
                console.error('خطأ في معالجة الرسالة:', e);
            }
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (e) {
                console.error('خطأ في الإرسال:', e.message);
            }
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
            this.emit('connection_failed');
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
