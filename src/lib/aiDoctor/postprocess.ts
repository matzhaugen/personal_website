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

// gpt-oss-120b (the Cerebras backend) writes citations with FULL-WIDTH CJK
// brackets — 【Source 1】 rather than [Source 1] — even though the prompt asks
// for the ASCII form. Left alone this is not a cosmetic problem but a silent
// one: CITATION_RE matches nothing, renumberCitations concludes the answer has
// zero citations, and takes the GK-only branch that DELETES the References
// section. So normalize before matching, not after.
//
// Scoped to bracket contents that already look like a citation so ordinary CJK
// punctuation in a quoted passage is left alone.
const FULLWIDTH_CITATION_RE = /[【［〔]\s*((?:Source\s*\d+|GK)[^】］〕]*)[】］〕]/g;

function normalizeCitationBrackets(text: string): string {
	return text.replace(FULLWIDTH_CITATION_RE, (_m, inner: string) => `[${inner.trim()}]`);
}

// A standalone "References" heading on its own line — optionally wrapped
// in bold or markdown-heading syntax — followed by everything to end of
// string. Requires a blank line before, so prose like "...for further
// references see..." is not chopped.
const TRAILING_REFERENCES_RE =
	/\n\n[ \t]*(?:#{1,6}[ \t]+)?\**[ \t]*References[ \t]*:?[ \t]*\**[ \t]*\n[\s\S]*$/;

export function renumberCitations(input: string): string {
	const text = normalizeCitationBrackets(input);
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
