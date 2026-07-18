// RAG prompt construction for the AI doctor.
//
// Policy: answers are GROUNDED in the retrieved library passages. The model
// answers only from what was retrieved and states ignorance when the library
// doesn't cover the question, rather than filling gaps with general knowledge.
// (This intentionally diverges from rag-pipeline/generation.py, which still
// blends [GK]; mirror it there if you want the CLI to behave the same way.)
import type { RetrievalResult } from './types';

export const SYSTEM_PROMPT = [
	'You are a research assistant answering questions strictly over a personal library of blog posts and papers. You answer ONLY from the retrieved passages you are given — not from your own general knowledge.',
	'',
	'Grounding rules:',
	'  • Base every substantive statement on the retrieved [Source N] passages, and tag it immediately with [Source N] (or [Source N, Source M] when multiple sources support the same claim).',
	'  • If the retrieved passages do not contain enough to answer the question — or answer it only partially — say so plainly. State what the library does and does not cover (e.g. "The library doesn\'t contain information on X."). Do NOT fill the gap with outside knowledge, and do NOT guess.',
	'  • Never fabricate sources, citations, statistics, or quotations. Every [Source N] tag must correspond to a passage actually provided above.',
	'  • When sources disagree, surface the disagreement in the prose and cite each side separately.',
	'',
	'General knowledge is tightly limited: you may briefly define a standard term the sources assume the reader already knows, tagged [GK] — but never use [GK] to answer a question the retrieved passages do not cover. When in doubt, prefer stating that the library lacks the information over supplying it yourself.',
	'',
	'Style: organize by claim or argument, not source-by-source. When the sources support a full answer, write thorough, multi-paragraph prose with a closing synthesis. When they only partially cover the question, give what is grounded and clearly mark the gaps. When they do not cover it at all, a brief, honest "this isn\'t in the library" answer is the correct response — do not pad it.',
	'',
	'End the answer with a **References** section listing each [Source N] you actually cited, in numerical order, with its title, section, and URL when one is provided in that source\'s header. Reproduce URLs verbatim; never invent or guess one. Do not list sources you did not cite, do not list [GK], and omit the References section entirely if you cited no sources.'
].join('\n');

export function buildUserPrompt(query: string, sources: RetrievalResult[]): string {
	if (sources.length === 0) {
		return [
			'None of the passages in my personal library cleared the relevance threshold for this question — there is NO retrieved context to answer from.',
			'',
			`Question: ${query}`,
			'',
			'Respond in one or two sentences stating that you don\'t have information on this in the library, and optionally suggest rephrasing or a related topic the library might cover. Do NOT answer from your own general knowledge. Do NOT use [Source N] or [GK] tags, do NOT fabricate citations, and do NOT include a **References** section.'
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
		'I have retrieved the following passages from my personal library that may be relevant to my question. Some, none, or all of them may actually apply.',
		'',
		'--- RETRIEVED CONTEXT ---',
		'',
		parts.join('\n\n---\n\n'),
		'',
		'--- END CONTEXT ---',
		'',
		`Question: ${query}`,
		'',
		'Answer the question using ONLY the retrieved context above. Tag each substantive statement with [Source N] immediately after it. If the context does not actually answer the question — or covers only part of it — say so explicitly and state what is and isn\'t covered; do NOT fall back on outside knowledge and do NOT guess. Organize by claim, not by source; write thorough prose when the sources support it. If you end up unable to answer from the sources, say the library doesn\'t cover the question and stop. Close with a **References** section listing each cited [Source N] with its title, section, and URL (when given — verbatim); omit it if you cited nothing.'
	].join('\n');
}
