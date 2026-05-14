// Post-process for streamed assistant answers. Mirrors the Gradio app's
// webui.py:_renumber_citations + _TRAILING_REFERENCES_RE.
//
//   1. Models often skip retrieved sources, leaving holes in the numbering
//      ([Source 1], [Source 4], [Source 5]) and a mismatched References
//      list. We renumber by order of first appearance so inline tags and
//      the References list always agree.
//   2. When zero [Source N] tags survive (GK-only fallback path), we strip
//      any leftover "**References**" heading the model emits out of habit.

// Matches "[Source N]", "[Source N, Source M, ...]", and the same with a
// trailing ", GK". Bare "[GK]" is intentionally not matched — nothing to
// renumber there. Group 1 captures the comma-separated source numbers;
// group 2 captures the optional ", GK" tail.
const CITATION_RE = /\[Source\s+(\d+(?:\s*,\s*Source\s+\d+)*)(\s*,\s*GK)?\]/g;

// A standalone "References" heading on its own line — optionally wrapped
// in bold or markdown-heading syntax — followed by everything to end of
// string. Requires a blank line before, so prose like "...for further
// references see..." is not chopped.
const TRAILING_REFERENCES_RE =
	/\n\n[ \t]*(?:#{1,6}[ \t]+)?\**[ \t]*References[ \t]*:?[ \t]*\**[ \t]*\n[\s\S]*$/;

export function renumberCitations(text: string): string {
	const seen: number[] = [];
	for (const m of text.matchAll(CITATION_RE)) {
		const nums = m[1].match(/\d+/g) ?? [];
		for (const n of nums.map(Number)) {
			if (!seen.includes(n)) seen.push(n);
		}
	}

	if (seen.length === 0) {
		// GK-only answer — drop any leftover empty References block.
		return text.replace(TRAILING_REFERENCES_RE, '').trimEnd();
	}

	const renumber = new Map<number, number>();
	seen.forEach((old, i) => renumber.set(old, i + 1));

	return text.replace(CITATION_RE, (_match, numsStr: string, gkTail: string | undefined) => {
		const oldNums = (numsStr.match(/\d+/g) ?? []).map(Number);
		const newNums = oldNums.map((n) => `Source ${renumber.get(n)}`).join(', ');
		return `[${newNums}${gkTail ?? ''}]`;
	});
}
