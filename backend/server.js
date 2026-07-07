require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ أهم نقطة: سماح مطلق للاتصالات (CORS)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.options('*', cors());
app.use(express.json());

// ✅ نقطة نهاية بسيطة للاختبار (بتستقبل أي طلب وتجاوب)
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: true,
        message: "✅ البوت شغال!",
        time: new Date().toISOString()
    });
});

// ✅ نقطة نهاية ترحب بأي اتصال
app.get('/', (req, res) => {
    res.json({ message: "✅ Basilisk API is running!" });
});

app.listen(PORT, () => {
    console.log(`✅ الـ API شغال على http://localhost:${PORT}`);
});
