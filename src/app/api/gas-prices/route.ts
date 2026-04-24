import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  try {
    const res = await fetch('https://gasprices.aaa.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch from AAA: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract the National Average Table
    const data: Record<string, Record<string, string>> = {};
    const headers: string[] = [];

    // Assuming the first table is the National Average table
    $('table').first().find('thead th').each((i, el) => {
      headers.push($(el).text().trim());
    });

    $('table').first().find('tbody tr').each((i, row) => {
      const rowLabel = $(row).find('td').first().text().trim();
      data[rowLabel] = {};
      
      $(row).find('td').each((j, col) => {
        if (j > 0 && headers[j]) {
          data[rowLabel][headers[j]] = $(col).text().trim();
        }
      });
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: 'AAA Gas Prices',
      data,
    });
  } catch (error: any) {
    console.error('Error fetching gas prices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
