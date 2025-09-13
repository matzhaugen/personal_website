<script lang="ts">
  import { run } from 'svelte/legacy';

  import d3Cloud from "d3-cloud";
  import { descending, extent, rollups } from "d3-array";
import { onMount } from 'svelte';

interface WordData {
  text: string;
  size: number;
}

interface CloudWord {
  size: number;
  x: number;
  y: number;
  rotate: number;
  text: string;
}

  let { data = [] }: { data: WordData[] } = $props();
  console.log(data)

  const dimensions = {
  width: 840,
  height: 600,
  margin: {
    top: 24,
    right: 0,
    bottom: 0,
    left: 0
  }
};

const wordPadding = 2;
let cloudWords: CloudWord[] = [];

 onMount(() => {
 	const cloud = d3Cloud()
  .size([
	dimensions.width - dimensions.margin.left - dimensions.margin.right,
    dimensions.height - dimensions.margin.top - dimensions.margin.bottom
  ])
  .words(data)
  .padding(wordPadding)
  .rotate(0)
  .font("Helvetica")
  .fontSize((d: any) => Math.sqrt(d.size) * 20)
  .on("word", ({ size, x, y, rotate, text }: any) => {
    cloudWords.push({ size: size || 0, x: x || 0, y: y || 0, rotate: rotate || 0, text: text || '' });
  });

	cloud.start();
}
)


let words: CloudWord[] = $derived(cloudWords);
run(() => {
    console.log(words)
  });

</script>


<svg width={dimensions.width} height={dimensions.height} viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} text-anchor="middle" font-family="Helvetica">

	<g transform={`translate(0 ${dimensions.margin.top})`}>
	  {#each words as word}
	    <text font-size={word.size} transform={`translate(${word.x}, ${word.y}) rotate(${word.rotate})`} fill="#CC2936">{word.text}</text>
	  {/each}
	</g>

</svg>