import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// 👇 الرابط الصحيح للـ API حطيتـه هنا
const API_URL = 'https://basilisk-api-z5pd.onrender.com';

function App() {
  const [status, setStatus] = useState('⏳ جاري التحميل...');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // دالة جلب البيانات
  const fetchStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/status`);
      setStatus('🟢 متصل');
      setData(response.data);
      setError(null);
    } catch (err) {
      setStatus('🔴 غير متصل');
      setError(err.message);
      console.error('خطأ في جلب البيانات:', err);
    }
  };

  // جلب البيانات أول ما تفتح الصفحة، وكل 5 ثواني
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🦎 Basilisk Scanner</h1>
        <div className="status">{status}</div>
      </header>

      <div style={{ padding: '20px', textAlign: 'center' }}>
        {error && <p style={{ color: 'red' }}>❌ خطأ: {error}</p>}
        {data && (
          <pre style={{ background: '#1a1a3e', padding: '15px', borderRadius: '8px', textAlign: 'left' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
        <button onClick={fetchStatus} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>
          🔄 تحديث
        </button>
      </div>
    </div>
  );
}

export default App;
