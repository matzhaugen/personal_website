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
	const { nasdaq, t10y2y, unrate, fedfunds, usdyen, recession } = data.macro;

	// Transformations matching the Python chart
	const nasFirst = nasdaq[0]?.[1] ?? 1;
	const nasdaqSeries = nasdaq.map(([date, v]) => ({ date, value: Math.log(v) - Math.log(nasFirst) }));

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

	function tooltipValues(date: string) {
		const ym = date.slice(0, 7);
		const fmt = (v: number | undefined) => v?.toFixed(2) ?? '–';
		return {
			nasdaq:   fmt(nasMap.get(ym)),
			unrate:   fmt(unrateMap.get(ym)),
			fedfunds: fmt(fedfundsMap.get(ym)),
			usdyen:   fmt(usdyenMap.get(ym)),
		};
	}
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
					<div><span style="color: #93c5fd">■</span> Recession (FRED)</div>
				</div>
			{/snippet}
		</Pancake.Point>

	</Pancake.Chart>
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

	/* ── colored dots ────────────────────────────────────────────────────────── */
	.dot         { font-style: normal; }
	.t10y2y-dot  { color: #1d4ed8; }
	.nasdaq-dot  { color: #d97706; }
	.unrate-dot  { color: #16a34a; }
	.fedfunds-dot { color: #dc2626; }
	.usdyen-dot  { color: #7c3aed; }
</style>
