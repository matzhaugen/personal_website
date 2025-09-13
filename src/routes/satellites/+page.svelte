<!-- Using Pancake by Rich Harris: https://github.com/Rich-Harris/pancake/ -->
<svelte:head>
 <title>Sattelites</title>
</svelte:head>
<h1>Sattelites</h1>

<script lang="ts">

    import * as Pancake from '@sveltejs/pancake';
    import { timeParse, timeFormat } from 'd3-time-format';
    const parseDate = (d: string) => new Date(d);

    import csv from "csvtojson";
    import { onMount } from 'svelte';

    const url = `/satellite_data.csv`
    const combineArrays = (first: string[], second: any[]) => {
       return first.reduce((acc: any, val: string, ind: number) => {
          acc[val] = second[ind];
          return acc;
       }, {});
    };

    const months = 'Jan Feb Mar Apr May June July Aug Sept Oct Nov Dec'.split(' ');
    const format = (date: number) => {
        const year = ~~date;
        const month = Math.floor((date % 1) * 12);
        return `${months[month]} ${year}`;
    };

    const parse = (datestr: string) => {
        const date = parseDate(datestr)
        const year = date.getFullYear();
        const ms = date.getTime() - (new Date(year, 1, 1)).getTime();
        const yearMs = (new Date(year + 1, 1, 1)).getTime() - (new Date(year, 1, 1)).getTime()
        return year + ms / yearMs
    };

    import rawData from './satellite_data.js';
    const sorted = rawData.sort((a: any, b: any) => new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime())

    
    let starlink = sorted.filter(row => row.Name.indexOf("STARLINK") !== -1 && row.Status.indexOf("ORBIT") !== -1)
    
    const oneweb = sorted.filter(row => row.Name.indexOf("ONEWEB") !== -1 && row.Status.indexOf("ORBIT") !== -1)
    
    const starlink_count = starlink.map(row => row.launchDate).reduce((r: any, c: string) => (r[c] = (r[c] || 0) + 1, r), {})
    const oneweb_count = oneweb.map(row => row.launchDate).reduce((r: any, c: string) => (r[c] = (r[c] || 0) + 1, r), {})
    const starlink_dates = Object.keys(starlink_count)
    const starlink_values = Object.values(starlink_count)

    const starlink_arr = Object.entries(starlink_count).map((val, idx) => {return {date: val[0], count: val[1], type: "Starlink"}})
    const oneweb_arr = Object.entries(oneweb_count).map((val, idx) => {return {date: val[0], count: val[1], type: "Oneweb"}})
    const all_arr = [...starlink_arr, ...oneweb_arr]

    const maxx = Math.max(...all_arr.map(d => parseDate(d.date).getFullYear())) + 0.3;
    const minx = Math.min(...all_arr.map(d => parseDate(d.date).getFullYear()));
    const miny = 0;
    const maxy = Math.max(...all_arr.map((d: any) => d.count))*1.05;
    const midx = (maxx + minx) / 2;

    const pc = (date: number) => {
        return 100 * (date - minx) / (maxx - minx);
    };

</script>

<div class="chart">
<Pancake.Chart x1={minx} x2={maxx} y1={miny} y2={maxy}>
    <Pancake.Grid horizontal={true} count={5}  >
        {#snippet children({ value, last }: { value: any, last: boolean })}
                        <div class="grid-line horizontal"><span>{value} {last ? 'satellites' : ''}</span></div>
                            {/snippet}
                </Pancake.Grid>

    <Pancake.Grid vertical count={4} >
        {#snippet children({ value }: { value: any })}
                        <div class="grid-line vertical"></div>
            <span class="year-label">{value}</span>
                            {/snippet}
                </Pancake.Grid>


    <Pancake.Svg>
        <Pancake.SvgScatterplot data={starlink_arr} x="{(d: any) => parse(d.date)}" y="{(d: any) => d.count}" >
            {#snippet children({ d }: { d: any })}
                                <path class="starlink avg" {d}/>
                                        {/snippet}
                        </Pancake.SvgScatterplot>
        <Pancake.SvgScatterplot data={oneweb_arr} x="{(d: any) => parse(d.date)}" y="{(d: any) => d.count}" >
            {#snippet children({ d }: { d: any })}
                                <path class="oneweb avg" {d}/>
                                        {/snippet}
                        </Pancake.SvgScatterplot>

    </Pancake.Svg>
    <Pancake.Quadtree data={all_arr} x="{(d: any) => parse(d.date)}" y="{(d: any) => d.count}" >
        {#snippet children({ closest }: { closest: any })}
                        {#if closest}
                <Pancake.Point x={parse(closest.date)} y={closest.count} >
                    {#snippet children({ d }: { d: any })}
                                        <div class="focus"></div>
                        <div class="tooltip" style="transform: translate(-{pc(closest.date)}%,0)">
                            <strong>{closest.type}</strong> 
                            <span>{closest.count} {closest.count === 1 ? "satellite" : 'satellites'}</span>
                            <div><span>{closest.date}</span></div>
                        </div>
                                                        {/snippet}
                                </Pancake.Point>
            {/if}
                            {/snippet}
                </Pancake.Quadtree>

    <!-- chart title -->
        <Pancake.Point x={2019} y={40}>
            <div class="text">
                <h2>Low-Earth Orbit Satellite Launches</h2>

                <p>
                    <span style="color: #676778; opacity: 0.5">•</span>
                    <span>Starlink&nbsp;&nbsp;&nbsp;</span>
                    <span style="color: #0000ff; opacity: 0.5">•</span>
                    <span>Oneweb</span>
                </p>
            </div>
        </Pancake.Point>

    <!-- note -->
        <Pancake.Point x={2022.5} y={2}>
            <div class="text" style="right: 0; text-align: right;">
                <p><em>Satellites/payloads in orbit</em></p>
                <p><em>Source: www.n2yo.com</em></p>
            </div>
        </Pancake.Point>

    </Pancake.Chart>
</div>

<style>
    .chart {
        height: 450px;
        padding: 3em 0 2em 2em;
        margin: 0 0 36px 0;
        max-width: 80em;
        margin: 0 auto;
    }
    .grid-line {
        position: relative;
        display: block;
    }
    .grid-line.horizontal {
        width: calc(100% + 2em);
        left: -2em;
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
        font-size: 16px;
        color: #999;
    }
    .year-label {
        position: absolute;
        width: 4em;
        left: -2em;
        bottom: -30px;
        font-family: sans-serif;
        font-size: 16px;
        color: #999;
        text-align: center;
    }
    .text {
        position: absolute;
        width: 15em;
        line-height: 1;
        color: #666;
        transform: translate(0,-50%);
        text-shadow: 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white;
    }
    .text p {
        margin: 0;
        line-height: 1.2;
        color: #999;
    }
    .text h2 {
        margin: 0;
        font-size: 1.4em;
    }
    path.starlink {
        stroke: #676778;
        opacity: 0.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-width: 10px;
        fill: none;
    }
    path.oneweb {
        stroke: #0000ff;
        opacity: 0.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-width: 10px;
        fill: none;
    }
    path.scatter {
        stroke-width: 3px;
    }
    path.trend {
        stroke: #ff3e00;
        stroke-linejoin: round;
        stroke-linecap: round;
        stroke-width: 10px;
        fill: none;
    }
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
        width: 8em;
        bottom: 1.1em;
        /* background-color: white; */
        line-height: 1.2;
        text-shadow: 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white;
    }
    .tooltip strong {
        font-size: 1.4em;
        display: block;
    }
    @media (min-width: 800px) {
        .chart {
            height: 600px;
        }
    }
</style>
