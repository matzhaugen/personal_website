<svelte:head>
	<title>Economics</title>
</svelte:head>
<h1>Economics</h1>

<script lang="ts">
	import * as Pancake from '@sveltejs/pancake';

	interface Row {
		date: string;
		gold_usd: number;
		oil_usd: number;
	}

	interface MacroData {
		nasdaq: [string, number][];
		t10y2y: [string, number][];
		unrate: [string, number][];
		fedfunds: [string, number][];
		usdyen: [string, number][];
		recession: [string, number][];
		cpi: [string, number][];
		corePce: [string, number][];
		breakeven5y: [string, number][];
		t10y3m: [string, number][];
		hySpread: [string, number][];
		realRate10y: [string, number][];
		icsa: [string, number][];
		sp500: [string, number][];
		indpro: [string, number][];
	}

	interface Props {
		data: { rows: Row[]; macro: MacroData };
	}

	let { data }: Props = $props();

	// ── shared helpers ─────────────────────────────────────────────────────────
	type Point = { date: string; value: number };
	const xAcc = (d: Point) => parse(d.date);
	const yAcc = (d: Point) => d.value;

	const parse = (datestr: string) => {
		const d = new Date(datestr);
		const year = d.getFullYear();
		const ms = d.getTime() - new Date(year, 1, 1).getTime();
		const yearMs = new Date(year + 1, 1, 1).getTime() - new Date(year, 1, 1).getTime();
		return year + ms / yearMs;
	};

	// ── commodity charts ───────────────────────────────────────────────────────
	const rows = data.rows;

	const oilInGold = rows.map(r => ({ date: r.date, value: r.oil_usd / r.gold_usd }));
	const dollarInGold = rows.map(r => ({ date: r.date, value: 1 / r.gold_usd }));

	const parsedDates = rows.map(r => parse(r.date));
	const comMinx = parsedDates.reduce((a, b) => Math.min(a, b), 2020);
	const comMaxx = parsedDates.reduce((a, b) => Math.max(a, b), 2020) + 0.1;
	const comPC = (x: number) => 100 * (x - comMinx) / (comMaxx - comMinx);

	const oilMaxy = oilInGold.reduce((a, d) => Math.max(a, d.value), 0.05) * 1.1;
	const dollarMaxy = dollarInGold.reduce((a, d) => Math.max(a, d.value), 0.001) * 1.1;

	// ── macro chart ────────────────────────────────────────────────────────────
	const { nasdaq, t10y2y, unrate, fedfunds, usdyen, recession,
	        cpi, corePce, breakeven5y, t10y3m, hySpread, realRate10y, icsa,
	        sp500, indpro } = data.macro;

	// Gold: aggregate daily rows to monthly (last entry per month), then log-index
	// Done first so we can use goldFirst as the shared index base for NASDAQ too.
	const goldMonthly: Point[] = [];
	for (const r of rows) {
		const ym = r.date.slice(0, 7);
		if (goldMonthly.at(-1)?.date.slice(0, 7) === ym) goldMonthly.at(-1)!.value = r.gold_usd;
		else goldMonthly.push({ date: r.date, value: r.gold_usd });
	}
	const goldFirst = goldMonthly[0]?.value ?? 1;
	const goldStartDate = goldMonthly[0]?.date ?? '';
	const goldSeries = goldMonthly.map(({ date, value }) => ({ date, value: Math.log(value) - Math.log(goldFirst) }));

	// Index NASDAQ to the same start date as gold for direct comparison
	const nasRef = nasdaq.find(([d]) => d >= goldStartDate)?.[1] ?? nasdaq[0]?.[1] ?? 1;
	const nasdaqSeries = nasdaq
		.filter(([d]) => d >= goldStartDate)
		.map(([date, v]) => ({ date, value: Math.log(v) - Math.log(nasRef) }));

	const t10y2ySeries = t10y2y.map(([date, v]) => ({ date, value: v }));

	const unrateRef = unrate.find(([d]) => d.startsWith('2020-01'))?.[1] ?? 1;
	const unrateSeries = unrate.map(([date, v]) => ({ date, value: v / unrateRef }));

	const fedfundsSeries = fedfunds.map(([date, v]) => ({ date, value: v / 5 }));

	// DEXJPUS is JPY per USD; indexed to 2025-06, ×3
	const usdyenRef =
		usdyen.find(([d]) => d.startsWith('2025-06'))?.[1] ?? usdyen.at(-1)?.[1] ?? 1;
	const usdyenSeries = usdyen.map(([date, v]) => ({ date, value: (v / usdyenRef) * 3 }));


	// Recession shaded regions (JHDUSRGDPBR: quarterly 0/1)
	type Period = { start: string; end: string };
	function recessionPeriods(series: [string, number][]): Period[] {
		const out: Period[] = [];
		let start: string | null = null;
		for (const [date, val] of series) {
			if (val === 1 && start === null) start = date;
			else if (val === 0 && start !== null) {
				out.push({ start, end: date });
				start = null;
			}
		}
		if (start !== null) out.push({ start, end: series.at(-1)![0] });
		return out;
	}
	const recPeriods = recessionPeriods(recession);

	// Chart bounds
	const macroMinx = parse('1976-01-01');
	const macroMaxx = parse(new Date().toISOString().slice(0, 10)) + 0.1;
	const macroMiny = -3;
	const macroMaxy = 8;
	const macroPC = (x: number) => 100 * (x - macroMinx) / (macroMaxx - macroMinx);

	// Tooltip lookup maps — keyed by YYYY-MM, values already transformed
	const nasMap      = new Map(nasdaqSeries.map(d => [d.date.slice(0, 7), d.value]));
	const unrateMap   = new Map(unrateSeries.map(d => [d.date.slice(0, 7), d.value]));
	const fedfundsMap = new Map(fedfundsSeries.map(d => [d.date.slice(0, 7), d.value]));
	const usdyenMap   = new Map(usdyenSeries.map(d => [d.date.slice(0, 7), d.value]));
	const goldMap     = new Map(goldSeries.map(d => [d.date.slice(0, 7), d.value]));

	function tooltipValues(date: string) {
		const ym = date.slice(0, 7);
		const fmt = (v: number | undefined) => v?.toFixed(2) ?? '–';
		return {
			nasdaq:   fmt(nasMap.get(ym)),
			unrate:   fmt(unrateMap.get(ym)),
			fedfunds: fmt(fedfundsMap.get(ym)),
			usdyen:   fmt(usdyenMap.get(ym)),
			gold:     fmt(goldMap.get(ym)),
		};
	}

	// ── indicator dashboard ────────────────────────────────────────────────────
	// Compute YoY % change for a monthly level series
	function computeYoY(series: [string, number][]): [string, number][] {
		return series.slice(12).map(([date, v], i) => [date, ((v - series[i][1]) / Math.abs(series[i][1])) * 100]);
	}

	const cpiYoY = computeYoY(cpi);
	const pceYoY = computeYoY(corePce);
	const indproYoY = computeYoY(indpro);

	// Percentile rank of value within array (0–100)
	function pctRank(values: number[], val: number): number {
		const sorted = [...values].sort((a, b) => a - b);
		const below = sorted.filter(v => v <= val).length;
		return (below / sorted.length) * 100;
	}

	// Last N years of a series
	function last20yr(series: [string, number][]): number[] {
		const cutoff = new Date();
		cutoff.setFullYear(cutoff.getFullYear() - 20);
		const cutStr = cutoff.toISOString().slice(0, 10);
		return series.filter(([d]) => d >= cutStr).map(([, v]) => v);
	}

	type Signal = 'green' | 'yellow' | 'red';

	function sig(pct: number, dir: 'goodHigh' | 'goodLow'): Signal {
		if (dir === 'goodHigh') return pct >= 75 ? 'green' : pct <= 25 ? 'red' : 'yellow';
		return pct <= 25 ? 'green' : pct >= 75 ? 'red' : 'yellow';
	}

	function last(s: [string, number][]): number { return s.at(-1)?.[1] ?? 0; }
	function nBack(s: [string, number][], n: number): number { return s.at(-n)?.[1] ?? 0; }
	function fmtPp(diff: number): string { return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp`; }
	function fmtPct(v: number): string { return `${v.toFixed(1)}%`; }

	type DashRow = { label: string; value: string; change: string; signal: Signal; note: string };

	const dashRows: DashRow[] = [
		// Inflation
		(() => {
			const cur = last(pceYoY);
			const diff = cur - nBack(pceYoY, 13);
			const pct = pctRank(last20yr(pceYoY), cur);
			return { label: 'Core PCE (YoY)', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: "Fed's inflation target" };
		})(),
		(() => {
			const cur = last(cpiYoY);
			const diff = cur - nBack(cpiYoY, 13);
			const pct = pctRank(last20yr(cpiYoY), cur);
			return { label: 'CPI (YoY)', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'Headline consumer prices' };
		})(),
		(() => {
			const cur = last(breakeven5y);
			const diff = cur - nBack(breakeven5y, 53);
			const pct = pctRank(last20yr(breakeven5y), cur);
			return { label: '5yr Breakeven', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'Market inflation expectation' };
		})(),
		// Spreads & rates
		(() => {
			const cur = last(t10y3m);
			const diff = cur - nBack(t10y3m, 53);
			const hist = last20yr(t10y3m);
			const pct = pctRank(hist, cur);
			return { label: '10y−3m Spread', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodHigh'), note: 'Recession predictor (Estrella-Mishkin)' };
		})(),
		(() => {
			const cur = last(t10y2y);
			const diff = cur - nBack(t10y2y, 53);
			const pct = pctRank(last20yr(t10y2y), cur);
			return { label: '10y−2y Spread', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodHigh'), note: 'Yield curve' };
		})(),
		(() => {
			const cur = last(hySpread);
			const diff = cur - nBack(hySpread, 53);
			const pct = pctRank(last20yr(hySpread), cur);
			return { label: 'HY Credit Spread', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'Financial stress; widens before recessions' };
		})(),
		(() => {
			const cur = last(realRate10y);
			const diff = cur - nBack(realRate10y, 53);
			const pct = pctRank(last20yr(realRate10y), cur);
			return { label: '10yr TIPS Real Rate', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'Real interest rate; gold proxy' };
		})(),
		// Labor
		(() => {
			const cur = last(icsa) / 1000;
			const prev = nBack(icsa, 53) / 1000;
			const diff = cur - prev;
			const pct = pctRank(last20yr(icsa).map(v => v / 1000), cur);
			return { label: 'Initial Claims', value: `${cur.toFixed(0)}K`, change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'Weekly jobless claims; leads UNRATE' };
		})(),
		(() => {
			const cur = last(unrate);
			const diff = cur - nBack(unrate, 13);
			const pct = pctRank(last20yr(unrate), cur);
			return { label: 'Unemployment', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodLow'), note: 'U-3 unemployment rate' };
		})(),
		// Output & equity
		(() => {
			const cur = last(indproYoY);
			const diff = cur - nBack(indproYoY, 13);
			const pct = pctRank(last20yr(indproYoY), cur);
			return { label: 'Industrial Production (YoY)', value: fmtPct(cur), change: fmtPp(diff), signal: sig(pct, 'goodHigh'), note: 'Real economy pulse' };
		})(),
		(() => {
			const cur = last(sp500);
			const prev = nBack(sp500, 13);
			const pct1yr = ((cur - prev) / prev) * 100;
			const returns = sp500.slice(12).map(([, v], i) => ((v - sp500[i][1]) / sp500[i][1]) * 100);
			const rpct = pctRank(returns.slice(-240), pct1yr);
			return { label: 'S&P 500', value: cur.toFixed(0), change: fmtPct(pct1yr), signal: sig(rpct, 'goodHigh'), note: 'Broad equity market' };
		})(),
		(() => {
			const cur = rows.at(-1)?.gold_usd ?? 0;
			const oneYrAgo = new Date(rows.at(-1)!.date);
			oneYrAgo.setFullYear(oneYrAgo.getFullYear() - 1);
			const oneYrAgoStr = oneYrAgo.toISOString().slice(0, 10);
			const prevRow = rows.findLast(r => r.date <= oneYrAgoStr);
			const prev = prevRow?.gold_usd ?? cur;
			const pct1yr = ((cur - prev) / prev) * 100;
			const step = 252;
			const returns = rows.slice(step).map((r, i) => ((r.gold_usd - rows[i].gold_usd) / rows[i].gold_usd) * 100);
			const rpct = pctRank(returns.slice(-240 * 5), pct1yr);
			return { label: 'Gold', value: `$${cur.toFixed(0)}/oz`, change: fmtPct(pct1yr), signal: sig(rpct, 'goodHigh'), note: 'XAU/USD spot price' };
		})(),
	];
</script>

<!-- ── Chart 1: Oil in Gold ─────────────────────────────────────────────────── -->
<div class="chart">
	<Pancake.Chart x1={comMinx} x2={comMaxx} y1={0} y2={oilMaxy}>
		<Pancake.Grid horizontal count={5}>
			{#snippet children({ value, last }: { value: number; last: boolean })}
				<div class="grid-line horizontal">
					<span>{value.toFixed(4)}{last ? ' oz/barrel' : ''}</span>
				</div>
			{/snippet}
		</Pancake.Grid>
		<Pancake.Grid vertical count={5}>
			{#snippet children({ value }: { value: number })}
				<div class="grid-line vertical"></div>
				<span class="year-label">{~~value}</span>
			{/snippet}
		</Pancake.Grid>
		<Pancake.Svg>
			<Pancake.SvgLine
				data={oilInGold}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="line oil" {d} />
				{/snippet}
			</Pancake.SvgLine>
		</Pancake.Svg>
		<Pancake.Quadtree
			data={oilInGold}
			x={(d: { date: string; value: number }) => parse(d.date)}
			y={(d: { date: string; value: number }) => d.value}
		>
			{#snippet children({ closest }: { closest: any })}
				{#if closest}
					<Pancake.Point x={parse(closest.date)} y={closest.value}>
						{#snippet children()}
							<div class="focus"></div>
							<div class="tooltip" style="transform: translate(-{comPC(parse(closest.date))}%,0)">
								<strong>{closest.value.toFixed(4)}</strong>
								<span>oz gold / barrel oil</span>
								<div><span>{closest.date}</span></div>
							</div>
						{/snippet}
					</Pancake.Point>
				{/if}
			{/snippet}
		</Pancake.Quadtree>
		<Pancake.Point x={comMaxx - (comMaxx - comMinx) * 0.02} y={oilMaxy * 0.9}>
			{#snippet children()}
				<div class="label-text label-right">
					<h2>Oil Priced in Gold</h2>
					<p>Barrels of oil per troy oz of gold</p>
					<p><em>Source: Stooq (XAU/USD), FRED (DCOILWTICO)</em></p>
				</div>
			{/snippet}
		</Pancake.Point>
	</Pancake.Chart>
</div>

<!-- ── Chart 2: Dollar in Gold ──────────────────────────────────────────────── -->
<div class="chart">
	<Pancake.Chart x1={comMinx} x2={comMaxx} y1={0} y2={dollarMaxy}>
		<Pancake.Grid horizontal count={5}>
			{#snippet children({ value, last }: { value: number; last: boolean })}
				<div class="grid-line horizontal">
					<span>{value.toFixed(5)}{last ? ' oz/$' : ''}</span>
				</div>
			{/snippet}
		</Pancake.Grid>
		<Pancake.Grid vertical count={5}>
			{#snippet children({ value }: { value: number })}
				<div class="grid-line vertical"></div>
				<span class="year-label">{~~value}</span>
			{/snippet}
		</Pancake.Grid>
		<Pancake.Svg>
			<Pancake.SvgLine
				data={dollarInGold}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="line dollar" {d} />
				{/snippet}
			</Pancake.SvgLine>
		</Pancake.Svg>
		<Pancake.Quadtree
			data={dollarInGold}
			x={(d: { date: string; value: number }) => parse(d.date)}
			y={(d: { date: string; value: number }) => d.value}
		>
			{#snippet children({ closest }: { closest: any })}
				{#if closest}
					<Pancake.Point x={parse(closest.date)} y={closest.value}>
						{#snippet children()}
							<div class="focus"></div>
							<div class="tooltip" style="transform: translate(-{comPC(parse(closest.date))}%,0)">
								<strong>{closest.value.toFixed(6)}</strong>
								<span>oz gold / dollar</span>
								<div><span>{closest.date}</span></div>
							</div>
						{/snippet}
					</Pancake.Point>
				{/if}
			{/snippet}
		</Pancake.Quadtree>
		<Pancake.Point x={comMaxx - (comMaxx - comMinx) * 0.02} y={dollarMaxy * 0.9}>
			{#snippet children()}
				<div class="label-text label-right">
					<h2>Dollar Priced in Gold</h2>
					<p>Troy oz of gold per US dollar</p>
					<p><em>Source: Stooq (XAU/USD)</em></p>
				</div>
			{/snippet}
		</Pancake.Point>
	</Pancake.Chart>
</div>

<!-- ── Chart 3: Macro-trends ────────────────────────────────────────────────── -->
<div class="chart macro-chart">
	<Pancake.Chart x1={macroMinx} x2={macroMaxx} y1={macroMiny} y2={macroMaxy}>

		<!-- Recession shading -->
		{#each recPeriods as period}
			<Pancake.Box
				x1={parse(period.start)}
				x2={parse(period.end)}
				y1={macroMiny}
				y2={macroMaxy}
			>
				<div class="recession-shade"></div>
			</Pancake.Box>
		{/each}

		<Pancake.Grid horizontal count={7}>
			{#snippet children({ value }: { value: number })}
				<div class="grid-line horizontal"><span>{value}</span></div>
			{/snippet}
		</Pancake.Grid>
		<Pancake.Grid vertical count={6}>
			{#snippet children({ value }: { value: number })}
				<div class="grid-line vertical"></div>
				<span class="year-label">{~~value}</span>
			{/snippet}
		</Pancake.Grid>

		<Pancake.Svg>
			<!-- Nasdaq log-indexed (orange) -->
			<Pancake.SvgLine
				data={nasdaqSeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line nasdaq" {d} />
				{/snippet}
			</Pancake.SvgLine>

			<!-- T10Y2Y (blue) -->
			<Pancake.SvgLine
				data={t10y2ySeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line t10y2y" {d} />
				{/snippet}
			</Pancake.SvgLine>

			<!-- Unemployment indexed (green) -->
			<Pancake.SvgLine
				data={unrateSeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line unrate" {d} />
				{/snippet}
			</Pancake.SvgLine>

			<!-- Fed funds / 5 (red) -->
			<Pancake.SvgLine
				data={fedfundsSeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line fedfunds" {d} />
				{/snippet}
			</Pancake.SvgLine>

			<!-- USD/Yen indexed (purple) -->
			<Pancake.SvgLine
				data={usdyenSeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line usdyen" {d} />
				{/snippet}
			</Pancake.SvgLine>

			<!-- Gold log-indexed (gold) -->
			<Pancake.SvgLine
				data={goldSeries}
				x={xAcc}
				y={yAcc}
			>
				{#snippet children({ d }: { d: string })}
					<path class="macro-line gold" {d} />
				{/snippet}
			</Pancake.SvgLine>
		</Pancake.Svg>

		<!-- Hover tooltip on T10Y2Y (most granular series) -->
		<Pancake.Quadtree
			data={t10y2ySeries}
			x={(d: { date: string; value: number }) => parse(d.date)}
			y={(d: { date: string; value: number }) => d.value}
		>
			{#snippet children({ closest }: { closest: any })}
				{#if closest}
					{@const tv = tooltipValues(closest.date)}
					<Pancake.Point x={parse(closest.date)} y={closest.value}>
						{#snippet children()}
							<div class="focus"></div>
							<div class="macro-tooltip" style="transform: translate(-{macroPC(parse(closest.date))}%,0)">
								<strong>{closest.date}</strong>
								<table><tbody>
									<tr><td class="dot t10y2y-dot">●</td><td>10y−2y</td><td>{closest.value.toFixed(2)}</td></tr>
									<tr><td class="dot nasdaq-dot">●</td><td>NASDAQ (log)</td><td>{tv.nasdaq}</td></tr>
									<tr><td class="dot unrate-dot">●</td><td>Unemployment</td><td>{tv.unrate}</td></tr>
									<tr><td class="dot fedfunds-dot">●</td><td>Fed rate / 5</td><td>{tv.fedfunds}</td></tr>
									<tr><td class="dot usdyen-dot">●</td><td>JPY/USD ×3</td><td>{tv.usdyen}</td></tr>
									<tr><td class="dot gold-dot">●</td><td>Gold (log)</td><td>{tv.gold}</td></tr>
								</tbody></table>
							</div>
						{/snippet}
					</Pancake.Point>
				{/if}
			{/snippet}
		</Pancake.Quadtree>

		<!-- Title -->
		<Pancake.Point x={macroMaxx - (macroMaxx - macroMinx) * 0.02} y={macroMaxy * 0.97}>
			{#snippet children()}
				<div class="label-text label-right">
					<h2>Macro-trends</h2>
					<p><em>Source: FRED</em></p>
				</div>
			{/snippet}
		</Pancake.Point>

		<!-- Legend: upper-centre where data is sparse -->
		<Pancake.Point x={1993} y={6.2}>
			{#snippet children()}
				<div class="macro-legend">
					<div><span class="dot t10y2y-dot">●</span> 10y−2y treasury spread</div>
					<div><span class="dot nasdaq-dot">●</span> NASDAQ (log-indexed)</div>
					<div><span class="dot unrate-dot">●</span> Unemployment (indexed to Jan 2020)</div>
					<div><span class="dot fedfunds-dot">●</span> Fed funds rate ÷ 5</div>
					<div><span class="dot usdyen-dot">●</span> JPY/USD (indexed to Jun 2025, ×3)</div>
					<div><span class="dot gold-dot">●</span> Gold (log-indexed to 1986)</div>
					<div><span style="color: #93c5fd">■</span> Recession (FRED)</div>
				</div>
			{/snippet}
		</Pancake.Point>

	</Pancake.Chart>
</div>

<!-- ── Chart 4: Indicator Dashboard ────────────────────────────────────────── -->
<div class="dashboard">
	<h2>Macro Indicator Dashboard</h2>
	<p class="dash-subtitle">Signal: percentile rank vs last 20 years — green ≤ 25th, red ≥ 75th (direction-adjusted)</p>
	<table class="dash-table">
		<thead>
			<tr>
				<th>Indicator</th>
				<th>Current</th>
				<th>1yr change</th>
				<th>Signal</th>
				<th class="note-col">Note</th>
			</tr>
		</thead>
		<tbody>
			{#each dashRows as row}
				<tr>
					<td class="dash-label">{row.label}</td>
					<td class="dash-value">{row.value}</td>
					<td class="dash-change">{row.change}</td>
					<td class="dash-signal">
						<span class="signal-dot signal-{row.signal}">●</span>
					</td>
					<td class="note-col dash-note">{row.note}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="dash-source"><em>Source: FRED (PCEPILFE, CPIAUCSL, T5YIE, T10Y3M, T10Y2Y, BAMLH0A0HYM2, DFII10, ICSA, UNRATE, INDPRO, SP500)</em></p>
</div>

<style>
	/* ── layout ──────────────────────────────────────────────────────────────── */
	.chart {
		height: 450px;
		padding: 3em 0 2em 3em;
		margin: 0 auto 36px;
		max-width: 80em;
	}
	.macro-chart {
		height: 500px;
	}
	@media (min-width: 800px) {
		.chart { height: 600px; }
		.macro-chart { height: 650px; }
	}

	/* ── grid ────────────────────────────────────────────────────────────────── */
	.grid-line {
		position: relative;
		display: block;
	}
	.grid-line.horizontal {
		width: calc(100% + 3em);
		left: -3em;
		border-bottom: 1px dashed #ccc;
	}
	.grid-line.vertical {
		height: 100%;
		border-left: 1px dashed #ccc;
	}
	.grid-line span {
		position: absolute;
		left: 0;
		bottom: 2px;
		line-height: 1;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
	}
	.year-label {
		position: absolute;
		width: 4em;
		left: -2em;
		bottom: -30px;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
		text-align: center;
	}

	/* ── commodity lines ─────────────────────────────────────────────────────── */
	path.line {
		stroke-linejoin: round;
		stroke-linecap: round;
		stroke-width: 2px;
		fill: none;
	}
	path.oil    { stroke: #b45309; }
	path.dollar { stroke: #1d4ed8; }

	/* ── macro lines ─────────────────────────────────────────────────────────── */
	path.macro-line {
		stroke-linejoin: round;
		stroke-linecap: round;
		stroke-width: 1.5px;
		fill: none;
	}
	path.t10y2y  { stroke: #1d4ed8; }
	path.nasdaq  { stroke: #d97706; }
	path.unrate  { stroke: #16a34a; }
	path.fedfunds { stroke: #dc2626; }
	path.usdyen  { stroke: #7c3aed; }
	path.gold    { stroke: #ca8a04; }

	/* ── recession shading ───────────────────────────────────────────────────── */
	.recession-shade {
		width: 100%;
		height: 100%;
		background: rgba(147, 197, 253, 0.35);
	}

	/* ── labels & tooltips ───────────────────────────────────────────────────── */
	.label-text {
		position: absolute;
		width: 18em;
		line-height: 1;
		color: #666;
		transform: translate(0, -50%);
		text-shadow: 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white,
			0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white;
	}
	.label-text.label-right {
		transform: translate(-100%, -50%);
		text-align: right;
	}
	.label-text h2 { margin: 0; font-size: 1.4em; }
	.label-text p  { margin: 0; line-height: 1.4; color: #999; }

	.focus {
		position: absolute;
		width: 10px;
		height: 10px;
		left: -5px;
		top: -5px;
		border: 1px solid black;
		border-radius: 50%;
		box-sizing: border-box;
	}
	.tooltip {
		color: #666;
		position: absolute;
		white-space: nowrap;
		width: 10em;
		bottom: 1.1em;
		line-height: 1.2;
		text-shadow: 0 0 10px white, 0 0 10px white, 0 0 10px white,
			0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white;
	}
	.tooltip strong { font-size: 1.4em; display: block; }

	.macro-tooltip {
		position: absolute;
		bottom: 1.2em;
		white-space: nowrap;
		font-family: sans-serif;
		font-size: 13px;
		line-height: 1.4;
		color: #444;
		text-shadow: 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white,
			0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white;
	}
	.macro-tooltip strong { display: block; font-size: 1.1em; margin-bottom: 3px; }
	.macro-tooltip table { border-collapse: collapse; }
	.macro-tooltip td { padding: 1px 4px; }
	.macro-tooltip td:last-child { text-align: right; font-weight: 600; }

	.macro-legend {
		position: absolute;
		font-family: sans-serif;
		font-size: 11px;
		line-height: 1.6;
		color: #555;
		white-space: nowrap;
		transform: translate(-50%, -100%);
		text-shadow: 0 0 6px white, 0 0 6px white, 0 0 6px white, 0 0 6px white,
			0 0 6px white, 0 0 6px white, 0 0 6px white, 0 0 6px white;
	}

	/* ── indicator dashboard ─────────────────────────────────────────────────── */
	.dashboard {
		max-width: 80em;
		margin: 0 auto 36px;
		padding: 0 1em;
	}
	.dashboard h2 { margin-bottom: 0.25em; }
	.dash-subtitle {
		font-size: 13px;
		color: #999;
		margin: 0 0 1em;
	}
	.dash-table {
		width: 100%;
		border-collapse: collapse;
		font-family: sans-serif;
		font-size: 14px;
	}
	.dash-table thead tr {
		border-bottom: 2px solid #ddd;
	}
	.dash-table th {
		text-align: left;
		padding: 6px 10px;
		color: #666;
		font-weight: 600;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.dash-table tbody tr {
		border-bottom: 1px solid #f0f0f0;
	}
	.dash-table tbody tr:hover { background: #fafafa; }
	.dash-table td { padding: 7px 10px; }
	.dash-label { color: #333; font-weight: 500; }
	.dash-value { font-variant-numeric: tabular-nums; font-weight: 600; }
	.dash-change { font-variant-numeric: tabular-nums; color: #888; font-size: 13px; }
	.dash-signal { text-align: center; }
	.dash-note { color: #999; font-size: 12px; }
	.note-col { display: none; }
	@media (min-width: 700px) { .note-col { display: table-cell; } }
	.signal-dot { font-style: normal; font-size: 18px; }
	.signal-green  { color: #16a34a; }
	.signal-yellow { color: #d97706; }
	.signal-red    { color: #dc2626; }
	.dash-source { font-size: 12px; color: #bbb; margin-top: 0.75em; }

	/* ── colored dots ────────────────────────────────────────────────────────── */
	.dot         { font-style: normal; }
	.t10y2y-dot  { color: #1d4ed8; }
	.nasdaq-dot  { color: #d97706; }
	.unrate-dot  { color: #16a34a; }
	.fedfunds-dot { color: #dc2626; }
	.usdyen-dot  { color: #7c3aed; }
	.gold-dot    { color: #ca8a04; }
</style>
