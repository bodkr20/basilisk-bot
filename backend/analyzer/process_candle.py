import sys
import json
from advanced_analyzer import AdvancedAnalyzer

# تخزين المحللين لكل زوج وسوق
analyzers = {}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'action': 'WAIT', 'strength': 0}))
        return
    
    try:
        data = json.loads(sys.argv[1])
        symbol = data.get('asset', 'AUD/CHF')
        timeframe = data.get('timeframe', 1)
        market = data.get('market', 'real')
        
        key = f"{symbol}_{market}"
        if key not in analyzers:
            analyzers[key] = AdvancedAnalyzer(symbol)
        
        analyzer = analyzers[key]
        analyzer.add_candle(data, timeframe, market)
        signal = analyzer.generate_signal(timeframe, market)
        print(json.dumps(signal))
        
    except Exception as e:
        error_response = {
            'action': 'WAIT',
            'strength': 0,
            'error': str(e)
        }
        print(json.dumps(error_response))

if __name__ == "__main__":
    main()
