// Tiny SSE parser. Iterates a ReadableStream<Uint8Array> from fetch() and
// yields { event, data } records as they arrive. Handles split chunks and
// multi-line `data:` fields per the EventSource spec.
export interface SseEvent {
	event: string | null;
	data: string;
}

export async function* iterSse(stream: ReadableStream<Uint8Array>): AsyncIterable<SseEvent> {
	const reader = stream.getReader();
	const decoder = new TextDecoder('utf-8');
	let buf = '';

	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buf += decoder.decode(value, { stream: true });

			// Events are separated by a blank line ("\n\n").
			let sepIdx: number;
			while ((sepIdx = buf.indexOf('\n\n')) !== -1) {
				const block = buf.slice(0, sepIdx);
				buf = buf.slice(sepIdx + 2);
				const ev = parseBlock(block);
				if (ev) yield ev;
			}
		}
		// Trailing event without final blank line — uncommon but spec-allowed.
		if (buf.trim()) {
			const ev = parseBlock(buf);
			if (ev) yield ev;
		}
	} finally {
		reader.releaseLock();
	}
}

function parseBlock(block: string): SseEvent | null {
	let event: string | null = null;
	const dataLines: string[] = [];
	for (const line of block.split('\n')) {
		if (!line || line.startsWith(':')) continue; // empty or comment
		const colon = line.indexOf(':');
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
		if (field === 'event') event = value;
		else if (field === 'data') dataLines.push(value);
	}
	if (dataLines.length === 0) return null;
	return { event, data: dataLines.join('\n') };
}
