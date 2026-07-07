import pandas as pd
import numpy as np
import json
from datetime import datetime

class AdvancedAnalyzer:
    def __init__(self, symbol="AUD/CHF"):
        self.symbol = symbol
        # تخزين بيانات منفصلة لكل سوق
        self.data_cache = {
            'real': {},
            'otc': {}
        }
        
    def add_candle(self, candle, timeframe=1, market='real'):
        """إضافة شمعة مع السوق والإطار الزمني"""
        key = f"{self.symbol}_{timeframe}"
        
        if key not in self.data_cache[market]:
            self.data_cache[market][key] = pd.DataFrame(columns=['time', 'open', 'high', 'low', 'close', 'volume'])
        
        df = self.data_cache[market][key]
        new_row = pd.DataFrame([{
            'time': candle.get('time', 0),
            'open': float(candle.get('open', 0)),
            'high': float(candle.get('high', 0)),
            'low': float(candle.get('low', 0)),
            'close': float(candle.get('close', 0)),
            'volume': float(candle.get('volume', 0))
        }])
        
        df = pd.concat([df, new_row], ignore_index=True)
        if len(df) > 150:
            df = df.iloc[-150:]
        self.data_cache[market][key] = df
    
    def get_data(self, timeframe=1, market='real'):
        """جلب البيانات لإطار زمني محدد وسوق معين"""
        key = f"{self.symbol}_{timeframe}"
        return self.data_cache.get(market, {}).get(key, pd.DataFrame())
    
    # ==================== المؤشرات العامة ====================
    
    def calculate_rsi(self, prices, period=14):
        if len(prices) < period:
            return 50
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50
    
    def calculate_ema(self, prices, period):
        if len(prices) < period:
            return prices.iloc[-1] if len(prices) > 0 else 0
        return prices.ewm(span=period, adjust=False).mean().iloc[-1]
    
    def calculate_macd(self, prices):
        if len(prices) < 26:
            return 0, 0, 0
        exp1 = prices.ewm(span=12, adjust=False).mean()
        exp2 = prices.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        hist = macd - signal
        return macd.iloc[-1], signal.iloc[-1], hist.iloc[-1]
    
    def calculate_stochastic(self, high, low, close, k_period=14, d_period=3):
        if len(close) < k_period:
            return 50, 50
        low_min = low.rolling(window=k_period).min()
        high_max = high.rolling(window=k_period).max()
        k = 100 * ((close - low_min) / (high_max - low_min))
        d = k.rolling(window=d_period).mean()
        return k.iloc[-1] if not pd.isna(k.iloc[-1]) else 50, d.iloc[-1] if not pd.isna(d.iloc[-1]) else 50
    
    # ==================== مؤشرات خاصة بـ OTC ====================
    
    def calculate_otc_volatility(self, df, period=10):
        """حساب التقلب الخاص بـ OTC (أعلى من العادي)"""
        if len(df) < period:
            return 0
        returns = df['close'].pct_change()
        volatility = returns.rolling(window=period).std() * 100
        return volatility.iloc[-1] if not pd.isna(volatility.iloc[-1]) else 0
    
    def calculate_otc_momentum(self, df, period=5):
        """زخم OTC (أسرع من العادي)"""
        if len(df) < period:
            return 0
        momentum = (df['close'].iloc[-1] - df['close'].iloc[-period]) / df['close'].iloc[-period] * 100
        return momentum
    
    def calculate_otc_range_ratio(self, df):
        """نسبة نطاق السعر لـ OTC"""
        if len(df) < 10:
            return 0
        avg_range = (df['high'] - df['low']).rolling(10).mean().iloc[-1]
        current_range = df['high'].iloc[-1] - df['low'].iloc[-1]
        return current_range / avg_range if avg_range > 0 else 1
    
    def calculate_otc_volume_spike(self, df, period=10):
        """تحديد ارتفاع الحجم في OTC"""
        if len(df) < period:
            return False
        avg_volume = df['volume'].rolling(period).mean().iloc[-1]
        current_volume = df['volume'].iloc[-1]
        return current_volume > avg_volume * 1.5
    
    # ==================== توليد الإشارة ====================
    
    def generate_signal(self, timeframe=1, market='real'):
        """توليد إشارة حسب السوق والإطار الزمني"""
        df = self.get_data(timeframe, market)
        
        if len(df) < 15:
            return self.empty_signal(timeframe, market)
        
        close = df['close']
        high = df['high']
        low = df['low']
        
        # ===== المؤشرات العامة =====
        rsi = self.calculate_rsi(close, 14)
        ema9 = self.calculate_ema(close, 9)
        ema21 = self.calculate_ema(close, 21)
        ema50 = self.calculate_ema(close, 50)
        macd, macd_signal, macd_hist = self.calculate_macd(close)
        stoch_k, stoch_d = self.calculate_stochastic(high, low, close)
        
        # ===== مؤشرات خاصة بـ OTC =====
        otc_volatility = self.calculate_otc_volatility(df)
        otc_momentum = self.calculate_otc_momentum(df)
        otc_range_ratio = self.calculate_otc_range_ratio(df)
        otc_volume_spike = self.calculate_otc_volume_spike(df)
        
        # بولينجر باند
        sma20 = close.rolling(window=20).mean().iloc[-1] if len(close) >= 20 else close.iloc[-1]
        std20 = close.rolling(window=20).std().iloc[-1] if len(close) >= 20 else 0
        bb_upper = sma20 + (std20 * 2) if std20 > 0 else close.iloc[-1]
        bb_lower = sma20 - (std20 * 2) if std20 > 0 else close.iloc[-1]
        
        last_close = close.iloc[-1]
        prev_close = close.iloc[-2] if len(close) > 1 else last_close
        
        # ===== نظام التسجيل =====
        buy_score = 0
        sell_score = 0
        signals = {}
        
        # 1. RSI (وزن 3)
        if rsi < 30:
            buy_score += 3
            signals['rsi'] = 'oversold'
        elif rsi > 70:
            sell_score += 3
            signals['rsi'] = 'overbought'
        else:
            signals['rsi'] = 'neutral'
        signals['rsi_value'] = round(float(rsi), 2)
        
        # 2. MACD (وزن 4)
        if macd > macd_signal and macd_hist > 0:
            buy_score += 4
            signals['macd'] = 'bullish'
        elif macd < macd_signal and macd_hist < 0:
            sell_score += 4
            signals['macd'] = 'bearish'
        else:
            signals['macd'] = 'neutral'
        signals['macd_hist'] = round(float(macd_hist), 4)
        
        # 3. EMA Crossover (وزن 5)
        if ema9 > ema21 and ema21 > ema50:
            buy_score += 5
            signals['ema'] = 'bullish'
        elif ema9 < ema21 and ema21 < ema50:
            sell_score += 5
            signals['ema'] = 'bearish'
        else:
            signals['ema'] = 'neutral'
        
        # 4. Stochastic (وزن 2)
        if stoch_k < 20 and stoch_d < 20:
            buy_score += 2
            signals['stochastic'] = 'oversold'
        elif stoch_k > 80 and stoch_d > 80:
            sell_score += 2
            signals['stochastic'] = 'overbought'
        else:
            signals['stochastic'] = 'neutral'
        
        # 5. Bollinger Bands (وزن 2)
        if last_close < bb_lower:
            buy_score += 2
            signals['bb'] = 'below_lower'
        elif last_close > bb_upper:
            sell_score += 2
            signals['bb'] = 'above_upper'
        else:
            signals['bb'] = 'inside'
        
        # 6. الزخم (وزن 1)
        if last_close > prev_close:
            buy_score += 1
            signals['momentum'] = 'up'
        else:
            sell_score += 1
            signals['momentum'] = 'down'
        
        # ===== مؤشرات خاصة بـ OTC (تضاف فقط للسوق OTC) =====
        if market == 'otc':
            # التقلب العالي في OTC يزيد الوزن
            if otc_volatility > 0.5:
                if otc_momentum > 0:
                    buy_score += 3
                    signals['otc_volatility'] = 'high_bullish'
                else:
                    sell_score += 3
                    signals['otc_volatility'] = 'high_bearish'
            elif otc_volatility > 0.2:
                signals['otc_volatility'] = 'medium'
            else:
                signals['otc_volatility'] = 'low'
            signals['otc_volatility_value'] = round(float(otc_volatility), 2)
            
            # نطاق السعر في OTC
            if otc_range_ratio > 1.5:
                signals['otc_range'] = 'expanded'
                if last_close > (high.iloc[-1] + low.iloc[-1]) / 2:
                    buy_score += 2
                else:
                    sell_score += 2
            elif otc_range_ratio > 1.0:
                signals['otc_range'] = 'normal'
            else:
                signals['otc_range'] = 'compressed'
            signals['otc_range_value'] = round(float(otc_range_ratio), 2)
            
            # ارتفاع الحجم في OTC
            if otc_volume_spike:
                signals['otc_volume'] = 'spike'
                buy_score += 2 if last_close > prev_close else 0
                sell_score += 2 if last_close < prev_close else 0
            else:
                signals['otc_volume'] = 'normal'
            
            # زخم OTC السريع
            if abs(otc_momentum) > 0.5:
                signals['otc_momentum'] = 'strong'
                if otc_momentum > 0:
                    buy_score += 2
                else:
                    sell_score += 2
            else:
                signals['otc_momentum'] = 'weak'
            signals['otc_momentum_value'] = round(float(otc_momentum), 2)
        
        # ===== الإشارة النهائية =====
        score_diff = buy_score - sell_score
        action = 'WAIT'
        strength = 0
        entry_quality = 0
        
        # عتبة أقل لـ OTC لأن حركته أسرع
        threshold = 3 if market == 'otc' else 4
        
        if score_diff >= threshold:
            action = 'BUY'
            strength = min(buy_score, 15)
            entry_quality = min(int(buy_score / 3), 5)
        elif score_diff <= -threshold:
            action = 'SELL'
            strength = min(sell_score, 15)
            entry_quality = min(int(sell_score / 3), 5)
        
        # حجم الصفقة
        volume = self.calculate_volume(strength, timeframe, market)
        
        return {
            'action': action,
            'strength': strength,
            'entry_quality': entry_quality,
            'volume': volume,
            'indicators': signals,
            'prices': {
                'close': round(float(last_close), 5),
                'high': round(float(high.iloc[-1]), 5),
                'low': round(float(low.iloc[-1]), 5),
                'open': round(float(df['open'].iloc[-1]), 5)
            },
            'timestamp': datetime.now().isoformat(),
            'timeframe': timeframe,
            'market': market
        }
    
    def empty_signal(self, timeframe, market):
        return {
            'action': 'WAIT',
            'strength': 0,
            'entry_quality': 0,
            'volume': 0,
            'indicators': {},
            'prices': {},
            'timestamp': datetime.now().isoformat(),
            'timeframe': timeframe,
            'market': market
        }
    
    def calculate_volume(self, strength, timeframe=1, market='real'):
        """حساب مبلغ الصفقة"""
        if strength == 0:
            return 0
        
        base_amount = float(process.env.BASE_AMOUNT) if hasattr(process, 'env') else 10
        
        # مضاعفات الأطر الزمنية
        multipliers = {1: 1.0, 2: 1.2, 3: 1.5, 5: 2.0}
        tf_multiplier = multipliers.get(timeframe, 1.0)
        
        # مضاعف السوق (OTC أعلى بسبب التقلب)
        market_multiplier = 1.3 if market == 'otc' else 1.0
        
        # مضاعف القوة
        strength_multiplier = 1 + (strength / 25)
        
        final_amount = base_amount * tf_multiplier * market_multiplier * strength_multiplier
        return round(min(final_amount, 100), 2)
