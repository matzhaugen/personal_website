---
title: Covid in Figures
description: Plotting mortality patterns during the covid pandemic
date: July 29, 2026
authors: Matz Haugen
language: English
hidden: False
---

<script>
  import Figure from '../../../components/figure.svelte';
  import VideoFigure from '../../../components/video-figure.svelte';
</script>

<Figure src="/covid-mortality/statewide_excess_grid" n="1" alt="Excess mortality by state, grid of panels">
  <i>Excess mortality by state in the USA. The y-axis is excess mortality relative to the mean of 2015-2019, measured in percent.</i>
</Figure>

<VideoFigure src="/covid-mortality/statewide_excess_map" n="2" loop fps={209 / 20}>
  <i>Excess mortality by state over time, animated.</i>
</VideoFigure>

<Figure src="/covid-mortality/statewide_excess_top_states" n="3" alt="Weekly excess deaths for the twelve largest states">
  <i>The twelve states with the most deaths, in absolute weekly excess rather than percent. Each panel is scaled to itself, so compare shapes rather than heights: California's single vast winter-2020 peak against Texas's three roughly equal waves, and New York and New Jersey's April 2020 spikes that never recur.</i>
</Figure>

<Figure src="/covid-mortality/statewide_excess_bottom_states" n="4" alt="Weekly excess deaths for the twelve smallest states">
  <i>The twelve states with the fewest deaths, on the same absolute scale per panel. With only a few hundred deaths a week the series are far noisier, and the shaded band — twice the 2015-2019 mid-range — is correspondingly wide.</i>
</Figure>

<Figure src="/covid-mortality/statewide_flu_excess_grid" n="5" alt="Excess mortality by state, grid of panels">
  <i>Excess flu-like mortality by state in the USA. The y-axis is excess mortality relative to the mean of 2015-2019, measured in percent.</i>
</Figure>

<Figure src="/covid-mortality/statewide_nonflu_excess_grid" n="6" alt="Excess mortality by state, grid of panels">
  <i>Excess non-flu-like mortality by state in the USA. The y-axis is excess mortality relative to the mean of 2015-2019, measured in percent.</i>
</Figure>

<Figure src="/covid-mortality/statewide_excess_by_state" n="7" alt="Excess deaths by state, ranked bar charts">
  <i>Cumulative excess deaths per state over 2020-2021, ranked in absolute terms and as a share of expected deaths. Texas and California lead on count; Arizona and New York City lead on share.</i>
</Figure>

## Europe

The same method applied to Europe, using weekly all-cause counts from the Human Mortality Database. Excess is measured against the same 2015-2019 weekly baseline, so these are directly comparable to the American figures above.

<Figure src="/covid-mortality/europe_excess_grid" n="8" alt="Excess mortality by European country, grid of panels">
  <i>Excess mortality by country, arranged so the grid reads roughly as a map: Iceland top left, the Nordics along the top, the Baltics stacked down the right, the Balkans bottom right. Eastern Europe carries much larger and longer winter waves than the Nordics.</i>
</Figure>

<VideoFigure src="/covid-mortality/europe_excess_map" n="9" loop fps={209 / 20}>
  <i>Excess mortality across Europe, week by week. Countries in grey have no data in the Human Mortality Database.</i>
</VideoFigure>

<Figure src="/covid-mortality/europe_excess_ranked" n="10" alt="Excess deaths by European country, ranked bar charts">
  <i>Cumulative excess deaths over 2020-2021. Bulgaria, Poland and Slovakia are worst hit as a share of expected deaths, at around a quarter above normal; Norway, Iceland and Sweden barely move.</i>
</Figure>

## Reported COVID deaths, and what they miss

Excess mortality counts every death above the expected level, whatever its cause. Reported COVID deaths count only those certified to the virus. The two are not the same number, and the gap between them varies enormously between countries.

<Figure src="/covid-mortality/europe_covid_grid" n="11" alt="Reported COVID-19 deaths by European country, grid of panels">
  <i>Reported COVID-19 deaths per 100k population, on the same country layout as Figure 8.</i>
</Figure>

<VideoFigure src="/covid-mortality/europe_covid_map" n="12" loop fps={201 / 20}>
  <i>Reported COVID-19 deaths per 100k across Europe, week by week.</i>
</VideoFigure>

<Figure src="/covid-mortality/europe_compare_countries" n="13" alt="Excess deaths versus reported COVID deaths per European country">
  <i>Both series on one shared axis per country — they are in the same units, so the vertical gap is meaningful. Where blue sits above orange, excess deaths went uncertified: Russia's winter wave reaches nearly 19,000 a week against barely 3,000 reported. Where orange sits above blue, as in Sweden's spring 2021 wave, more COVID deaths were reported than the country had excess mortality at all.</i>
</Figure>

## The world

Excess mortality cannot be computed globally — the Human Mortality Database covers 38 mostly high-income countries, so there is no worldwide all-cause baseline. What does exist worldwide is reported COVID deaths, which is a different and less complete measure.

<VideoFigure src="/covid-mortality/world_covid_per100k_map" n="14" loop fps={201 / 20}>
  <i>Reported COVID-19 deaths per 100k population, week by week. Scaling by population makes countries comparable regardless of size; in absolute counts the map would largely just track where people live.</i>
</VideoFigure>

<Figure src="/covid-mortality/world_covid_countries" n="15" alt="Weekly reported COVID-19 deaths for the 20 worst-affected countries">
  <i>The twenty countries with the most reported deaths, arranged north-to-south and west-to-east. Which countries appear is decided by death count; where they sit is geography.</i>
</Figure>

<Figure src="/covid-mortality/world_covid_ranked" n="16" alt="Reported COVID-19 deaths by country, ranked two ways">
  <i>The two rankings pick out almost entirely different countries. By count it is the largest nations; per head of population it is Peru, Bulgaria and Bosnia.</i>
</Figure>

## Sources

The American figures are built from CDC/NCHS weekly all-cause death counts by state. Two datasets are joined to span the whole period: the first supplies the 2015-2019 baseline, the second the pandemic years.

- [Weekly Counts of Deaths by State and Select Causes, 2014-2019](https://data.cdc.gov/NCHS/Weekly-Counts-of-Deaths-by-State-and-Select-Causes/3yf8-kanr) — CDC/NCHS
- [Provisional COVID-19 Death Counts by Week Ending Date and State, 2020-2021](https://data.cdc.gov/NCHS/Provisional-COVID-19-Death-Counts-by-Week-Ending-D/r8kw-7aab) — CDC/NCHS

The European excess-mortality figures use weekly all-cause counts from the Human Mortality Database, and every reported-COVID figure comes from the Johns Hopkins CSSE repository, which also supplies the populations used for the per-capita rates.

- [Short-Term Mortality Fluctuations (STMF)](https://www.mortality.org/Data/STMF) — Human Mortality Database
- [COVID-19 Data Repository](https://github.com/CSSEGISandData/COVID-19) — JHU CSSE

Country outlines are from [Natural Earth](https://www.naturalearthdata.com/) via [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector).

