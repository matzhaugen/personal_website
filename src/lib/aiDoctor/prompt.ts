// RAG prompt construction for the AI doctor.
//
// Policy: answers are GROUNDED in the retrieved library passages. The model
// answers only from what was retrieved and states ignorance when the library
// doesn't cover the question, rather than filling gaps with general knowledge.
// rag-pipeline/generation.py:_SYSTEM_PROMPT carries the same rules — keep the
// two in sync, including the [Source N] header format built below.
import type { Chunk, RetrievalResult } from './types';

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
	'Voice — write about the subject, not about your sources:',
	// No worked example here on purpose. An earlier version illustrated the rule
	// with a realistic sentence carrying a [Source 2] tag; given five unrelated
	// passages the model reproduced that sentence verbatim as a cited finding.
	// Any example concrete enough to be useful is concrete enough to be copied,
	// so the contrast is stated with placeholders instead.
	'  • Never narrate the retrieval, in ANY wording or word order. The words "passage", "context", "excerpt", "document" and "source" must not appear in your prose as a way of referring to the material you were given — not "the retrieved context", not "the provided passages", not "the passages provided", not "the sources above", not "based on the context", not "the documents indicate". The [Source N] tags already mark what is grounded; saying it in prose as well is noise. State the claim and tag it — «claim» [Source N] — rather than «the retrieved context suggests» «claim».',
	'  • If the material does not answer the question, say the library doesn\'t cover it and STOP THERE. Do not go on to describe what the material does discuss, and do not offer it as a partial substitute — the reader asked about their topic, not about whatever happened to be nearby. A single sentence is the whole correct answer in that case.',
	'  • Be careful rather than hedged. Precision comes from carrying the evidence\'s own strength into the sentence — what kind of study it was, how large, over what period, whose claim it is — not from prefacing statements with qualifiers about where you got them. Naming the study design and scale before the finding is careful; «the sources seem to suggest» «claim» is not.',
	'  • Attribute contested or authorial claims to whoever makes them ("the author argues…", "the trial reported…") rather than to your source material as a category.',
	'  • Name gaps in terms of the library itself — "The library doesn\'t cover X" — never "the context does not contain X".',
	'',
	'Style: organize by claim or argument, not source-by-source. When the sources support a full answer, write thorough, multi-paragraph prose with a closing synthesis. When they only partially cover the question, give what is grounded and clearly mark the gaps. When they do not cover it at all, a brief, honest "this isn\'t in the library" answer is the correct response — do not pad it.',
	'',
	'End the answer with a **References** section that lists each [Source N] you actually cited, in numerical order. Give each one\'s title and section, plus whichever of author/year, DOI, and URL appear in that source\'s header — papers carry an author, year and DOI; blog posts carry a URL. Prefer the DOI when citing a paper. Reproduce DOIs and URLs verbatim, character for character; never invent, complete, or guess one that isn\'t in the header, and never reuse one source\'s DOI for another. Omit any field the header doesn\'t give rather than substituting a plausible value. Do not list sources you did not cite, do not list [GK], and omit the References section entirely if you cited no sources.'
].join('\n');

/**
 * "Smith J et al., 2022" — the compact form shown in the [Source N] header.
 * Port of paper_metadata.short_citation; returns '' when neither authors nor
 * year are known so the caller can omit the segment rather than render it empty.
 */
function shortCitation(chunk: Chunk): string {
	const authors = chunk.authors ?? [];
	const year = chunk.year;
	let who = '';
	if (authors.length > 0) {
		who = authors[0];
		if (authors.length > 1) who += ' et al.';
	}
	if (who && year) return `${who}, ${year}`;
	return who || (year ? String(year) : '');
}

/**
 * Mirrors generation.py's header construction. Papers carry citation metadata
 * only when the papers_metadata.json sidecar existed at ingest time, so each
 * segment is omitted rather than rendered empty — an older index degrades to
 * the title-only header instead of emitting "DOI: null".
 */
function sourceHeader(chunk: Chunk, n: number): string {
	const label = chunk.source_type === 'paper' ? '📄 Paper' : '📝 Blog post';
	let header = `[Source ${n}] ${label}: "${chunk.doc_title}"`;
	const cite = shortCitation(chunk);
	if (cite) header += ` | ${cite}`;
	if (chunk.doi) header += ` | DOI: ${chunk.doi}`;
	header += ` | Section: ${chunk.section_heading}`;
	if (chunk.url) header += ` | URL: ${chunk.url}`;
	return header;
}

export function buildUserPrompt(query: string, sources: RetrievalResult[]): string {
	if (sources.length === 0) {
		return [
			'Nothing in my personal library is relevant to this question — you have no material to answer from.',
			'',
			`Question: ${query}`,
			'',
			'Reply in one or two sentences saying the library doesn\'t cover this, and optionally suggest a related topic it might cover. Speak about the library, not about passages, context or a search — the reader never saw those. Do NOT answer from your own general knowledge. Do NOT use [Source N] or [GK] tags, do NOT fabricate citations, and do NOT include a **References** section.'
		].join('\n');
	}

	const parts = sources.map(({ chunk }, i) => `${sourceHeader(chunk, i + 1)}\n${chunk.raw_text}`);

	// The delimiters and the closing instruction deliberately avoid the phrase
	// "retrieved context": the model copies the vocabulary it is shown, and this
	// block used to be headed "--- RETRIEVED CONTEXT ---" with a matching
	// instruction, which is why answers opened with "The retrieved context
	// suggests…" instead of just answering.
	return [
		'These passages come from my personal library and may be relevant to my question. Some, none, or all of them may actually apply.',
		'',
		'--- LIBRARY PASSAGES ---',
		'',
		parts.join('\n\n---\n\n'),
		'',
		'--- END LIBRARY PASSAGES ---',
		'',
		`Question: ${query}`,
		'',
		'Answer using ONLY the passages above, and write the answer as prose about the subject itself — do not describe or refer to the passages, and do not open by assessing whether they answer the question. Tag each substantive statement with [Source N] immediately after it; those tags are what show your grounding, so no further commentary about your sources is needed. Where the passages fall short, name the gap in terms of the library ("The library doesn\'t cover X") rather than in terms of the context you were given; do NOT fall back on outside knowledge and do NOT guess. Organize by claim, not by source; write thorough prose when the sources support it. If you cannot answer from them at all, say the library doesn\'t cover the question and stop. Close with a **References** section listing each cited [Source N] with its title and section, plus whichever of author/year, DOI and URL that source\'s header gives — verbatim, never invented; omit it if you cited nothing.'
	].join('\n');
}
