---
title: Overdødelighet i Norge 2018-2021
description: En statistisk analyse.
date: Mar 17, 2022
authors: Matz Haugen
language: Norwegian
hidden: False
---

Hvordan går man frem for å estimere overdødsfallsrater over tid med nøyaktige konfidensintervaller? 
Dette er nyttig ettersom det kan svare på spørsmål om hvor dødelig pandemien var i 2020-2021, så vel som effekten av vaksinen for å redusere disse dødsfallene. 
I denne analysen, begrenser vi oss til aldersgruppen 65+ siden denne aldersgruppen har økt risiko for å dø og er mer følsomme for endringer i det indre og ytre miljøet. 
Norge er et interessant land å studere siden det hadde en relativt lav dødelighet i den innledende pandemibølgen i mars 2020 og har god statistikk tilgjengelig for analyse fra Statistisk Sentralbyrå (SSB). 
Sammen med den relativt lille befolkningen gjør dette Norge til en god kandidat til å teste hvor bra konfidensintervaller er estimert. 
Vi bruker også alle dødsårssaker siden disse ikke har noen skjevfordeling med hensyn til diagnostisering.

Vi ser at den første pandemibølgen var så vidt over det normale mens siste halvdel av 2021 hadde en markant høy dødelighet (Figur 1). Vi ser også at vaksinen ikke nødvendigvis har begrenset dødsfall i 2021, selv om det er vanskelig å trekke faste konklusjoner. Ettersom pandemibølgen faktisk startet litt under basisestimatet, kan det være et tegn på at overdødelighetsestimatet er konservativt. Første halvdel har en dødelighet under basisestimatet. Det kan tenkes at den høye dødeligheten på slutten av året er etterslep på den tidligere lave dødeligheten, men det er 35% av ukene i 2021 som er over 95% konfidensintervallet, mens bare 23% er under. Vi bruker 95% som en konservativ grense for hva som er normalt. Dette estimatet kan tolkes som grensen man må over for at det er 5% sjanse for at estimatet er høyt ved en tilfeldighet eller tilfeldig variasjon, basert på tidligere dødelighetstall som vi her inkluderer med årene 2001-2021 (se Figur 5).

<!-- How does one go about estimating excess death over time with accurate confidence intervals (Figure 1)? This is useful information as it can answer questions about how deadly the pandemic was in 2020-2021 as well as the efficacy of the vaccine in reducing these deaths. We will constrain ourselves to ages 65+ since this age group is at hightened risk of dying and more sensitive to changes in the internal and external environment. Norway is an intersting country to study since it had a relatively low mortality in the initial pandemic wave in March 2020 and it has good statistics available for analysis. Coupled with the relatively small population this makes Norway a good candidate to test how well confidens intervals are estimated. -->

<figure>
<img alt=one src="/excess-mort-nor/norway_excess_deaths_pois.png" width="650">
<figcaption> <b> Figur 1: </b> <i> Overdødsfall for personer over 65 år i Norge etter aldersstandardisering og fjernet sesong- og tiårstrend. Basisestimat er sentrert til x-aksen beregnet med kvaltilregresjon. Trender er robust tilpasset ved den 50. kvantilen, mens konfidensintervallet passer til henholdsvis 97,5 % og 2,5 % kvantilen. Vaksinasjonsdata er lagt over for samme aldersgruppe, atskilt med injeksjonsnummer. </i> </figcaption>
</figure>

Fordi vi bruker observasjonsbaserte kvantiler i konfidensestimatet vil det være en vertikal asymmetri over og under basis estimatet (x-aksen i Figur 1). 
Fordelen med denne metodikken er at vi får nøyaktig konfidensdekning på observasjonene, som testes i perioden 2001-2019. 
Dette er beskrevet i detalj i neste seksjon. 


## Statistisk metodikk

