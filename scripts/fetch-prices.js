import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '../static/data/commodity_prices.csv');
const HEADER = 'date,gold_usd,oil_usd';

const FRED_API_KEY = process.env.FRED_API_KEY;
if (!FRED_API_KEY) {
	console.error('FRED_API_KEY environment variable is required');
	process.exit(1);
}

function readExistingDates() {
	if (!fs.existsSync(CSV_PATH)) return new Set();
	return new Set(
		fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n').slice(1).map(l => l.split(',')[0])
	);
}

// Stooq returns CSV: Date,Open,High,Low,Close
async function fetchGoldStooq(startDate, endDate) {
	const d1 = startDate.replace(/-/g, '');
	const d2 = endDate.replace(/-/g, '');
	const url = `https://stooq.com/q/d/l/?s=xauusd&d1=${d1}&d2=${d2}&i=d`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Stooq error ${res.status}`);
	const text = await res.text();
	const rows = text.trim().split('\n').slice(1); // skip header
	return rows.map(line => {
		const [date, , , , close] = line.split(',');
		return { date, price: parseFloat(close) };
	}).filter(r => !isNaN(r.price));
}

// FRED returns JSON observations with value field ('.' = missing)
async function fetchOilFred(startDate) {
	const url = new URL('https://api.stlouisfed.org/fred/series/observations');
	url.searchParams.set('series_id', 'DCOILWTICO');
	url.searchParams.set('api_key', FRED_API_KEY);
	url.searchParams.set('file_type', 'json');
	url.searchParams.set('observation_start', startDate);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`FRED error ${res.status}: ${await res.text()}`);
	const json = await res.json();
	return json.observations
		.filter(o => o.value !== '.')
		.map(o => ({ date: o.date, price: parseFloat(o.value) }));
}

async function main() {
	const isHistory = process.argv.includes('--history');
	const existingDates = readExistingDates();

	let startDate;
	if (isHistory) {
		startDate = '1986-01-02'; // WTI starts 1986-01-02 on FRED; gold on Stooq starts 1978
	} else if (existingDates.size === 0) {
		const d = new Date(Date.now() - 7 * 86400_000);
		startDate = d.toISOString().slice(0, 10);
	} else {
		const last = new Date([...existingDates].sort().at(-1));
		last.setDate(last.getDate() + 1);
		startDate = last.toISOString().slice(0, 10);
	}

	const endDate = new Date().toISOString().slice(0, 10);
	console.log(`Fetching ${startDate} → ${endDate}...`);

	const [goldData, oilData] = await Promise.all([
		fetchGoldStooq(startDate, endDate),
		fetchOilFred(startDate),
	]);

	const oilByDate = new Map(oilData.map(r => [r.date, r.price]));

	const newRows = [];
	for (const { date, price: gold } of goldData) {
		if (existingDates.has(date)) continue;
		const oil = oilByDate.get(date);
		if (oil == null) continue;
		newRows.push(`${date},${gold.toFixed(2)},${oil.toFixed(2)}`);
	}

	if (newRows.length === 0) {
		console.log('No new rows.');
		return;
	}

	if (!fs.existsSync(CSV_PATH)) {
		fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
		fs.writeFileSync(CSV_PATH, HEADER + '\n');
	}
	// Sort before appending to keep CSV in chronological order
	newRows.sort();
	fs.appendFileSync(CSV_PATH, newRows.join('\n') + '\n');
	console.log(`Appended ${newRows.length} rows.`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
