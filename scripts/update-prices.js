const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'https://north-american-gas-price-predictor.vercel.app/api/predict';
const DATA_FILE = path.join(__dirname, '../data/historical_logs.json');

async function main() {
  console.log(`Fetching latest predictions from ${API_URL}...`);
  
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    
    if (!data.success || !data.predictions || !data.predictions['Regular']) {
      throw new Error('Invalid API response structure');
    }

    const regularData = data.predictions['Regular'];
    
    // Extract actual 'Current' price and predicted 'Next Week' price
    const currentPrice = regularData.historical.find(d => d.label === 'Current')?.price;
    const forecast7d = regularData.forecast.find(d => d.label === 'Next Week')?.price;

    if (!currentPrice || !forecast7d) {
      throw new Error('Missing expected price data in API response');
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Read existing logs
    let logs = [];
    if (fs.existsSync(DATA_FILE)) {
      logs = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    // Check if today is already logged
    const existingLogIndex = logs.findIndex(log => log.date === todayStr);
    
    const newEntry = {
      date: todayStr,
      actual: currentPrice,
      forecast_7d: forecast7d,
      fuel_type: 'Regular'
    };

    if (existingLogIndex !== -1) {
      console.log(`Entry for ${todayStr} already exists. Updating it...`);
      logs[existingLogIndex] = newEntry;
    } else {
      console.log(`Adding new entry for ${todayStr}...`);
      logs.push(newEntry);
    }

    // Keep only the last 90 days to prevent infinite file growth
    if (logs.length > 90) {
      logs = logs.slice(-90);
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(logs, null, 2));
    console.log('Successfully updated historical_logs.json');

  } catch (error) {
    console.error('Failed to update prices:', error);
    process.exit(1);
  }
}

main();
