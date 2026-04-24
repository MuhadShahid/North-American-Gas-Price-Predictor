'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fuel, TrendingUp, TrendingDown, Activity, RefreshCw, Newspaper, AlertTriangle, BrainCircuit } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [news, setNews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<'US' | 'CA'>('US');

  useEffect(() => {
    fetch('/api/predict')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.predictions);
          setNews(res.newsSentiment);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <RefreshCw size={48} className={styles.spinner} />
        <h2 className={styles.title}>Loading Real-Time Data...</h2>
      </div>
    );
  }

  if (!data || !data['Regular']) {
    return (
      <div className={styles.loading}>
        <h2 className={styles.title} style={{color: 'var(--accent-red)'}}>Failed to load data.</h2>
        <p>Please check the API connection or try again later.</p>
      </div>
    );
  }

  const regularData = data['Regular'];
  
  // Base US Prices
  let currentPrice = regularData.historical.find((d: any) => d.label === 'Current')?.price;
  let yesterdayPrice = regularData.historical.find((d: any) => d.label === 'Yesterday')?.price;
  
  let chartData = [
    ...regularData.historical.map((d: any) => ({ name: d.label, price: d.price, isForecast: false })),
    ...regularData.forecast.map((d: any) => ({ name: d.label, predictedPrice: d.price, isForecast: true }))
  ];

  // Canadian Conversion Logic (Simulation: CAD per Liter)
  // US Gallon = 3.785 Liters. USD to CAD = ~1.37
  // Plus a typical ~20% Canadian gas tax premium
  if (region === 'CA') {
    const convert = (usdPerGal: number) => (usdPerGal * 1.37 / 3.785) * 1.20;
    
    currentPrice = convert(currentPrice);
    yesterdayPrice = convert(yesterdayPrice);
    
    chartData = chartData.map(d => ({
      ...d,
      price: d.price ? convert(d.price) : undefined,
      predictedPrice: d.predictedPrice ? convert(d.predictedPrice) : undefined
    }));
  }

  const delta = currentPrice - yesterdayPrice;
  const isUp = delta > 0;

  const unit = region === 'US' ? '/ gal' : '/ L';
  const currency = region === 'US' ? '$' : 'CA$';
  const displayPrice = (val: number) => `${currency}${val.toFixed(3)}`;

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gas Price Predictor</h1>
        <p className={styles.subtitle}>Real-time AI Forecasting based on Live Public Data</p>
        
        <div className={styles.toggleContainer}>
          <button 
            className={`${styles.toggleBtn} ${region === 'US' ? styles.active : ''}`}
            onClick={() => setRegion('US')}
          >
            US (USD/gal)
          </button>
          <button 
            className={`${styles.toggleBtn} ${region === 'CA' ? styles.active : ''}`}
            onClick={() => setRegion('CA')}
          >
            Canada (CAD/L)
          </button>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Current Price Card */}
        <section className={`glass-panel ${styles.card}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Fuel className={styles.cardIcon} />
              National Average (Regular)
            </h2>
            <div className={`${styles.badge} ${isUp ? styles.badgeUp : styles.badgeDown}`}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(delta).toFixed(3)}
            </div>
          </div>
          <div className={styles.priceDisplay}>
            <span className={styles.currentPrice}>{displayPrice(currentPrice)}</span>
            <span className={styles.unit}>{unit}</span>
          </div>
          <p className={styles.subtitle}>
            Updated Today. Yesterday was {displayPrice(yesterdayPrice)}.
          </p>
        </section>

        {/* Prediction Highlight Card */}
        <section className={`glass-panel ${styles.card}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Activity className={styles.cardIcon} />
              7-Day Forecast
            </h2>
          </div>
          <div className={styles.priceDisplay}>
            <span className={styles.currentPrice}>{displayPrice(chartData.find(d => d.name === 'Next Week')?.predictedPrice || 0)}</span>
            <span className={styles.unit}>{unit}</span>
          </div>
          <p className={styles.subtitle}>
            Predicted price for next week based on short-term momentum and moving averages.
          </p>
        </section>
      </div>

      {/* Chart Section */}
      <section className="glass-panel">
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Price Trajectory & Forecast</h2>
        </div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" />
              <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tickFormatter={(val) => displayPrice(val)} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--primary)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-light)' }}
                formatter={(value: number) => [displayPrice(value), 'Price']}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="var(--primary)" 
                strokeWidth={3} 
                dot={{ r: 4, fill: 'var(--bg-color)', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Historical"
              />
              <Line 
                type="monotone" 
                dataKey="predictedPrice" 
                stroke="var(--accent-red)" 
                strokeWidth={3} 
                strokeDasharray="5 5"
                dot={{ r: 4, fill: 'var(--bg-color)', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Forecast"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Breakdown Table */}
      <section className="glass-panel">
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Data Breakdown</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timeline</th>
                <th>Price ({region === 'US' ? 'USD/gal' : 'CAD/L'})</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d: any, i) => (
                <tr key={i}>
                  <td>{d.name}</td>
                  <td style={{ fontWeight: d.name === 'Current' ? '700' : '400', color: d.isForecast ? 'var(--accent-red)' : 'var(--text-main)' }}>
                    {displayPrice(d.price || d.predictedPrice)}
                  </td>
                  <td>
                    {d.isForecast ? (
                      <span className={`${styles.badge} ${styles.badgeUp}`} style={{background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', borderColor: 'transparent'}}>
                        Predicted
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeDown}`} style={{background: 'rgba(102, 252, 241, 0.1)', color: 'var(--primary)', borderColor: 'transparent'}}>
                        Actual
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* News & Geopolitics Section */}
      {news && news.headlines.length > 0 && (
        <section className="glass-panel">
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {news.isLLM ? <BrainCircuit className={styles.cardIcon} /> : <Newspaper className={styles.cardIcon} />}
              Geopolitical News & Market Sentiment
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {news.isLLM && (
                <div className={styles.badge} style={{background: 'rgba(102, 252, 241, 0.15)', color: 'var(--primary)', borderColor: 'rgba(102, 252, 241, 0.3)'}}>
                  AI Powered Analysis
                </div>
              )}
              <div className={`${styles.badge} ${news.riskFactor > 0 ? styles.badgeUp : styles.badgeDown}`}>
                <AlertTriangle size={14} />
                Initial Risk Premium: {news.riskFactor > 0 ? '+' : ''}{displayPrice(news.riskFactor)}
              </div>
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-light)' }}>AI Market Insight</h3>
            <p style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>{news.insight}</p>
            {news.decayTimelineDays && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <strong>Estimated Time to Subside:</strong> ~{news.decayTimelineDays} days (The premium will linearly decay over this timeframe in our forecast model).
              </p>
            )}
          </div>

          <div className={styles.newsList}>
            {news.headlines.map((item: any, i: number) => (
              <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className={styles.newsItem}>
                <span className={styles.newsTitle}>{item.title}</span>
                {!news.isLLM && item.impact && (
                  <div className={styles.newsImpact}>
                    {item.impact === 'Bullish' && <span className={`${styles.badge} ${styles.badgeUp}`}>🔴 Bullish Price Pressure</span>}
                    {item.impact === 'Bearish' && <span className={`${styles.badge} ${styles.badgeDown}`}>🟢 Bearish Price Pressure</span>}
                    {item.impact === 'Neutral' && <span className={styles.badge} style={{background: 'rgba(255,255,255,0.05)'}}>⚪ Neutral</span>}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
