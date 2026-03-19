import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.resolve(__dirname, '../static/data/macro.json');

const FRED_API_KEY = process.env.FRED_API_KEY;
if (!FRED_API_KEY) {
	console.error('FRED_API_KEY environment variable is required');
	process.exit(1);
}

async function fetchFred(seriesId, startDate = '1976-01-01', frequency = null) {
	const url = new URL('https://api.stlouisfed.org/fred/series/observations');
	url.searchParams.set('series_id', seriesId);
	url.searchParams.set('api_key', FRED_API_KEY);
	url.searchParams.set('file_type', 'json');
	url.searchParams.set('observation_start', startDate);
	if (frequency) {
		url.searchParams.set('frequency', frequency);
		url.searchParams.set('aggregation_method', 'avg');
	}
	const res = await fetch(url);
	if (!res.ok) throw new Error(`FRED ${seriesId} error ${res.status}: ${await res.text()}`);
	const json = await res.json();
	return json.observations
		.filter(o => o.value !== '.')
		.map(o => [o.date, parseFloat(o.value)]);
}

async function main() {
	console.log('Fetching macro data from FRED...');

	const [
		nasdaq, t10y2y, unrate, fedfunds, usdyen, recession,
		cpi, corePce, breakeven5y, t10y3m, hySpread, realRate10y, icsa,
		sp500, indpro,
	] = await Promise.all([
		fetchFred('NASDAQCOM', '1976-01-01', 'm'),
		fetchFred('T10Y2Y', '1976-01-01', 'w'),
		fetchFred('UNRATE', '1976-01-01'),
		fetchFred('FEDFUNDS', '1976-01-01'),
		fetchFred('DEXJPUS', '1976-01-01', 'm'),
		fetchFred('JHDUSRGDPBR', '1976-01-01'),
		fetchFred('CPIAUCSL', '1976-01-01'),
		fetchFred('PCEPILFE', '1976-01-01'),
		fetchFred('T5YIE', '2003-01-01', 'w'),
		fetchFred('T10Y3M', '1982-01-01', 'w'),
		fetchFred('BAMLH0A0HYM2', '1997-01-01', 'w'),
		fetchFred('DFII10', '2003-01-01', 'w'),
		fetchFred('ICSA', '1976-01-01'),
		fetchFred('SP500', '1999-01-01', 'm'),
		fetchFred('INDPRO', '1976-01-01'),
	]);

	const data = {
		nasdaq, t10y2y, unrate, fedfunds, usdyen, recession,
		cpi, corePce, breakeven5y, t10y3m, hySpread, realRate10y, icsa,
		sp500, indpro,
	};

	fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
	fs.writeFileSync(JSON_PATH, JSON.stringify(data));

	console.log(
		`Saved macro.json — nasdaq:${nasdaq.length} t10y2y:${t10y2y.length} ` +
		`unrate:${unrate.length} fedfunds:${fedfunds.length} ` +
		`usdyen:${usdyen.length} recession:${recession.length} ` +
		`cpi:${cpi.length} corePce:${corePce.length} ` +
		`breakeven5y:${breakeven5y.length} t10y3m:${t10y3m.length} ` +
		`hySpread:${hySpread.length} realRate10y:${realRate10y.length} ` +
		`icsa:${icsa.length} sp500:${sp500.length} indpro:${indpro.length}`
	);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
