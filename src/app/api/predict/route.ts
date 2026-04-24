import { NextResponse } from 'next/server';
import { GET as getGasPrices } from '../gas-prices/route';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';

const BULLISH_KEYWORDS = ['conflict', 'war', 'strike', 'opec', 'cut', 'disruption', 'hormuz', 'iran', 'israel', 'middle east', 'shortage', 'escalate', 'attack', 'soar', 'surge'];
const BEARISH_KEYWORDS = ['peace', 'oversupply', 'drop', 'record production', 'ease', 'plunge', 'decline', 'inventory build', 'surplus', 'cheap'];

async function fetchGoogleNewsHeadlines() {
  try {
    const res = await fetch('https://news.google.com/rss/search?q=oil+prices+OR+gasoline+prices+OR+strait+of+hormuz&hl=en-US&gl=US&ceid=US:en', {
      next: { revalidate: 3600 }
    });
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const headlines: Array<{title: string, link: string}> = [];
    $('item').slice(0, 50).each((i, el) => {
      headlines.push({
        title: $(el).find('title').text(),
        link: $(el).find('link').text()
      });
    });
    return headlines;
  } catch (err) {
    console.error('Error fetching news:', err);
    return [];
  }
}

async function getAdvancedSentiment(headlines: Array<{title: string, link: string}>) {
  const isLLMEnabled = !!process.env.GEMINI_API_KEY;

  if (isLLMEnabled) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a quantitative commodities analyst focusing on global gas and oil prices. Read these ${headlines.length} current headlines:\n\n${headlines.map(h => `- ${h.title}`).join('\n')}\n\nAssess the geopolitical risk to gas prices. Will prices go up (risk premium) or down (oversupply)? When will these events subside? Provide a highly analytical insight.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insight: { type: Type.STRING, description: 'A 2-3 sentence highly analytical summary of the geopolitical sentiment and pricing trajectory based on the headlines.' },
              riskFactor: { type: Type.NUMBER, description: 'A number between -0.15 and +0.25 representing the immediate price premium in dollars per gallon.' },
              decayTimelineDays: { type: Type.INTEGER, description: 'Estimated number of days until this specific news cycle/risk fully subsides and prices return to baseline. (e.g. 14 for a quick resolution, 90 for protracted conflict).' },
            },
            required: ['insight', 'riskFactor', 'decayTimelineDays']
          }
        }
      });
      
      const textResponse = response.text || "{}";
      const result = JSON.parse(textResponse);
      
      return {
        isLLM: true,
        headlines,
        insight: result.insight,
        riskFactor: result.riskFactor,
        decayTimelineDays: result.decayTimelineDays
      };
    } catch (err) {
      console.error('LLM API Error, falling back to basic scanner:', err);
    }
  }

  // Fallback to basic keyword scanner
  let totalScore = 0;
  const processedHeadlines = headlines.map(h => {
    const lowerTitle = h.title.toLowerCase();
    let score = 0;
    BULLISH_KEYWORDS.forEach(kw => { if (lowerTitle.includes(kw)) score += 1; });
    BEARISH_KEYWORDS.forEach(kw => { if (lowerTitle.includes(kw)) score -= 1; });
    
    let impact = 'Neutral';
    if (score > 0) impact = 'Bullish';
    if (score < 0) impact = 'Bearish';
    totalScore += score;
    return { ...h, impact, sentiment: score };
  });

  const riskFactor = Math.min(Math.max(totalScore * 0.015, -0.15), 0.25);
  return {
    isLLM: false,
    headlines: processedHeadlines,
    insight: `Basic keyword analysis indicates a ${riskFactor >= 0 ? 'bullish' : 'bearish'} market momentum. Add a GEMINI_API_KEY to your .env.local for advanced LLM decay forecasting.`,
    riskFactor,
    decayTimelineDays: 30 // Flat assumption for basic scanner
  };
}

export async function GET() {
  try {
    const res = await getGasPrices();
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    const { data: gasData } = data;
    const headlines = await fetchGoogleNewsHeadlines();
    const sentimentAnalysis = await getAdvancedSentiment(headlines);
    
    const predictions: Record<string, any> = {};

    const parsePrice = (priceStr: string) => parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    const fuelTypes = Object.keys(gasData['Current Avg.'] || {});

    for (const fuel of fuelTypes) {
      const current = parsePrice(gasData['Current Avg.'][fuel]);
      const weekAgo = parsePrice(gasData['Week Ago Avg.'][fuel]);
      const monthAgo = parsePrice(gasData['Month Ago Avg.'][fuel]);
      const yesterday = parsePrice(gasData['Yesterday Avg.'][fuel]);
      const yearAgo = parsePrice(gasData['Year Ago Avg.'][fuel]);

      const weeklyDelta = current - weekAgo;
      const monthlyDelta = current - monthAgo;

      const baseNextWeek = current + (weeklyDelta * 0.7) + ((monthlyDelta / 4) * 0.3);
      const baseNextMonth = current + monthlyDelta;

      // Apply Geopolitical Risk Factor with Time-Decay
      const { riskFactor, decayTimelineDays } = sentimentAnalysis;
      
      // Linear decay calculation
      const calculateDecayedPremium = (daysOut: number) => {
        if (daysOut >= decayTimelineDays) return 0; // Fully subsided
        const decayRatio = (decayTimelineDays - daysOut) / decayTimelineDays;
        return riskFactor * decayRatio;
      };

      const nextWeekPrediction = baseNextWeek + calculateDecayedPremium(7);
      const nextMonthPrediction = baseNextMonth + calculateDecayedPremium(30);

      predictions[fuel] = {
        historical: [
          { label: 'Year Ago', price: yearAgo },
          { label: 'Month Ago', price: monthAgo },
          { label: 'Week Ago', price: weekAgo },
          { label: 'Yesterday', price: yesterday },
          { label: 'Current', price: current },
        ],
        forecast: [
          { 
            label: 'Next Week', 
            price: parseFloat(nextWeekPrediction.toFixed(3)),
            lower: parseFloat((nextWeekPrediction - 0.04).toFixed(3)),
            upper: parseFloat((nextWeekPrediction + 0.06).toFixed(3))
          },
          { 
            label: 'Next Month', 
            price: parseFloat(nextMonthPrediction.toFixed(3)),
            lower: parseFloat((nextMonthPrediction - 0.12).toFixed(3)),
            upper: parseFloat((nextMonthPrediction + 0.15).toFixed(3))
          }
        ]
      };
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      predictions,
      newsSentiment: sentimentAnalysis
    });

  } catch (error: any) {
    console.error('Error predicting gas prices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
