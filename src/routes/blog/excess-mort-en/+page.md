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

The booster is also more strongly associated with increased all-cause-mortality than the first two doses (see figures in Appendix). This might be due to the memory of the human immune system intensifying the autoimmune (self-to-self) attack caused by spike protein production of our own cells post-vaccination (discussed by [Doctors for Covid Ethics, 2022](https://doctors4covidethics.org/boosting-blood-clots-and-leaky-vessels-the-dangers-of-covid-19-vaccines-and-booster-shots/)).

It is interesting to note that less than half of the countries analyzed showed anomalous mortality in the initial Covid wave of March-April 2020 (although there is evidence that covid was endemic before 2020, as early as September 2019, according to [this Italian study](https://journals.sagepub.com/doi/full/10.1177/0300891620974755)) (see also [Elmore et al. 2020](https://www.jmir.org/2020/9/e21562)).

## On causality

While there is a clear association between vaccination and mortality in these results, the question of causation remains. Bradford Hill [argued in 1965](https://journals.sagepub.com/doi/pdf/10.1177/003591576505800503) that 9 criteria could be used as guidelines to be followed in pursuing the question of causality. [Ioannidis (2015)](https://doi.org/10.1002/sim.6825) argued that only 3 of these criteria have been proven to be useful given the literature published since Hill's paper, these being _experiment_, _temporality_, and _consistency_. Thus, we will focus only on these criteria.

_Experiment_: The first criteria relates to the emergence of the claimed effect in a controlled experiment. We now have [more than 1000 papers](https://react19.org/1250-covid-vaccine-reports/) with case reports of adverse effects and death induced after the vaccination, fulfilling this criteria by most standards. In some situations, one could divide this criteria into _in vitro_ and _in vivo_ studies, although given the large body of evidence of harm this might seem redundant. 

_Temporality_, or as Hill says: _‘The temporal relationship of the association – which is the cart and which is the horse?'_. This criteria is at the core of our study. As we have already established visually but without a formal statistical hypothesis test, there seems to be a temporal relationship between our two variables mortality and vaccination at least in the 4 countries shown above. This claim is supported both by the shapes of the curves and the timing wherein vaccination is followed by excess mortality. In other countries it may seem that the delay between the two is larger (see Norway in Appendix figures). There are many reasons to expect a non-linear relationship between the these two variables though: 1. Different demographics received the vaccine at different times, where older people were generally the first group to receive it. 2. There might be multiple pathways through which the vaccine induces harm. For example, there can be short-term anaphylactic shocks while heart complications manifest over longer time scales. 3. Each pathway to harm can be non-linear in time, with a certain window period of heightened risk. These complications render a formal statistical causality analysis tenuous. 

For the statisticians in the audience a linear Granger causality test produces significance at the 1% level for the 4 countries above, and most of the other countries in the data set, but I would not lean heavily on such an argument for the reasons mentioned above. More complicated non-linear tests exist but are outside the scope of this analysis. For further discussions on pitfalls of Granger causality see [G. Grassmann (2020)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7578691/). 

One point worth noting is that with the confidence bands reported in the mortality curves, anything that exceeds these bands should already be significant from a statistical point of view. If vaccination precedes such mortality anomalies, they would trivially be attributed causality. One case in point is the mortality curve of Norway, which never exceeds the confidence bands before vaccination starts but spikes beyond this band and follows the vaccination curve by a 10-week delay (Figure 3), with a linear correlation of 0.21. This clear temporality would be difficult to attribute anything other than vaccination. The Norwegian Health Institute notes the anomalous mortality at the end of 2021 but speculates that it is due to covid deaths, avoiding this large warning signal with regards to vaccination ([FHI (2022)](https://www.fhi.no/nyheter/2022/overdodelighet-pa-7-prosent-i-2022/)).

<figure>
<a target="_blank" href="/excess-mort-en/norway_mortality_vs_vaccine_shifted_mid_age_m_sex.jpg">
  <img class="mort-img" src="/excess-mort-en/norway_mortality_vs_vaccine_shifted_mid_age_m_sex.jpg" alt="mort-vs-vax-nor">
</a>
<figcaption>
  <b> Figure 3 </b> <i> Excess mortality plotted against weekly vaccination doses for ages 15+ from 2020-2022 in Norway: Mortality is plotted in % (in black) and is age standardized to the European Standard Population (100k). Baseline mortality rates are calculated from the period 2013-2019, or the latest available data. Vaccination doses (red) are the sum of all doses. </i>
  </figcaption>
</figure>

_Consistency_: In light of the large variability of adverse effects across batches, expecting consistency across countries might not be realistic. Nevertheless, most countries do show an effect even though the effect is varied in strength and sometimes in timing. Israel is perhaps the most striking example of a consistent spike in mortality followed by vaccination doses, where even smaller features in vaccination rates are mirrored in mortality (see Appendix). 


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
  <b> Figure 4 </b> <i> Excess mortality plotted against weekly vaccination doses for ages 15+ from 2020-2022: Mortality is plotted in % (in black) and is age standardized to the European Standard Population (100k). Baseline mortality rates are calculated from the period 2013-2019, or the latest available data. Vaccination doses (red) are the sum of all doses, including boosters often seen as a secondary peak in the plots.  </i>
  </figcaption>
</figure>


<figure>
<a target="_blank" href="/excess-mort-en/all_countries_mortality_w_trend_b_gender_adult_age.jpg">
  <img class="mort-img-small" src="/excess-mort-en/all_countries_mortality_w_trend_b_gender_adult_age.jpg" alt="excess-mort">
</a>
<figcaption>
  <b> Figure 5 </b> <i> Excess mortality plotted against weekly vaccination doses for ages 15+: Mortality (in black) is age standardized to the European Standard Population (100k). The two trendlines (in gold) are annual and weekly trends, where the annual is a polynomial before 2020 (natural spline w/ 2 degrees of freedom) and constant after 2020 and the weekly trend is another polynomial (spline) with periodic constraints and 4 degrees of freedom across the 52 weeks of the year fitted in the period before 2020. </i>
  </figcaption>
</figure>


## Code availability
All code to calculate age-standardized and de-trended excess mortality is available in [this notebook](https://nbviewer.org/url/www.matzhaugen.com/excess-mort-en/all_countries.ipynb) and the vaccination pre-processing and plotting is available in [this notebook](https://nbviewer.org/url/www.matzhaugen.com/excess-mort-en/all_countries_vacc_py.ipynb).