For å estimere overdødelighet er det nødvendig å bruke aldersstandardisert dødelighet ved først å estimere dødeligheten for hver aldersgruppe. Det vil også gjøre at hver aldersgruppe er uavhengig av hverandre siden vi korrigerer for befolkningstall. 
Befolkningsdata samles inn for hvert år og interpoleres med et ukentlig intervall. En relativt jevn befolkningsendring oppnås for hver aldersgruppe, med de største aldersgruppene i de yngre parentesene (Figur 2). 
Disse befolkningsantallene gjør det mulig å beregne dødelighetsrater (Figur 3). 

<!-- To estimate excess mortality, it is necessary to use age-standardized numbers by first estimating mortality rates for each age group. 
Population data is collected for each year and interpolated at a weekly cadence. A relatively smooth population change is obtained for each age group, with the largest age groups in the younger brackets (Figure 2).
 -->
<figure>
<img alt=two src="/excess-mort-nor/population_rates.png" width="650">
<figcaption> <b> Figur 2: </b> <i> Befolkning i Norge 2001-2022. Data samles inn årlig ved slutten av hvert år og interpoleres til en ukentlig oppløsning.</i> </figcaption>
</figure>


<figure>
<img alt=three src="/excess-mort-nor/norway_mortality_rates.png" width="650">
<figcaption> <b> Figur 3: </b> <i> Dødeligheten er delt inn i aldersgrupper. Øverst: Naturlig-logg-transformerte dødelighetsrater. Nederst: Rå dødelighetsrater. Enheter er forskjellige i y-aksen på grunn av transformasjonen, dette for å vise både den lineære økningen i dødelighet med alderen og den tilsvarende endringen i tidsvariansen. Legg merke til på toppen hvordan variansen er lavest i middelalderen.   </i> </figcaption>
</figure>


