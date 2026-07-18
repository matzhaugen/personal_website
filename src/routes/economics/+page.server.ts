import type { PageServerLoad } from './$types';
import fs from 'node:fs';
import path from 'node:path';

export const prerender = true;

export const load: PageServerLoad = async () => {
	let rows: { date: string; gold_usd: number; oil_usd: number }[] = [];
	try {
		rows = fs.readFileSync(path.resolve('static/data/commodity_prices.csv'), 'utf8')
			.trim().split('\n').slice(1)
			.map(line => {
				const [date, gold_usd, oil_usd] = line.split(',');
				return { date, gold_usd: parseFloat(gold_usd), oil_usd: parseFloat(oil_usd) };
			})
			.filter(r => !isNaN(r.gold_usd) && !isNaN(r.oil_usd));
	} catch { /* file not yet generated */ }

	let macro = {
		nasdaq: [], t10y2y: [], unrate: [], fedfunds: [], usdyen: [], recession: [],
		cpi: [], corePce: [], breakeven5y: [], t10y3m: [], hySpread: [], realRate10y: [],
		icsa: [], sp500: [], indpro: [], sox: [], xoi: [],
	};
	try {
		macro = JSON.parse(fs.readFileSync(path.resolve('static/data/macro.json'), 'utf8'));
	} catch { /* file not yet generated */ }

	return { rows, macro };
};
