'use client';

import { useEffect, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Clock } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [news, setNews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<'US' | 'CA'>('US');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [accuracyData, setAccuracyData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/predict')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res.predictions);
          setNews(res.newsSentiment);
          setAccuracyData(res.accuracyTracker);
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
  
  let chartDataRaw = regularData.historical.map((d: any) => ({
    name: d.label,
    actual: d.price,
    isForecast: false
  }));

  let forecastDataRaw = regularData.forecast.map((d: any) => ({
    name: d.label,
    forecast: d.price,
    range: [d.lower || d.price, d.upper || d.price],
    isForecast: true
  }));

  // Combine and link the historical to the forecast
  let chartData = [...chartDataRaw, ...forecastDataRaw];
  const currentIndex = chartData.findIndex(d => d.name === 'Current');
  if (currentIndex !== -1) {
    chartData[currentIndex].forecast = chartData[currentIndex].actual;
    chartData[currentIndex].range = [chartData[currentIndex].actual, chartData[currentIndex].actual];
  }

  // Canadian Conversion Logic (Simulation: CAD per Liter)
  if (region === 'CA') {
    const convert = (usdPerGal: number) => (usdPerGal * 1.37 / 3.785) * 1.20;
    currentPrice = convert(currentPrice);
    yesterdayPrice = convert(yesterdayPrice);
    chartData = chartData.map(d => ({
      ...d,
      actual: d.actual ? convert(d.actual) : undefined,
      forecast: d.forecast ? convert(d.forecast) : undefined,
      range: d.range ? [convert(d.range[0]), convert(d.range[1])] : undefined
    }));
  }

  const delta = currentPrice - yesterdayPrice;
  const isUp = delta > 0;
  const nextWeekTarget = chartData.find(d => d.name === 'Next Week')?.forecast || 0;
  const weeklyDelta = nextWeekTarget - currentPrice;

  const unit = region === 'US' ? '/ gal' : '/ L';
  const currency = region === 'US' ? '$' : 'C$';
  const displayPrice = (val: number) => `${currency}${val.toFixed(3)}`;

  // Custom Rich Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const isProj = point.isForecast;
      
      return (
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', padding: '12px', borderRadius: '4px', minWidth: '240px', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="micro-label" style={{ color: 'var(--text-light)' }}>{label}</span>
            {isProj ? <span className="micro-label" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 4px', borderRadius: '2px' }}>PROJECTION</span> : <span className="micro-label text-muted">OBSERVED</span>}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'IBM Plex Mono, monospace' }}>
            {point.actual && !isProj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{fontSize: '0.75rem', fontFamily: 'Inter, sans-serif'}}>Settlement Price</span>
                <span className="text-light" style={{fontWeight: 600}}>{displayPrice(point.actual)}</span>
              </div>
            )}
            {point.forecast && isProj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{fontSize: '0.75rem', fontFamily: 'Inter, sans-serif'}}>Model Target</span>
                <span className="text-primary" style={{fontWeight: 600}}>{displayPrice(point.forecast)}</span>
              </div>
            )}
            {point.range && isProj && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{fontSize: '0.75rem', fontFamily: 'Inter, sans-serif'}}>95% CI Range</span>
                <span className="text-muted" style={{fontSize: '0.75rem'}}>{displayPrice(point.range[0])} - {displayPrice(point.range[1])}</span>
              </div>
            )}
            
            {isProj && news && (
              <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{fontSize: '0.75rem', fontFamily: 'Inter, sans-serif'}}>Geopolitics Premium</span>
                <span style={{ fontSize: '0.75rem', color: news.riskFactor > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  {news.riskFactor > 0 ? '+' : ''}{displayPrice(news.riskFactor)}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

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
          <span className="micro-label">Average Model Accuracy</span>
          <span className={`font-mono ${styles.kpiValue} text-light`}>{accuracyData?.averageAccuracy || 'N/A'}%</span>
          <div className={styles.kpiSub}>
            <span className="text-muted">Trailing 14 Days</span>
          </div>
        </div>
      </section>

      {/* 3. MAIN GRID (Chart + Intel Rail) */}
      <section className={styles.mainGrid}>
        
        {/* Dominant Chart Panel */}
        <div className={`panel ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="micro-label text-light">PRICE TRAJECTORY & FORECAST</span>
              <span className="micro-label text-muted" style={{ fontWeight: 400 }}>{region === 'US' ? 'USD/GAL' : 'CAD/L'}</span>
            </div>
            <div className={styles.segmentedControl} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }}>
              <button className={`${styles.segmentBtn}`}>1M</button>
              <button className={`${styles.segmentBtn} ${styles.active}`}>3M</button>
              <button className={`${styles.segmentBtn}`}>1Y</button>
            </div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickMargin={12} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.toFixed(2)} axisLine={false} tickLine={false} width={45} orientation="right" tick={{ fontFamily: 'IBM Plex Mono, monospace' }} />
                
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ stroke: 'var(--surface-border)', strokeWidth: 1, strokeDasharray: '4 4' }} 
                />
                
                {/* Divide Actual vs Forecast */}
                <ReferenceLine x="Current" stroke="var(--text-muted)" strokeDasharray="3 3" strokeOpacity={0.5} label={{ position: 'insideTopLeft', value: 'FORECAST →', fill: 'var(--text-muted)', fontSize: 10, offset: 10 }} />
                
                {/* Confidence Band */}
                <Area 
                  type="monotone" 
                  dataKey="range" 
                  stroke="none" 
                  fill="var(--primary)" 
                  fillOpacity={0.05} 
                  isAnimationActive={false}
                />
                
                {/* Solid Historical Line */}
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="var(--text-light)" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--text-light)', stroke: 'var(--bg-color)', strokeWidth: 2 }}
                  name="Historical"
                />
                
                {/* Dashed Forecast Line */}
                <Line 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="var(--primary)" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--bg-color)', strokeWidth: 2 }}
                  name="Forecast"
                />
              </ComposedChart>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem' }}>
        <section className={`panel ${styles.tableContainer}`}>
          <div className={styles.panelHeader} style={{ borderBottom: '1px solid var(--surface-border)' }}>
            <span className="micro-label">Forecast Timeline Mapping</span>
          </div>
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
              {chartDataRaw.map((d: any, i: number) => (
                <tr key={i}>
                  <td className="text-muted">{d.name}</td>
                  <td className={`${styles.numCol} text-light`}>{d.actual ? displayPrice(d.actual) : '---'}</td>
                  <td className={`${styles.numCol} text-muted`}>---</td>
                  <td><span className="micro-label text-light">OBSERVED</span></td>
                </tr>
              ))}
              {forecastDataRaw.map((d: any, i: number) => (
                <tr key={`f-${i}`}>
                  <td className="text-primary">{d.name}</td>
                  <td className={`${styles.numCol} text-muted`}>---</td>
                  <td className={`${styles.numCol} text-primary`}>{d.forecast ? displayPrice(d.forecast) : '---'}</td>
                  <td><span className="micro-label text-primary">PROJECTED</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {accuracyData && accuracyData.logs && (
          <section className={`panel ${styles.tableContainer}`} style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className={styles.panelHeader} style={{ position: 'sticky', top: 0, background: 'var(--surface-color)', borderBottom: '1px solid var(--surface-border)' }}>
              <span className="micro-label">Historical Accuracy Ledger (14-Day)</span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Target Date</th>
                  <th className={styles.numCol}>7D Projection</th>
                  <th className={styles.numCol}>Settlement</th>
                  <th className={styles.numCol}>Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {accuracyData.logs.map((log: any, i: number) => (
                  <tr key={i}>
                    <td className="text-muted">{log.date}</td>
                    <td className={`${styles.numCol} text-primary`}>{displayPrice(log.forecast)}</td>
                    <td className={`${styles.numCol} text-light`}>{displayPrice(log.actual)}</td>
                    <td className={`${styles.numCol} ${log.variance > 0 ? 'text-red' : 'text-green'}`}>
                      {log.variance > 0 ? '+' : ''}{log.variance.toFixed(3)}
                    </td>
                    <td>
                      <span className="micro-label" style={{
                        color: log.status.includes('MISS') ? 'var(--accent-red)' : log.status === 'DIRECT HIT' ? 'var(--accent-green)' : 'var(--text-light)',
                        background: log.status.includes('MISS') ? 'var(--accent-red-bg)' : log.status === 'DIRECT HIT' ? 'var(--accent-green-bg)' : 'var(--surface-border)',
                        padding: '2px 4px', borderRadius: '2px'
                      }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

    </main>
  );
}