Det viser seg at dødelighetsrater øker eksponensielt med alder etter ca. 25 år (Figur 4), et velkjent fenomen som først ble oppdaget av Gompertz i 1825 ([Winsor 1932](https://www.ncbi.nlm.nih.gov/labs/pmc/articles/PMC1076153/)). Loven kan tolkes som at overlevningsraten synker i en geometrisk sekvens for hvert år som går til den går til null. 
En annen ting som er interessant er at variansen er rimelig konstant i de voksne aldersgruppene, men bare i dette logg-transformerte domenet, som viser til at det er i dette domenet vi burde gjøre vår analyse, som også gjøres av andre (f. eks. [N. Islam (2021)](https://www.bmj.com/content/373/bmj.n1137.long)). Merk også at barnegruppene har både høyere varians og en mer uforutsigbar trend.

<!-- <figure>
<img src="/excess-mort-nor/weekly_deaths_variance.png" width="650">
<figcaption> <b> Figur 3: </b> <i> Ukentlig gjennomsnitt og varians for dødelighetsdata fra 2001-2022, delt inn i aldersgrupper på 5 år. </i> </figcaption>
</figure> -->

<figure>
<img alt=four src="/excess-mort-nor/norway_gompertz_law_ln_mortality_rates.png" width="650">
<figcaption> <b> Figur 4: </b> <i> Gompertz lov om dødelighet i Norge: Logg-transformerte dødsrater plottet mot alder ved bruk av en 5-års aldersgruppe. Gjennomsnittsalderen tas som observasjon på abscissen, og vises med en lineær trend med et vektet kvadratisk residual etter 30 år og en tredje grads polynom (også kalt naturlig "spline") med 4 frihetsgrader før 30 år. </i> </figcaption>
</figure>

Med alderstandardiserte rater kan vi summere aldersgrupper med den Europeiske aldersgruppemalen (European Standard Population, ESP), som har en befokningsfordeling for en standard befolkning på 100,000 mennesker (se f.eks. [Public Health Scotland](https://www.opendata.nhs.scot/dataset/standard-populations/resource/edee9731-daf7-4e0d-b525-e4c1469b8f69)). Summen av de relevante aldersgruppene viser at vi har hatt en generell nedgang i dødsfall i disse aldersgruppene de siste 20 årene (Figur 5).

For å estimere en trendlinje bruker vi en model som har både en tiårig og en sesongbasert trend, der begge antas å være tredjegrads polynomer (også kalt "splines"). 
Med disse polynomene finner vi estimatet ved å minimere de absolutte avviksdistansene fra trendlinjen, som kalles [*kvantilregresjon*](https://cran.r-project.org/web/packages/quantreg/index.html). 
For å være ekstra konservativ anntar vi at det er en konstant tiårstrend etter 2020.


<figure>
<img alt=five src="/excess-mort-nor/norway_ln_mort_rate_2001_2021.png" width="650">
<figcaption> <b> Figur 5: </b> <i> Logg-transformert dødelighet for personer over 65 år i Norge etter aldersstandardisering, ved bruk av standard befolkning i 5-års aldersgrupper (ESP). En trend er lagt til med to splines, én for tiårstrender (4 frihetsgrader) og én for sesongmessige trender (7 frihetsgrader). Det antas en konstant trend i årene 2020-2021.  </i> </figcaption>
</figure>

Fordi Norge har gode statistiske kilder har vi observasjoner helt tilbake til 2001, noe man kan bruke til å estimere dekningen til konfidensintervallet ved å variere modellens kompleksitet. Det kan gjøres på følgende måte:

1. Estimer en tiårig trend men kvantilregresjon fra 2001-2019 og trekk fra denne trenden så alle år er på samme basisnivå.
2. Fjern et år og estimer på samme måte sesongtrenden samt konfidenskvantiler, 2.5% og 97.5%.
3. Beregn hvor mange observasjoner i teståret som er utenfor konfidensintervallet.
4. Gjenta steg 2-3 for alle år og oppsummer resultat.
5. Gjenta steg 2-4 med forskjellige frihetsgrader i polynomene.
6. Den frihetsgraden som er minst og dekker det antatte konfidensintervallet er den mest sparsommelige modellen med nøyaktig dekning.

Vi gjør denne estimeringsprosessen og ser at 6-8 frihetsgrader er en god modellkompleksitet, sett at denne modellen dekker 95% av observasjonene i en periode modellen ikke er trenert på (Figur 6). Slik kan man da si med økt sikkerhet at konfidensintervallet er stødig i perioden etter 2020. Disse konklusjonene holder også om man tar ut Covid-dødsfall fra observasjonene (Figur 7).

<!-- Når man trekker fra denne trenden og transformerer observasjonene tilbake til de orginale tallene kan man se at de følger en tilnærmet Poisson fordeling, som støtter grunnlaget til model-valget der vi jobber i logg-domenet (Figur 6).

<figure>
<img src="/excess-mort-nor/detrended_mortality.png" width="650">
<figcaption> <b> Figur 6: </b> <i> Histogram over ukentlige dødsfall for alderen over 65 år i Norge, sammenstilt med en Poisson-fordeling med gjennomsnitt/varians på 500. </i> </figcaption>
</figure> -->

<figure>
<img alt=6 src="/excess-mort-nor/cv_pois_s2008.png" width="650">
<figcaption> <b> Figur 6: </b> <i> Kryss-validerte dekningsestimater: Et estimat av andelen av årlige observasjoner fra 2001-2019 innenfor konfidensintervallet på 95% for treningsperioden (blå) og for hold-out-året utenom (i) rød). Hvert år avholdes etter tur mens de andre årene brukes til å beregne konfidensintervallet. Feilstolper er ett standardavvik fra gjennomsnittsestimatet.  </i> </figcaption>
</figure>



<figure>
<img alt=one src="/excess-mort-nor/norway_excess_nc_deaths_pois.png" width="650">
<figcaption> <b> Figur 7: </b> <i> Overdødsfall utenom Covid dødsfall for personer over 65 år i Norge etter aldersstandardisering og fjernet sesong- og tiårstrend. Basisestimat er sentrert til x-aksen beregnet med kvaltilregresjon. Trender er robust tilpasset ved den 50. kvantilen, mens konfidensintervallet passer til henholdsvis 97,5 % og 2,5 % kvantilen. Vaksinasjonsdata er lagt over for samme aldersgruppe, atskilt med injeksjonsnummer. </i> </figcaption>
</figure>

