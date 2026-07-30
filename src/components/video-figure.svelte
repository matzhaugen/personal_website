<script lang="ts">
	interface Props {
		/** Path under /static without extension, e.g. '/covid-mortality/statewide_excess_map' */
		src: string;
		/** Figure number shown in bold before the caption */
		n?: string | number;
		width?: string;
		/** Optional poster frame; falls back to the browser's own first-frame preview */
		poster?: string;
		/** Silent animations read better looping on their own; keep controls either way */
		loop?: boolean;
		autoplay?: boolean;
		/** Set false to hide the "MP4" download link */
		download?: boolean;
		/**
		 * Frame rate of the file, enabling ←/→ single-frame stepping. Browsers
		 * don't expose this, so it has to be passed: `ffprobe -show_entries
		 * stream=r_frame_rate` on the source (e.g. 209 frames / 20s = 10.45).
		 * Omit it and the arrows keep their native ±5s seek.
		 */
		fps?: number;
		children?: any;
	}

	let {
		src,
		n,
		width = '650',
		poster,
		loop = false,
		autoplay = false,
		download = true,
		fps,
		children
	}: Props = $props();

	let base = $derived(src.replace(/\.mp4$/i, ''));
	let video = $state<HTMLVideoElement | undefined>(undefined);

	/**
	 * Steps exactly one frame. Times are held mid-frame (the +0.5) so that
	 * repeated presses can't accumulate rounding drift onto a frame boundary,
	 * where the browser could land either side of it.
	 */
	function step(delta: number) {
		if (!video || !fps || !isFinite(video.duration)) return;
		video.pause();
		const frame = Math.floor(video.currentTime * fps + 1e-6);
		const last = Math.ceil(video.duration * fps) - 1;
		const target = Math.min(Math.max(frame + delta, 0), last);
		video.currentTime = (target + 0.5) / fps;
	}

	/**
	 * Must run in the capture phase on the wrapper, not on the video: Chrome's
	 * built-in controls listen inside the video's shadow DOM and seek on arrow
	 * keys *before* a bubble-phase handler here would see the event, so we'd
	 * step from an already-moved position. Capturing above the video and
	 * stopping propagation keeps the built-in seek from ever running.
	 */
	function onkeydown(e: KeyboardEvent) {
		if (!fps || e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.target !== video) return; // ignore keys aimed at the caption link
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		// Shift keeps a coarse seek available, since we're taking the default one.
		const coarse = e.shiftKey;
		const dir = e.key === 'ArrowRight' ? 1 : -1;
		e.preventDefault(); // stop page scroll
		e.stopPropagation(); // stop Chrome's own controls seeking too
		if (coarse && video) {
			video.pause();
			video.currentTime = Math.min(Math.max(video.currentTime + dir, 0), video.duration);
		} else {
			step(dir);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<figure onkeydowncapture={onkeydown}>
	<!-- preload="metadata" keeps the payload off the page until the reader hits play -->
	<video
		bind:this={video}
		src="{base}.mp4"
		{poster}
		{loop}
		{autoplay}
		muted={autoplay}
		controls
		playsinline
		preload="metadata"
		style:max-width="{width}px"
	></video>
	<figcaption>
		{#if n}<b>Figure {n}:</b>{/if}
		{#if children}{@render children()}{/if}
		{#if download}
			<a class="file-link" href="{base}.mp4" download>MP4</a>
		{/if}
		{#if fps}
			<span class="hint">click, then <kbd>←</kbd><kbd>→</kbd> to step one frame</span>
		{/if}
	</figcaption>
</figure>

<style>
	figure {
		margin: 2rem 0;
		text-align: center;
	}

	video {
		width: 100%;
		height: auto;
		background: #f4f4f4;
	}

	figcaption {
		font-size: 0.9rem;
		line-height: 1.45;
		text-align: left;
	}

	.file-link {
		margin-left: 0.4em;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #777;
		text-decoration: none;
		border-bottom: 1px solid #ccc;
		white-space: nowrap;
	}

	.file-link:hover {
		color: #111;
		border-bottom-color: #111;
	}

	/* Only worth saying once the reader is interacting with the video */
	.hint {
		margin-left: 0.5em;
		font-size: 0.78rem;
		color: #aaa;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.15s;
	}

	figure:hover .hint,
	figure:focus-within .hint {
		opacity: 1;
	}

	kbd {
		font-family: inherit;
		font-size: 0.9em;
		padding: 0 0.25em;
		border: 1px solid #ddd;
		border-radius: 3px;
		color: #888;
	}
</style>
