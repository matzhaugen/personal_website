---
title: Critique of the original covid isolation paper by F. Wu et al. (2020).
description: Some points worth noting regarding the virus isolation procedure used.
date: Nov 25, 2022
authors: Matz Haugen
language: English
hidden: True
---

Below are some comments on the paper which is widly recognized to be the first covid-19 sequencing paper, by [Wu et *al*., 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7094943/pdf/41586_2020_Article_2008.pdf). Their goal is to isolate a coronavirus they suspect is contained in a sample of bronchoalveolar lavage fluid (BALF). This sample undergoes a series of processing steps whereby the sample's genetic material is split into millions of pieces which is then attempted reassembly by looking at snippets of genetic material (nucleotides) to find likely matches between snippets. A match indicate a likelihood of two snippets being contiguous. The process of matching is repeated until a stopping criteria is reached and the resulting combined snippets are together called a *contig*. This process is again repeated to find a plethora of contigs using computer software. One of these contigs show an 89.1% match with an exiting coronavirus as it exists in a virus database, from which they conclude the discovery of a new coronavirus.


Main comments
--------------
1. They use two softwares to get their prospective contigs, Trinity and Megahit, ranging between 200 and 30k nucleotides (nt). Trinity finds 1.3 million contigs while Megahit finds 400k contigs. Trinity assembles the longest contig with ~ 12k nt while Megahit gets 30k nt. They decide to throw away the Trinity contigs and use the *longest* contig from Megahit with no justification, but which conveniently has almost as many nt's as the covid viruses in the database (~ 30k nt's). Did they throw away the Trinity data because its longest contig was less than half the length of the database coronavirus? In a scientific method, you're not allowed to throw away one method's (or software's) result in favor of the other just because the other matches your data better. Moreover, there is no justification for why they chose the longest contig other than that it was closest to the existing virus lengths. Again, this is like choosing the DNA sequence after looking at the target. Changing a model after looking at the target is a common technique in statistics when you seek to build a model, or an *approximation* of reality. But when isolating a viral genome, you cannot simply go to the database of known coronaviruses, look for the one that matches your sequence best, chosen without justification other than being the longest sequence, and claim to have found a new coronavirus. So two issues here, (a) why throw away Trinity's results and (b) why use the longest contig and not any other of the ~ 400k contigs their software assembled? It's worth noting that if you change the parameters of Megahit, you get wildly different longest contigs (Table 1) ([Li et al. (2015)](https://academic.oup.com/bioinformatics/article/31/10/1674/177884) and [Gurevich et al. (2013)](https://academic.oup.com/bioinformatics/article/29/8/1072/228832?login=true)). In fact, even using the same parameters and the same raw data has been shown to produce different results (see [USMortality's post (2022)](https://usmortality.substack.com/p/sars-cov-2-genome-assembly)). This begs the question: If Trinity had been the only software available would we not have had a new coronavirus?

<figure>
<img src="/fan-wu/megahit.png" width="650" alt="megahit">
<figcaption> <b> Table 1: </b> <i> Reproduction of Table 1 in <a href=https://academic.oup.com/bioinformatics/article/31/10/1674/177884> Li et al. (2015)</a> - Performance of MEGAHIT and SPAdes<sup>3</sup> on the E.coli dataset. </i> </figcaption>
</figure>

2. After all this they only find a 89.1% match between their Megahit sample and the database sample. In light of the fact that monkey DNA and human DNA are 96% [similar](http://www.differencebetween.info/difference-between-human-and-monkey-dna), 89.1% is not very impressive.

3. The discovery has no statistical significance test or uncertainty associated with it. No null hypothesis is introduced, presumably because even formulating such a hypothesis is an immense challenge. For example, one would have to compute the combined likelihood that all snippets that form a contig are in fact contiguous. Not an easy task. The paper seems to rely on Megahit, but the field is well aware of these shortcomings. As [O'Rawe et al. (2015)](https://www.cell.com/trends/genetics/fulltext/S0168-9525(14)00209-1) say: *Several statistical studies have tried to measure error rates for basic determinations, but there are no general schemes to project these uncertainties so as to assess the surety of the conclusions drawn*.

4. They claim that their whole novel genome was actually 29,903 nt long, whereas their Megahit sample was 30,474 nt long. What happened to the 500 nt difference?

5. There is no control used in this experiment, e.g. a sample from a sick person without covid or a healthy person. Let's not forget that they threw away the 1 million contigs Trinity found (with no justification other than it didn't match the target). They did use controls in the PCR test, which for the positive control had a positive PCR test, but this is not relevant to the gene sequencing.


Side notes
-----------------------
1. The PCR cycles used for testing presence of other viruses only goes up to 40 (Extended Figure 2). This implies that they judge anything above 40 cycles as a false positive. However, these cutoffs are tenuous when juxtaposed with results from [Jafaar et al., 2021](https://academic.oup.com/cid/article/72/11/e921/5912603) who found that positive viral cultures only account for 2.7% of the samples that showed PCR positive results at 35 cycles. If we are to use this paper as a benchmark, any ct value greater than 26 with a positive will have 50% chance of being a false positive through viral culture. This is in line with the [critique](https://cormandrostenreview.com/report/) of the original [paper](https://www.eurosurveillance.org/content/10.2807/1560-7917.ES.2020.25.3.2000045?crawler=true#r2) on covid PCR testing, citing a 25-30 max ct value beyond which the sample is negative. Compare this to Extended Figure 4 in [Wu et *al*. (2021)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7094943/pdf/41586_2020_Article_2008.pdf) where they have a positive PCR at around 29 ct.

3. Could what we call variants just be efforts to repeat the experiment in the Wu  paper but coming up with slightly different sequences? In other words, are variants  failed repeated experiments, which would then also invalidate the original experiment?

4. The patient was mildly hypoxic, a trademark symptom of radiation poisoning, as discussed by [Rubik and Brown (2021)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8580522/) and [Rios et al. (2021)](https://meridian.allenpress.com/radiation-research/article/195/1/1/446280/Commonalities-Between-COVID-19-and-Radiation).

