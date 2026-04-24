const fs = require('fs');
const path = require('path');

const currentBasePrice = 3.65; // Approximate current national average
const logs = [];

for (let i = 14; i >= 1; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().split('T')[0];
  
  const pseudoRandom = Math.sin(i * 1234.5); 
  const actual = currentBasePrice + (pseudoRandom * 0.10);
  
  const forecastError = (Math.cos(i * 5678.9) * 0.06);
  const forecast = actual + forecastError;
  
  logs.push({
    date: dateStr,
    actual: parseFloat(actual.toFixed(3)),
    forecast_7d: parseFloat(forecast.toFixed(3)),
    fuel_type: 'Regular'
  });
}

const dir = path.join(__dirname, '../data');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

fs.writeFileSync(path.join(dir, 'historical_logs.json'), JSON.stringify(logs, null, 2));
console.log('Successfully seeded data/historical_logs.json');
