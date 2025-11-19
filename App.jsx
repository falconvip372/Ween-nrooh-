import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Bell, BellOff, Eye, Wifi, WifiOff, Key, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

export default function App() {
// --- State ---
const [symbol, setSymbol] = useState('AAPL');
const [apiKey, setApiKey] = useState('');
const [price, setPrice] = useState(null);
const [data, setData] = useState([]);
const [rsi, setRsi] = useState(null);
const [alerts, setAlerts] = useState([]);
const [isConnected, setIsConnected] = useState(false);
const [error, setError] = useState('');

// WebSocket Reference
const ws = useRef(null);

// --- Logic: RSI Calculation (مؤشر القوة النسبية) ---
const calculateRSI = (prices) => {
if (prices.length < 14) return 50;
let gains = 0, losses = 0;

// Calculate average gain and loss over the lookback period (14 is standard)
for (let i = prices.length - 14; i < prices.length; i++) {
const diff = prices[i] - prices[i - 1];
if (diff >= 0) gains += diff;
else losses -= diff;
}

const avgGain = gains / 14;
const avgLoss = losses / 14;

if (avgLoss === 0) return 100;
const rs = avgGain / avgLoss;
return 100 - (100 / (1 + rs));
};

// --- Logic: Start Monitoring (بدء المراقبة والاتصال) ---
const startMonitoring = () => {
if (!apiKey) {
setError('الرجاء إدخال مفتاح Finnhub API أولاً');
return;
}
if (!symbol) return;

setError('');
setData([]); // Reset old chart data
setAlerts([]);

// Close any existing connection
if (ws.current) ws.current.close();

// 1. Open WebSocket connection with Finnhub
const socket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
ws.current = socket;

socket.onopen = () => {
setIsConnected(true);
// Subscribe to the selected symbol
socket.send(JSON.stringify({ 'type': 'subscribe', 'symbol': symbol.toUpperCase() }));
};

socket.onmessage = (event) => {
const response = JSON.parse(event.data);

// Finnhub sends data as "trades"
if (response.type === 'trade' && response.data) {
const trade = response.data[response.data.length - 1];
const newPrice = trade.p; // p = price
const timestamp = new Date(trade.t * 1000).toLocaleTimeString(); // t = timestamp in Unix seconds

setPrice(newPrice);

setData(prevData => {
const newData = [...prevData, { time: timestamp, price: newPrice }];
const slicedData = newData.slice(-50);

// Calculate Indicators
if (slicedData.length > 14) {
const pricesOnly = slicedData.map(d => d.price);
const newRSI = calculateRSI(pricesOnly);
setRsi(newRSI);
checkAlerts(newPrice, newRSI, symbol);
}

return slicedData;
});
}
};

socket.onerror = (err) => {
console.error(err);
setError('فشل الاتصال. تأكد من صحة المفتاح أو رمز السهم.');
setIsConnected(false);
};

socket.onclose = () => {
setIsConnected(false);
};
};

const stopMonitoring = () => {
if (ws.current) ws.current.close();
setIsConnected(false);
};

// --- Logic: Alerts (منطق التنبيهات) ---
const checkAlerts = (currentPrice, currentRsi, sym) => {
let type = null;
let msg = '';

// RSI < 30 = Oversold (Buy Signal)
if (currentRsi < 30) {
type = 'BUY';
msg = `🟢 فرصة شراء! ${sym} وصل لمناطق تشبع بيعي (RSI: ${currentRsi.toFixed(1)})`;
}
// RSI > 70 = Overbought (Sell Signal)
else if (currentRsi > 70) {
type = 'SELL';
msg = `🔴 فرصة بيع! ${sym} وصل لمناطق تشبع شرائي (RSI: ${currentRsi.toFixed(1)})`;
}

if (type) {
setAlerts(prev => {
const lastAlert = prev[0];
// Prevent repeated alerts within one minute
const now = Date.now();
if (!lastAlert || (now - lastAlert.id > 60000)) {
return [{ id: now, type, msg, price: currentPrice }, ...prev].slice(0, 20);
}
return prev;
});
}
};

// Cleanup on unmount
useEffect(() => {
return () => {
if (ws.current) ws.current.close();
};
}, []);

return (
<div className="min-h-screen bg-slate-900 text-gray-100 font-sans p-4 md:p-8" dir="rtl">

<div className="max-w-5xl mx-auto">
{/* Header & Config */}
<div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl mb-8">
<div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
<h1 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
<Activity className="w-8 h-8" />
رادار السوق الأمريكي (البيانات الحقيقية)
</h1>
<div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${isConnected ? 'bg-green-900/50 text-green-400 border border-green-500' : 'bg-red-900/50 text-red-400 border border-red-500'}`}>
{isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
{isConnected ? 'متصل بالسوق المباشر' : 'غير متصل'}
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="relative">
<Key className="absolute top-3 right-3 w-4 h-4 text-gray-500" />
<input
type="password"
value={apiKey}
onChange={(e) => setApiKey(e.target.value)}
placeholder="ضع مفتاح Finnhub API هنا"
className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pr-10 pl-4 focus:border-blue-500 outline-none text-sm"
/>
</div>
<input
type="text"
value={symbol}
onChange={(e) => setSymbol(e.target.value.toUpperCase())}
placeholder="رمز السهم (مثلاً AAPL)"
className="bg-slate-900 border border-slate-600 rounded-lg py-2 px-4 focus:border-blue-500 outline-none text-center font-mono uppercase tracking-wider"
/>
{!isConnected ? (
<button
onClick={startMonitoring}
className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
>
<Eye className="w-4 h-4" /> بدء الاتصال
</button>
) : (
<button
onClick={stopMonitoring}
className="bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
>
<WifiOff className="w-4 h-4" /> قطع الاتصال
</button>
)}
</div>

{error && (
<div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded-lg flex items-center gap-2">
<AlertTriangle className="w-4 h-4" />
{error}
</div>
)}

<p className="mt-4 text-xs text-gray-500">
* يتطلب مفتاح مجاني من موقع finnhub.io.
</p>
</div>

{/* Dashboard Components (Chart and Alerts) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

{/* Main Chart Area */}
<div className="lg:col-span-2 space-y-6">
{/* Price Card */}
<div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-end">
<div>
<p className="text-gray-400 text-sm mb-1">سعر {symbol} المباشر</p>
<div className="text-5xl font-bold font-mono text-white tracking-tighter">
{price ? `$${price.toFixed(2)}` : '---'}
</div>
</div>
{rsi && (
<div className={`text-right px-4 py-2 rounded-xl border ${rsi > 70 ? 'bg-red-900/20 border-red-500/50' : rsi < 30 ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-700/50 border-slate-600'}`}>
<div className="text-xs text-gray-400 mb-1">مؤشر القوة RSI</div>
<div className={`text-2xl font-bold ${rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-blue-400'}`}>
{rsi.toFixed(1)}
</div>
</div>
)}
</div>

{/* Chart */}
<div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 h-[400px]">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={data}>
<CartesianGrid strokeDasharray="3 3" stroke="#334155" />
<XAxis dataKey="time" hide />
<YAxis domain={['auto', 'auto']} orientation="right" tick={{fill: '#94a3b8'}} />
<Tooltip
contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }}
itemStyle={{ color: '#fff' }}
/>
<Line
type="monotone"
dataKey="price"
stroke="#3b82f6"
strokeWidth={2}
dot={false}
isAnimationActive={false}
/>
{price && <ReferenceLine y={price} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />}
</LineChart>
</ResponsiveContainer>
</div>
</div>

