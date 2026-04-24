'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Clock } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [news, setNews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<'US' | 'CA'>('US');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    fetch('/api/predict')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.predictions);
          setNews(res.newsSentiment);
          setLastUpdated(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
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
        <Activity size={24} className="text-primary" style={{ animation: 'spin 2s linear infinite' }} />
        <span className="micro-label">Connecting to Data Feed...</span>
      </div>
    );
  }

  if (!data || !data['Regular']) {
    return (
      <div className={styles.loading}>
        <span className="micro-label text-red">Connection Error</span>
        <span className="text-muted text-sm">Failed to retrieve upstream pricing data.</span>
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
  const nextWeekTarget = chartData.find(d => d.name === 'Next Week')?.predictedPrice || 0;
  const weeklyDelta = nextWeekTarget - currentPrice;

  const unit = region === 'US' ? '/ gal' : '/ L';
  const currency = region === 'US' ? '$' : 'C$';
  const displayPrice = (val: number) => `${currency}${val.toFixed(3)}`;

  return (
    <main className={styles.dashboard}>
      
      {/* 1. TOP COMMAND BAR */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <h1 className={styles.appName}>North American Gas Monitor</h1>
          <span className={styles.statusBadge}>
            <div className={styles.statusDot}></div> LIVE
          </span>
          <span className={styles.timestamp}><Clock size={12} style={{display:'inline', marginRight: 4}}/> {lastUpdated}</span>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.segmentedControl}>
            <button 
              className={`${styles.segmentBtn} ${region === 'US' ? styles.active : ''}`}
              onClick={() => setRegion('US')}
            >
              US (USD)
            </button>
            <button 
              className={`${styles.segmentBtn} ${region === 'CA' ? styles.active : ''}`}
              onClick={() => setRegion('CA')}
            >
              CA (CAD)
            </button>
          </div>
        </div>
      </header>

      {/* 2. KPI STRIP */}
      <section className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className="micro-label">National Average (Reg)</span>
          <span className={`font-mono ${styles.kpiValue} text-primary`}>{displayPrice(currentPrice)}</span>
          <div className={styles.kpiSub}>
            <span className={`${styles.tag} ${isUp ? styles.tagUp : styles.tagDown}`}>
              {isUp ? '+' : ''}{delta.toFixed(3)}
            </span>
            <span className="text-muted">vs yesterday</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className="micro-label">7-Day Forecast Target</span>
          <span className={`font-mono ${styles.kpiValue} text-light`}>{displayPrice(nextWeekTarget)}</span>
          <div className={styles.kpiSub}>
            <span className={`${styles.tag} ${weeklyDelta > 0 ? styles.tagUp : styles.tagDown}`}>
              {weeklyDelta > 0 ? '+' : ''}{weeklyDelta.toFixed(3)}
            </span>
            <span className="text-muted">expected shift</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className="micro-label">Risk Premium (AI)</span>
          <span className={`font-mono ${styles.kpiValue} ${news?.riskFactor > 0 ? 'text-red' : 'text-green'}`}>
            {news?.riskFactor > 0 ? '+' : ''}{displayPrice(news?.riskFactor || 0)}
          </span>
          <div className={styles.kpiSub}>
            <span className={`${styles.tag} ${styles.tagNeutral}`}>NLP Pricing Model</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <span className="micro-label">Sentiment Horizon</span>
          <span className={`font-mono ${styles.kpiValue} text-light`}>{news?.decayTimelineDays || 30} Days</span>
          <div className={styles.kpiSub}>
            <span className="text-muted">Estimated time to subside</span>
          </div>
        </div>
      </section>

      {/* 3. MAIN GRID (Chart + Intel Rail) */}
      <section className={styles.mainGrid}>
        
        {/* Dominant Chart Panel */}
        <div className={`panel ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <span className="micro-label">Price Trajectory & Trailing Averages</span>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.toFixed(2)} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '2px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}
                  itemStyle={{ color: 'var(--text-light)' }}
                  formatter={(value: any) => [displayPrice(Number(value) || 0), '']}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="var(--text-light)" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'none' }}
                  name="Historical"
                />
                <Line 
                  type="monotone" 
                  dataKey="predictedPrice" 
                  stroke="var(--text-muted)" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--text-light)', stroke: 'none' }}
                  name="Forecast"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Intelligence Rail */}
        <div className={styles.rail}>
          {news && news.isLLM && (
            <div className={`panel ${styles.railPanel}`}>
              <div className={styles.panelHeader}>
                <span className="micro-label text-primary">Model Insight</span>
              </div>
              <div className={styles.insightBody}>
                <p className={styles.insightText}>{news.insight}</p>
                <div className={styles.insightMeta}>
                  <span className="text-muted">Source: Gemini 2.5 Pro</span>
                  <span className={news.riskFactor > 0 ? 'text-red' : 'text-green'}>
                    {news.riskFactor > 0 ? 'BULLISH' : 'BEARISH'} BIAS
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={`panel ${styles.railPanel}`}>
            <div className={styles.panelHeader}>
              <span className="micro-label">News Feed</span>
            </div>
            <div className={styles.feedList}>
              {news?.headlines?.map((item: any, i: number) => (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className={styles.feedItem}>
                  <span className={styles.feedTitle}>{item.title}</span>
                  {!news.isLLM && item.impact && item.impact !== 'Neutral' && (
                    <span className={`micro-label ${item.impact === 'Bullish' ? 'text-red' : 'text-green'}`}>
                      [{item.impact}]
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. LOWER SECTION: DATA TABLE */}
      <section className={`panel ${styles.tableContainer}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timeline Vector</th>
              <th className={styles.numCol}>Base Price</th>
              <th className={styles.numCol}>Adjusted Forecast</th>
              <th>Data Flag</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {chartData.map((d: any, i) => (
              <tr key={i}>
                <td className="text-muted">{d.name}</td>
                <td className={`${styles.numCol} text-light`}>{d.price ? displayPrice(d.price) : '---'}</td>
                <td className={`${styles.numCol} text-primary`}>{d.predictedPrice ? displayPrice(d.predictedPrice) : '---'}</td>
                <td>
                  <span className={`micro-label ${d.isForecast ? 'text-muted' : 'text-light'}`}>
                    {d.isForecast ? 'MODEL_OUTPUT' : 'AAA_ACTUAL'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </main>
  );
}
