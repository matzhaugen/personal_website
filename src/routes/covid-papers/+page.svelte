<svelte:head>
 <title>Covid Papers</title>
</svelte:head>

<script>
import papers from '$lib/react19data_merge.json'
import csvDownload from 'json-to-csv-export'
import WordCloud from "svelte-d3-cloud";

let category = new Map();
const get = (id) => category.get(id) ?? 0;  

let papersToShow = [...papers]

let i = 0;
do {
    category.set(papers[i]["main_category"], get(papers[i]["main_category"]) + 1);
    papersToShow[i]["show"] = true
    i++;
} while (i < papers.length);

Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};

Array.prototype.remove = function(element){
    let idx = this.indexOf(element);
    return this.splice(idx, 1);
};

let words = []
let active = new Map();
for (let [key, value] of category) {
	words.push({"text": key, "count": value / 100});	
	active.set(key, false)
}


let filterBy = []
const filter = (e) => {
	let tag = e.target.textContent
	
	if (filterBy.contains(tag)) {
		filterBy.remove(tag)
		e.target.style.color = '';
		active.set(tag, false)
	} else {
		filterBy.push(e.target.textContent)	
		e.target.style.color = 'limegreen';
		active.set(tag, true)
	}
	let m = 0;
	do {
		if (filterBy.length === 0) {
			papersToShow[m]["show"] = true
		} else {
			if (filterBy.contains(papersToShow[m]["main_category"])) {
			    papersToShow[m]["show"] = true
			} else {
				papersToShow[m]["show"] = false
			}
		}
	    m++;
	} while (m < papers.length);
}

const exportToCsv = () => {
	var toExport = []
	for (var l = papersToShow.length - 1; l >= 0; l--) {
		if (papersToShow[l]["show"]) {
			let {short_title, show, ...toCopy} = papersToShow[l]
			toExport.push(toCopy)
		} 
	}
	const dataToConvert = {
	  data: toExport,
	  filename: 'covid_papers.csv',
	  delimiter: ','
	}
	csvDownload(dataToConvert)
}

$: nShowing = papersToShow.reduce((t, n) => t + n["show"], 0);

</script>

   <div class="title">
     <h1>Covid papers</h1>
     Collection of peer reviewed case reports and studies citing adverse effects post COVID vaccination obtained from the team at <a href="https://react19.org/science">react19.org.</a>
   </div>
<div class="tags">
	Keywords:
{#each words as word} 
  <button class="btn" 
  on:click={filter}>{word["text"]}</button>
{/each}
</div>
<!-- Comment -->
<div id="container"> 
	<div id="left"> Showing <b>{nShowing}</b> papers </div>
	<div id="middle"> </div>
	<div id="right"> <button on:click={exportToCsv}>Export to csv</button> </div>
</div>

<ol>
{#each papersToShow as { author, year, title, link, journal, short_title, volume, main_category, sub_category, report_type, show }, index}
{#if show === true}
 <li> 

{#if main_category !== sub_category}
	{author}{year}, {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Keywords: <i>{main_category}, {sub_category}</i>
{:else}
	{author}{year}, {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Keywords: <i>{main_category}</i>
{/if}
</li>
{/if}
{/each}
</ol>

<style>
	#container {height: 100%; width:100%; display: flex; }
	#left {width: 25%;}
	#middle {
	  width: 50%;
	}
	#right {width: 25%; }
  .btn {
  	margin: .05cm;
  }
  .tags {
  	margin-top: .7cm;
	margin-bottom: .5cm;
  }
</style>
