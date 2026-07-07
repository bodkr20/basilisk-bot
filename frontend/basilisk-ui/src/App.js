import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'https://basilisk-api-z5pd.onrender.com';

function App() {
    const [market, setMarket] = useState('real');
    const [selectedTimeframe, setSelectedTimeframe] = useState(1);
    const [signals, setSignals] = useState({ real: {}, otc: {} });
    const [isConnected, setIsConnected] = useState(false);
    const [stats, setStats] = useState({ 
        real: { totalTrades: 0, winRate: 0, profit: 0 }, 
        otc: { totalTrades: 0, winRate: 0, profit: 0 } 
    });
    const [loading, setLoading] = useState(true);

    const timeframes = [1, 2, 3, 5];

    // جلب البيانات كل 10 ثواني (بدل 3 ثواني عشان نبطئ)
    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, 10000);
        fetchData();
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const response = await axios.get(`${API_URL}/status`);
            setIsConnected(response.data.isRunning);
            setSignals(response.data.currentSignals || { real: {}, otc: {} });
            setStats(response.data.stats || { 
                real: { totalTrades: 0, winRate: 0, profit: 0 }, 
                otc: { totalTrades: 0, winRate: 0, profit: 0 } 
            });
            setLoading(false);
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            setLoading(false);
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

    const currentSignal = signals[market]?.[selectedTimeframe] || { action: 'WAIT', strength: 0 };
    const currentStats = stats[market] || { totalTrades: 0, winRate: 0, profit: 0 };

    if (loading) {
        return (
            <div className="App">
                <header className="App-header">
                    <h1>🦎 Basilisk Scanner</h1>
                    <div className="status">⏳ جاري التحميل...</div>
                </header>
            </div>
        );
    }

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
