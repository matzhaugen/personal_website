
<script>
	import StockChart from "/src/components/StockChart.svelte";
	export let data;
	export const ssr = false;
	const points = data.result 

</script>


<StockChart points={points}/>