{/* Alerts Panel */}
<div className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col h-[500px] lg:h-auto">
<div className="p-4 border-b border-slate-700">
<h3 className="font-bold flex items-center gap-2 text-gray-200">
<Bell className="w-5 h-5 text-yellow-500" />
التنبيهات الحية
</h3>
</div>

<div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
{alerts.length === 0 ? (
<div className="h-full flex flex-col items-center justify-center text-gray-600 text-center">
<Activity className="w-10 h-10 mb-2 opacity-50" />
<p className="text-sm">لا توجد فرص حالياً</p>
<p className="text-xs mt-1 opacity-70">المراقبة مستمرة...</p>
</div>
) : (
alerts.map((alert) => (
<div
key={alert.id}
className={`p-3 rounded-lg border-r-4 text-sm ${
alert.type === 'BUY'
? 'bg-green-900/20 border-green-500 text-green-200'
: 'bg-red-900/20 border-red-500 text-red-200'
}`}
>
<div className="flex justify-between items-center mb-1">
<span className="font-bold">{alert.type === 'BUY' ? 'شراء' : 'بيع'}</span>
<span className="text-xs opacity-70">{new Date(alert.id).toLocaleTimeString()}</span>
</div>
<p>{alert.msg}</p>
<div className="mt-1 text-xs opacity-60 font-mono">السعر: {alert.price}</div>
</div>
))
)}
</div>
</div>

</div>
</div>
</div>
);
}
