<svelte:head>
 <title>Covid Papers</title>
</svelte:head>

<script>
import papers from '$lib/react19data_merge.json'
import csvDownload from 'json-to-csv-export'
import WordCloud from '/src/components/WordCloud.svelte'

let category = new Map();
let subCategory = new Map();
const get = (id) => category.get(id) ?? 0;  

let papersToShow = [...papers]

let i = 0;
do {
    category.set(papers[i]["main_category"], get(papers[i]["main_category"]) + 1);
    subCategory.set(papers[i]["sub_category"], get(papers[i]["sub_category"]) + 1);
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
let subWords = []
let active = new Map();
for (let [key, value] of category) {
	words.push({"text": key, "count": value});	
	active.set(key, false)
}
for (let [key, value] of subCategory) {
	subWords.push({"text": key, "count": value});	
	active.set(key, false)
}

let grouping = "main_category"
let filterBy = []
function switchGrouping() {
	filterBy = []
	if (grouping === "main_category") {
		grouping = "sub_category"
		groupWords = subWords
	} else {
		grouping = "main_category"
		groupWords = words
	}
	let mm = 0;

	do {
		papersToShow[mm]["show"] = true 

	    mm++;
	} while (mm < papers.length);


}

$: groupWords = grouping === "main_category" ? words : subWords

const filter = (e) => {
	let tag = e.target.textContent
	
	if (filterBy.contains(tag)) {
		filterBy.remove(tag)
		active.set(tag, false)
	} else {
		filterBy.push(e.target.textContent)	
		active.set(tag, true)
	}
	let m = 0;
	do {
		if (filterBy.length === 0) {
			papersToShow[m]["show"] = true
		} else {
			if (filterBy.contains(papersToShow[m][grouping])) {
			    papersToShow[m]["show"] = true
			} else {
				papersToShow[m]["show"] = false
			}
		}
	    m++;
	} while (m < papers.length);
	groupWords = groupWords;
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
{#each groupWords as word} 
{@const active = filterBy.contains(word["text"])}
<div style="display: inline">
  <button class="btn" class:active={active}
  on:click={filter}>{word["text"]}</button>
 </div>
{/each}
</div>


<!-- <div>
  <WordCloud data={groupWords}/>
	}
</div>
 -->

<div id="container"> 
	<div id="left"> Showing <b>{nShowing}</b> papers </div>
	<div id="middle"> <button class=btn on:click={switchGrouping}>Detailed keywords</button> </div>
	<div id="right"> <button class=btn on:click={exportToCsv}>Export to csv</button> </div>
</div>

<ol>
{#each papersToShow as { author, year, title, link, journal, short_title, volume, main_category, sub_category, report_type, show }, index}
{#if show === true}
 <li> 

{#if main_category !== sub_category}
	{author} ({year}), {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Keywords: <i>{main_category}, {sub_category}</i>
{:else}
	{author} ({year}), {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Keywords: <i>{main_category}</i>
{/if}
</li>
{/if}
{/each}
</ol>

<style>
	.menu_links { cursor: pointer; }
	#container {height: 100%; width:100%; display: flex; }
	#left {width: 35%;}
	#middle {
	  width: 50%;
	  margin-left: 2cm;
	}
	#right {width: 25%; }
	.active {
	  	color: limegreen;
	  }
  .btn:hover {
  	cursor: pointer;
  	background-color: #ccc;
  }
  .tags {
  	margin-top: .7cm;
	margin-bottom: .5cm;
  }
  body {
    display: flex;
    justify-content: center;
  }
</style>
