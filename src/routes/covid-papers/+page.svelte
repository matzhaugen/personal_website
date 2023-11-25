<svelte:head>
 <title>Covid Papers</title>
</svelte:head>

<script>
import papers from '$lib/react19data_merge.json'
import WordCloud from "svelte-d3-cloud";

let category = new Map();
const get = (id) => category.get(id) ?? 0;  
let i = 0;

do {

    category.set(papers[i]["main_category"], get(papers[i]["main_category"]) + 1);
    i++;
} while (i < papers.length);

console.log(category)
let words = []
for (let [key, value] of category) {
	words.push({"text": key, "count": value / 100});	
}

// const words = [
//     { text: "Halo", count: 100 },
//     { text: "Dunia", count: 50 },
//     { text: "Gaib", count: 75 },
//   ];

console.log(words)

</script>


   <div class="title">

     <h1>Covid papers</h1>
     Collection of peer reviewed case reports and studies citing adverse effects post COVID vaccination obtained from the team at <a href="https://react19.org/science">react19.org.</a>
   </div>

<!-- <div>
  <WordCloud words={words}/>
</div>
 -->
<ol>
{#each papers as { author, year, title, link, journal, short_title, volume, main_category, sub_category, report_type }, index}
 <li> 
{#if main_category !== sub_category}
	{author}{year}, {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Tags: <i>{main_category}, {sub_category}</i>
{:else}
	{author}{year}, {title},  <a href={link}> <i>{journal}</i>, {volume}. </a> Tags: <i>{main_category}</i>
{/if}
</li>
{/each}
</ol>