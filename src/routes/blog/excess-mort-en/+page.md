---
title: Excess mortality compared to vaccination in the covid era 
description: A statistical analysis of excess mortality and vaccination association.
date: Jan 2, 2023
authors: Matz Haugen
language: English
hidden: False
---

Here we investigate at the possible association between excess mortality and vaccination rates. One would expect vaccination to decrease overall mortality in a population but sometimes we see the opposite (Figure 1). Especially the booster doses are closely related to increased mortality. Four countries are picked out as case studies, while the remaining countries are plotted in the Appendix. However, not all countries have the same strong association with mortality. This is likely because only 5% of the vaccine batches appear to have produced [90% of the adverse reactions](https://www.howbadismybatch.com). Some Pfizer batches are associated with 30 x the number of deaths and disabilities compared to other batches. Thus, some countries could have received more of the tainted batches.


<figure>
<a target="_blank" href="/excess-mort-en/special_countries_mortality_vs_booster_adult_age_b_sex.jpg">
  <img class="mort-img" src="/excess-mort-en/special_countries_mortality_vs_booster_adult_age_b_sex.jpg" alt="mort-vs-boost">
</a>
<figcaption>
  <b> Figure 1 </b> <i> Excess mortality plotted against weekly booster vaccination doses for ages 15+ from 2020-2022: Mortality is plotted in % (in black) and is age standardized to the European Standard Population (100k). Confidence intervals at the 95th percentile are shown in dashed lines. Anything outside these are deemed as anomalous mortality rates (5% chance of being random fluctuations). Baseline mortality rates are calculated from the period 2013-2019, or the latest available data. Vaccination doses (red) are 3rd or higher dose for an individual.  </i>
  </figcaption>
</figure>

For ease of comparing mortality rates between countries (Figure 2), the data was age-standardized using a 100k standard population and stripped of its seasonal and long-term trends (see Methodology section). In doing this, we see that there are more deaths occurring in winter than summer for countries far from the equator, which this data set contains many of. 

<figure>
<a target="_blank" href="/excess-mort-en/special_countries_mortality_w_trend_b_gender_adult_age.jpg">
  <img class="mort-img" src="/excess-mort-en/special_countries_mortality_w_trend_b_gender_adult_age.jpg" alt="excess-mort">
</a>
<figcaption>
  <b> Figure 2 </b> <i> Excess mortality plotted for ages 15+: Mortality (in black) is age standardized to the European Standard Population (100k). The two trendlines (in gold) are annual and weekly trends, where the annual is a polynomial before 2020 (natural spline w/ 2 degrees of freedom) and constant after 2020 and the weekly trend is another polynomial (spline) with periodic constraints and 4 degrees of freedom across the 52 weeks of the year fitted in the period before 2020. </i>
  </figcaption>
</figure>

Note also that the booster is more strongly associated with increased all-cause-mortality than the first two doses (see appendix). This might be due to the memory of the human immune system intensifying the self-to-self attack caused by spike protein production of our own cells post-vaccination (discussed by [Doctors for Covid Ethics, 2022](https://doctors4covidethics.org/boosting-blood-clots-and-leaky-vessels-the-dangers-of-covid-19-vaccines-and-booster-shots/)).

Finally, it is interesting to note that less than half of the countries analyzed showed anomalous mortality in the initial Covid wave of March-April 2020 (although there is evidence that covid was endemic before 2020, as early as September 2019, according to [this Italian study](https://journals.sagepub.com/doi/full/10.1177/0300891620974755)) (see also [Elmore et al. 2020](https://www.jmir.org/2020/9/e21562)).

## Methodology

We obtain mortality data from the [Short-term Mortality Fluctuations](https://www.mortality.org/Data/STMF) (STMF) data series maintained by the [Human Mortality Database](https://www.mortality.org/Home/Index), while the vaccination data is obtained from the Our World In Data [Covid-19 dataset](https://github.com/owid/covid-19-data) available to the public as [a csv file](https://github.com/owid/covid-19-data/raw/master/public/data/vaccinations/vaccinations.csv). 

The mortality data is first converted to mortality rates for each age bracket where population is linearly interpolated from each end-of-year tally. The rates are then smoothed with a windowed average of 3 weeks with twice the weight on the middle week compared to the edge weeks. This reduces the missing values to 1% which is filled in with nearest preceding neighbors. Rates are then converted to numbers of deaths through the [European Standard Population](https://www.opendata.nhs.scot/dataset/standard-populations/resource/edee9731-daf7-4e0d-b525-e4c1469b8f69) which normalizes to a population of 100k. 

We then estimate annual trends using a reasonably smooth [polynomial](https://en.wikipedia.org/wiki/Spline_(mathematics)#Algorithm_for_computing_natural_cubic_splines) (with 2 degrees of freedom). Weekly trends are similarly estimated with periodic polynomials. The estimation procedure we chose was [quantile regression](https://en.wikipedia.org/wiki/Quantile_regression), where the estimate is the median while the confidence interval is the 95th confidence band ([R. Koenker, 2022](https://cran.r-project.org/web/packages/quantreg/quantreg.pdf)). We chose this due the its robustness and ability to be stable in light of outliers. The fit uses only data before 2020 as this was before the covid outbreak, which is the period to which we compare the post-2020 era. Thus, the annual trend is assumed constant after 2020, and the weekly trend estimation excludes all data post 2020.  

Vaccine numbers are end-of-week tallies ([ISO weeks](https://en.wikipedia.org/wiki/ISO_week_date)). Because vaccination is not reported by age bracket, we omit mortality numbers in the 0-15 year age bracket for accuracy of comparison. 

The smoothing parameters for the annual and weekly smoothing was cross-validated by fitting the model on all-but-one year sequentially holding out one year at the time in the 2013-2020 data set. We find that the estimated 95% confidence interval has an out-of-sample adjustment to between 80-100% depending on country (plots not shown). This means that the confidence intervals are reasonably accurate in the out-of-sample data. Similarly, the confidence interval is chosen to be a constant offset from the trendline as adding any more complexity (in the form of a polynomial) reduces the out-of-sample exceedence probability (plots not shown).

## Appendix - All countries

<figure>
<a target="_blank" href="/excess-mort-en/all_countries_mortality_vs_vax_adult_age_b_sex.jpg">
  <img class="mort-img-small" src="/excess-mort-en/all_countries_mortality_vs_vax_adult_age_b_sex.jpg" alt="mort-vs-vax">
</a>
<figcaption>
  <b> Figure 3 </b> <i> Excess mortality plotted against weekly vaccination doses for ages 15+ from 2020-2022: Mortality is plotted in % (in black) and is age standardized to the European Standard Population (100k). Baseline mortality rates are calculated from the period 2013-2019, or the latest available data. Vaccination doses (red) are the sum of all doses, including boosters often seen as a secondary peak in the plots.  </i>
  </figcaption>
</figure>


<figure>
<a target="_blank" href="/excess-mort-en/all_countries_mortality_w_trend_b_gender_adult_age.jpg">
  <img class="mort-img-small" src="/excess-mort-en/all_countries_mortality_w_trend_b_gender_adult_age.jpg" alt="excess-mort">
</a>
<figcaption>
  <b> Figure 4 </b> <i> Excess mortality plotted against weekly vaccination doses for ages 15+: Mortality (in black) is age standardized to the European Standard Population (100k). The two trendlines (in gold) are annual and weekly trends, where the annual is a polynomial before 2020 (natural spline w/ 2 degrees of freedom) and constant after 2020 and the weekly trend is another polynomial (spline) with periodic constraints and 4 degrees of freedom across the 52 weeks of the year fitted in the period before 2020. </i>
  </figcaption>
</figure>



