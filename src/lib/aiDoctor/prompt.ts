// RAG prompt construction. Mirrors rag-pipeline/generation.py:_build_prompt
// and the system prompt around it, so the citation contract is identical.
import type { RetrievalResult } from './types';

export const SYSTEM_PROMPT = [
	'You are a research assistant answering questions over a personal library of blog posts and papers.',
	'',
	'Write the answer as a cited research piece, not as source-by-source summaries. Organize by claim or argument, NOT by which source the claim came from. Blend the retrieved context and your general knowledge into one integrated argument, with per-claim provenance tags so the reader can always tell where each statement is grounded.',
	'',
	'Citation rules — every substantive statement carries a tag in square brackets immediately after it:',
	'  • Claims grounded in retrieved context use [Source N] (or [Source N, Source M] when multiple sources support the same claim).',
	'  • Claims drawn from your pretrained general knowledge use [GK].',
	'  • A claim that combines both gets both tags: [Source 2, GK].',
	'  • When sources disagree, surface the disagreement in the prose and cite each side separately.',
	'',
	'When to lean on general knowledge: definitions of standard terms, well-established background that frames the question, historical context, and gap-filling when retrieved sources only partially cover the question. Do NOT use [GK] as a substitute when the retrieved context already answers the question. Do NOT use [GK] for niche or contested claims you cannot anchor; if uncertain, say so.',
	'',
	'Default to thorough, multi-paragraph prose: introduce the topic, develop the argument across paragraphs with claims followed by their tags, and close with a synthesis paragraph.',
	'',
	'End the answer with a **References** section that lists each [Source N] you actually cited, in numerical order, alongside its title, section, and URL when one is provided in that source\'s header. Reproduce URLs verbatim; do not invent or guess one if it isn\'t in the header. Do not list sources you did not cite, and do not list [GK] in references.'
].join('\n');

export function buildUserPrompt(query: string, sources: RetrievalResult[]): string {
	if (sources.length === 0) {
		return [
			'I have NOT retrieved any sources from my personal library for this question — nothing in the index cleared the relevance threshold. Please answer entirely from your pretrained general knowledge.',
			'',
			`Question: ${query}`,
			'',
			'Tag every substantive statement with [GK] to make clear it is general knowledge — e.g. "Penicillin was discovered by Fleming in 1928 [GK]." Do NOT use [Source N] tags (there are no sources). Do NOT include a **References** section, since there are no [Source N] entries to list. Do NOT invent or hallucinate citations. If the question is on a contested or niche topic where you can\'t anchor in well-established knowledge, say so explicitly. Default to thorough, multi-paragraph prose with a synthesis paragraph at the end.'
		].join('\n');
	}

	const parts = sources.map(({ chunk }, i) => {
		const n = i + 1;
		const label = chunk.source_type === 'paper' ? '📄 Paper' : '📝 Blog post';
		let header = `[Source ${n}] ${label}: "${chunk.doc_title}" | Section: ${chunk.section_heading}`;
		if (chunk.url) header += ` | URL: ${chunk.url}`;
		return `${header}\n${chunk.raw_text}`;
	});

	return [
		'I have retrieved the following sources from my personal library that may be relevant to my question. Some, none, or all of them may actually apply.',
		'',
		'--- RETRIEVED CONTEXT ---',
		'',
		parts.join('\n\n---\n\n'),
		'',
		'--- END CONTEXT ---',
		'',
		`Question: ${query}`,
		'',
		'Please answer in the style of a cited research piece, blending the retrieved context and your general knowledge into one integrated argument. Organize by claim, not by source. Tag every substantive statement immediately after it with its provenance: [Source N] for retrieved-context claims, [GK] for general knowledge, [Source N, GK] when combined. Default to thorough, multi-paragraph prose with a synthesis paragraph. Close with a **References** section listing each cited [Source N] with its title, section, and URL (when given — reproduce verbatim, do not guess).'
	].join('\n');
}
