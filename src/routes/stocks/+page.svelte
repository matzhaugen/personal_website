
<script>
	import { redirect } from '@sveltejs/kit';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import StockChart from "/src/components/StockChart.svelte";
	export let data;
	export const ssr = false;
	const points = data.result 
	let invisible = true
    afterNavigate(async ({ from }) => {
    	console.log(from)
    	if (from == null) {
	    	var password = prompt("Enter in the password");
	    	if (password != "1") {
	    		invisible = true
		        goto('/')
		    } else {
		    	invisible = false
		    }
		} else {
			invisible = false
		}

	});
    
</script>

<div class:invisible>
<StockChart points={points}/>
</div>

<style>
	.invisible {
		display: none;
	}
</style>