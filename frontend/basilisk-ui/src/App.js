import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// الرابط الصحيح حق الـ Backend
const API_URL = 'https://basilisk-bot-7vro.onrender.com/api';

function App() {
    // States
    const [market, setMarket] = useState('real');
    const [selectedTimeframe, setSelectedTimeframe] = useState(1);
    const [signals, setSignals] = useState({ real: {}, otc: {} });
    const [history, setHistory] = useState({ real: [], otc: [] });
    const [isConnected, setIsConnected] = useState(false);
    const [stats, setStats] = useState({ real: { totalTrades: 0, winRate: 0, profit: 0 }, otc: { totalTrades: 0, winRate: 0, profit: 0 } });
    const [trades, setTrades] = useState({ real: [], otc: [] });

    const timeframes = [1, 2, 3, 5];

    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, 3000);
        fetchData();
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [statusRes, marketRes] = await Promise.all([
                axios.get(`${API_URL}/status`),
                axios.get(`${API_URL}/market`)
            ]);
            
            setIsConnected(statusRes.data.isRunning);
            setSignals(statusRes.data.currentSignals || { real: {}, otc: {} });
            setHistory(statusRes.data.lastSignals || { real: [], otc: [] });
            setStats(statusRes.data.stats || { real: { totalTrades: 0, winRate: 0, profit: 0 }, otc: { totalTrades: 0, winRate: 0, profit: 0 } });
            
            const [tradesReal, tradesOtc] = await Promise.all([
                axios.get(`${API_URL}/trades/real`),
                axios.get(`${API_URL}/trades/otc`)
            ]);
            setTrades({ real: tradesReal.data.recent || [], otc: tradesOtc.data.recent || [] });
            
            if (marketRes.data.market) {
                setMarket(marketRes.data.market);
            }
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
        }
    };

    const switchMarket = async (newMarket) => {
        try {
            await axios.post(`${API_URL}/market`, { market: newMarket });
            setMarket(newMarket);
        } catch (error) {
            console.error('خطأ في تبديل السوق:', error);
        }
    };

    const getSignalColor = (action) => {
        if (action === 'BUY') return '#4caf50';
        if (action === 'SELL') return '#f44336';
        return '#ff9800';
    };

    const getSignalEmoji = (action) => {
        if (action === 'BUY') return '🟢';
        if (action === 'SELL') return '🔴';
        return '⏳';
    };

    const getMarketLabel = (m) => {
        return m === 'real' ? '📈 العادي' : '🔄 OTC';
    };

    const getMarketEmoji = (m) => {
        return m === 'real' ? '📈' : '🔄';
    };

    const currentSignal = signals[market]?.[selectedTimeframe] || { action: 'WAIT', strength: 0 };
    const currentStats = stats[market] || { totalTrades: 0, winRate: 0, profit: 0 };
    const currentTrades = trades[market] || [];

    return (
        <div className="App">
            <header className="App-header">
                <h1>🦎 Basilisk Scanner</h1>
                <div className="status">
                    {isConnected ? '🟢 متصل' : '🔴 غير متصل'}
                </div>
            </header>

            <div className="market-selector">
                <label>📍 السوق:</label>
                <button 
                    className={`market-btn ${market === 'real' ? 'active' : ''}`}
                    onClick={() => switchMarket('real')}
                >
                    📈 Real
                </button>
                <button 
                    className={`market-btn ${market === 'otc' ? 'active' : ''}`}
                    onClick={() => switchMarket('otc')}
                >
                    🔄 OTC
                </button>
                <span className="market-status">
                    {market === 'real' ? '🟢 السوق العادي' : '🟡 سوق OTC (تقلب عالي)'}
                </span>
            </div>

            <div className="timeframe-selector">
                <label>⏱ الإطار:</label>
                {timeframes.map(tf => (
                    <button
                        key={tf}
                        className={`tf-btn ${selectedTimeframe === tf ? 'active' : ''}`}
                        onClick={() => setSelectedTimeframe(tf)}
                    >
                        {tf}m
                    </button>
                ))}
                <span className="tf-active">
                    🟢 {selectedTimeframe}m نشط
                </span>
            </div>

            <div className="main-container">
                <div className="signal-card" style={{ borderColor: getSignalColor(currentSignal.action) }}>
                    <div className="signal-header">
                        <span className="signal-market">{getMarketEmoji(market)} {getMarketLabel(market)}</span>
                        <span className="signal-timeframe">⏱ {selectedTimeframe}m</span>
                    </div>
                    <div className="signal-emoji">{getSignalEmoji(currentSignal.action)}</div>
                    <div className="signal-action">{currentSignal.action || 'WAIT'}</div>
                    <div className="signal-strength">
                        القوة: {currentSignal.strength || 0}/15
                        <div className="strength-bar">
                            <div 
                                className="strength-fill" 
                                style={{ width: `${((currentSignal.strength || 0) / 15) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <div className="signal-quality">
                        جودة الدخول: {'⭐'.repeat(Math.min(currentSignal.entry_quality || 0, 5))}
                    </div>
                    {currentSignal.volume && (
                        <div className="signal-volume">💰 المبلغ المقترح: ${currentSignal.volume}</div>
                    )}
                    {currentSignal.prices && (
                        <div className="signal-price">
                            📊 السعر: {currentSignal.prices.close}
                            <span className="price-detail"> (H: {currentSignal.prices.high} / L: {currentSignal.prices.low})</span>
                        </div>
                    )}
                    {currentSignal.indicators && currentSignal.indicators.otc_volatility && (
                        <div className="otc-badge">
                            ⚡ OTC: تقلب {currentSignal.indicators.otc_volatility}
                            {currentSignal.indicators.otc_volume === 'spike' && ' 🔥 حجم مرتفع'}
                        </div>
                    )}
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>📊 إجمالي الصفقات</h3>
                        <p>{currentStats.totalTrades || 0}</p>
                    </div>
                    <div className="stat-card">
                        <h3>📈 نسبة الربح</h3>
                        <p>{currentStats.winRate || 0}%</p>
                    </div>
                    <div className="stat-card">
                        <h3>💰 الربح الإجمالي</h3>
                        <p>${(currentStats.profit || 0).toFixed(2)}</p>
                    </div>
                </div>

                {currentSignal.indicators && Object.keys(currentSignal.indicators).length > 0 && (
                    <div className="indicators-grid">
                        <h3>📊 المؤشرات الفنية {market === 'otc' && '(مع مؤشرات OTC)'}</h3>
                        {Object.entries(currentSignal.indicators).map(([key, value]) => {
                            if (key.includes('_value') || key === 'score_diff') return null;
                            
                            let className = '';
                            if (typeof value === 'string') {
                                if (['oversold', 'bullish', 'below_lower', 'up', 'high_bullish', 'expanded', 'spike', 'strong'].includes(value)) {
                                    className = 'bullish';
                                } else if (['overbought', 'bearish', 'above_upper', 'down', 'high_bearish', 'compressed'].includes(value)) {
                                    className = 'bearish';
                                }
                            }
                            
                            let label = key.replace('_', ' ').toUpperCase();
                            if (key.startsWith('otc_')) {
                                label = '⚡ ' + label.replace('OTC ', '');
                            }
                            
                            return (
                                <div key={key} className="indicator-item">
                                    <span>{label}:</span>
                                    <span className={className}>
                                        {typeof value === 'number' ? value.toFixed(2) : value}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {currentTrades.length > 0 && (
                    <div className="trades-history">
                        <h3>📋 آخر الصفقات - {getMarketLabel(market)}</h3>
                        <div className="trades-list">
                            {currentTrades.slice().reverse().slice(0, 10).map((trade, index) => (
                                <div key={index} className={`trade-item ${trade.status || 'pending'}`}>
                                    <span className="trade-type">{trade.type}</span>
                                    <span className="trade-timeframe">{trade.timeframe}m</span>
                                    <span className="trade-amount">${trade.amount}</span>
                                    <span className="trade-status">
                                        {trade.status === 'pending' ? '⏳' : 
                                         trade.status === 'won' ? '✅' : '❌'}
                                    </span>
                                    {trade.profit !== undefined && (
                                        <span className={`trade-profit ${trade.profit > 0 ? 'positive' : 'negative'}`}>
                                            ${trade.profit.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="footer">
                <p>⚠️ التداول يحمل مخاطر عالية - استخدم البوت كأداة مساعدة فقط</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                    صفقات رقمية • 1m • 2m • 3m • 5m • {market === 'real' ? '📈 سوق عادي' : '🔄 سوق OTC'}
                </p>
            </div>
        </div>
    );
}

export default App;
