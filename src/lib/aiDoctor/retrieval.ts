// Top-level retrieval orchestrator. Mirrors vectorstore.search_hybrid plus
// the per-doc cap that the Python pipeline applies in the reranker.
// The reranker itself (bge-reranker-v2-m3, 568 MB) is dropped — too large
// for browsers — so we lean on RRF + the per-doc cap to compensate.
//
// Ranking runs over chunk *metadata* only; the bodies of the FINAL_K survivors
// are fetched at the end (see chunks.ts), which is why nothing here touches
// raw_text until the last step.
import type { Chunk, DocMeta, RetrievalResult } from './types';
import { embedQuery } from './embedder';
import { searchDense } from './dense';
import { searchSparse } from './bm25';
import { ensureChunkMeta, hydrate } from './chunks';

// Matches retrieval.initial_k in rag-pipeline's config.yaml. The browser has no
// reranker to salvage a bad pool, so it should not search a narrower one than
// the CLI does — especially at full-corpus size, where 30 candidates over 51k
// chunks is a much thinner slice than it was over the 11k posts-only index.
const INITIAL_K = 50;       // candidates per side before RRF
const FINAL_K = 5;          // chunks shown to the LLM after fusion
const HYBRID_WEIGHT = 0.7;  // dense weight; sparse gets 1 - this
const K_RRF = 60;           // canonical RRF constant

// Diversity caps. Both exist because chunks that are adjacent in one section of
// one article score almost identically — they share vocabulary and topic — so
// an uncapped top-5 routinely comes back as five slices of the same passage.
// Observed 2026-08-06: a question about placebo-controlled vaccine trials
// returned three chunks from a single section of a single post, and one about
// chlorine dioxide returned four from one article, which reads as four
// independent corroborations when it is one author making one argument once.
// …but that argument is about OPINION, and it does not transfer to a primary
// source. Asking "what serious adverse events were reported for Daptacel?"
// should be answered from the Daptacel package insert — several passages of it
// — not one passage each from five different vaccines' inserts. Two slices of
// one blog post really are one author saying one thing twice; two passages of a
// clinical trials table are two facts.
//
// Measured 2026-08-06, and this was not hypothetical. The FDA package inserts
// section-split badly (parse_pdf's academic-heading matcher is tuned for
// journals, so Daptacel's 33 chunks carry exactly two headings: 4 "Preamble"
// and 29 "References"). Under a flat 2/1 the whole 33-chunk document could
// contribute at most TWO chunks, so the sentence actually answering the
// question — "Within 30 days following any dose of DAPTACEL, 57 (3.9%) subjects
// reported at least one serious adverse event", dense rank #4 — was structurally
// unreachable, and three of the five slots went to Adacel and Menactra instead.
//
// So the caps key on document type. Papers keep a cap (an uncapped top-5 is
// still five near-identical slices), just a looser one.
const CAPS: Record<DocMeta['type'], { work: number; section: number }> = {
	post: { work: 2, section: 1 },
	paper: { work: 4, section: 3 }
};

// Relaxation ladder for the fill. The old code capped, then topped up ignoring
// caps entirely, which handed the freed slots straight back to the document
// that had just been capped. Now the caps loosen in stages, so a thin corpus
// still reaches FINAL_K but only concedes as much concentration as it must.
//
// Expressed as an offset added to whichever base cap applies, so the two types
// loosen in step rather than needing a ladder each.
const CAP_LADDER: (number | typeof Infinity)[] = [0, 1, Infinity];

/** Base caps for the document a chunk belongs to; posts are the tighter case. */
function capsFor(type: DocMeta['type'] | undefined) {
	return CAPS[type ?? 'post'] ?? CAPS.post;
}

// WORK, not document: the cap keys on the normalized title rather than doc id.
// Substack mints a new slug when a post is republished, so the corpus holds 25
// near-duplicate documents under 23 shared titles (chlorine dioxide, DMSO and
// the dermatology posts among them — all heavily queried). Keyed on doc id, two
// copies of one article get two separate allowances and a "max 2 per document"
// rule silently permits four. Keyed on title, the copies share one allowance.
// Fixing the corpus is still worthwhile, but this holds without a re-ingest.
function workKey(title: string | undefined, docId: string): string {
	const t = (title ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	return t || docId;
}

// Relevance floor: below this, treat retrieval as empty so prompt.ts's
// sources.length===0 branch fires and the model says the library doesn't cover
// the question.
//
// This gates on the top *cosine* similarity, not on the fused RRF score. RRF
// scores are derived from rank alone, so whatever ranks first always earns
// ~HYBRID_WEIGHT/K_RRF ≈ 0.0117 no matter how irrelevant it is — the old 0.01
// RRF floor was structurally incapable of rejecting anything, and at
// full-corpus size it let plainly off-topic questions through with five
// confident-looking sources.
//
// Measured over the 51,486-chunk index (6 on-corpus vs 6 off-corpus queries):
//     on-corpus  top cosine  0.713 – 0.772
//     off-corpus top cosine  0.545 – 0.601
// 0.65 sits in that gap, biased slightly low: a weak-but-real answer is a
// better failure than wrongly refusing a question the library does cover, and
// the grounded prompt already makes the model state what isn't covered.
//
// BM25 was measured too and is NOT usable for this — its on/off-corpus ranges
// overlap (15.8–27.3 vs 11.8–15.9), since a rare token can score high in any
// document. Small sample; widen it before trusting the exact boundary.
const MIN_TOP_COSINE = 0.65;

// ── Conversational context: used only when the question needs it ───────────
//
// A follow-up like "why was it banned?" carries no topical anchors of its own,
// so we prepend the previous answer before embedding. But that text (up to
// PRIOR_ANSWER_CHARS) dwarfs a short question under mean pooling, and a
// self-contained question asked mid-conversation then retrieves the PREVIOUS
// topic. Measured, asking "Is the sun harmful?" after an answer about AI and
// cognition:
//     bare question      0.779  → "Dermatology's Disastrous War Against The Sun"
//     prior + question   0.810  → "The Dangerous Automation of Information"
// Note the hijacked query scores HIGHER, so MIN_TOP_COSINE cannot catch this —
// enrichment makes wrong retrieval look more confident, not less.
//
// So: score the bare question first and only reach for history when the bare
// question is too weak to stand on its own. Over 14 hand-built cases (5 topic
// switches, 5 anaphoric follow-ups, 2 fresh questions, 2 off-corpus):
//     self-contained questions   bare top cosine  0.764 – 0.859
//     anaphoric follow-ups       bare top cosine  0.635 – 0.680
//     off-corpus                 bare top cosine  0.547 – 0.582
// 0.72 sits in the first gap and 0.60 in the second; both pass 14/14 anywhere
// in 0.68–0.76 and 0.56–0.62 respectively, so neither is knife-edge. Small
// hand-built sample — widen it before trusting the exact boundaries.
const SELF_CONTAINED_COSINE = 0.72;

// Floor on the BARE question, applied before any enrichment. A question whose
// own words land this far from everything in the library isn't covered, and
// conversational context must not manufacture confidence it hasn't earned:
// "What is the best pizza in Naples?" scores 0.547 alone but 0.770 once an
// unrelated prior answer is glued to it, which is enough to clear MIN_TOP_COSINE
// and produce five confident, irrelevant sources.
const MIN_BARE_COSINE = 0.6;

/** How much of the previous answer to prepend when a follow-up needs it. */
const PRIOR_ANSWER_CHARS = 1500;

// Slots held for the BARE question's own top matches whenever we enriched.
//
// SELF_CONTAINED_COSINE is a single threshold on a quantity that conflates two
// different things: how anaphoric a question is, and how verbose it is. Under
// mean pooling a lone content word gets diluted by filler, so a self-contained
// question can land in the anaphoric band purely on phrasing. Measured in the
// browser, same subject, opposite verdicts:
//     "is the sun harmful?"                                   0.779  → bare
//     "What do you know about using sunscreen? Is it safe?"   0.687  → enriched
// The second was asked after an answer about vaccine placebos and retrieved
// five placebo passages, so the model correctly reported that they say nothing
// about sunscreen. MIN_TOP_COSINE cannot catch this: the hijacked query scored
// 0.847, HIGHER than the honest one.
//
// Rather than move the threshold — which would strip context from the genuine
// anaphoric follow-ups it exists for — this makes the failure non-destructive.
// Enrichment still happens; it just no longer discards what the user actually
// asked about. When the bare question clears MIN_TOP_COSINE it has real matches
// by the same standard used to decide the library covers a question at all, and
// those are reserved before the fused ranking fills the rest.
//
// Note the asymmetry that makes this safe: a genuine anaphoric follow-up scores
// BELOW MIN_TOP_COSINE bare (measured 0.635–0.680 against a 0.65 floor), so it
// reserves nothing and behaves exactly as before. Only a question with evidence
// of its own can spend these slots.
//
// 2 of 5, so a follow-up that does need history keeps a working majority.
const RESERVED_BARE = 2;

/** Warm the metadata fetch before the user submits. Re-exported for the UI. */
export { ensureChunkMeta };

export type RetrievalProgress = (loaded: number, total: number, phase: string) => void;

/**
 * Why each query ended up where it did. Emitted for local tuning only — the
 * caller is expected to discard this outside dev (see AiDoctorChat), because
 * the disclaimer promises visitors that nothing they type is stored.
 */
export interface RetrievalDiagnostics {
	query: string;
	hadPriorAnswer: boolean;
	/** Top cosine for the bare question, before any enrichment. */
	bareTopCosine: number;
	/** Top cosine for whichever query was actually used. */
	topCosine: number;
	path: 'bare' | 'enriched' | 'refused-off-corpus' | 'refused-weak';
	/**
	 * How many of the final slots were held for the bare question's own matches
	 * (see RESERVED_BARE). Non-zero only on the 'enriched' path. This is the
	 * number to watch when re-tuning: a hijacked follow-up shows up as path
	 * 'enriched' with reservedBare 0 and matches on the previous topic.
	 */
	reservedBare: number;
	matches: { title: string; section: string; score: number }[];
}

export interface RetrieveOptions {
	/**
	 * The previous assistant answer. Supplied for every turn after the first;
	 * retrieval decides for itself whether the question actually needs it.
	 */
	priorAnswer?: string | null;
	onProgress?: RetrievalProgress;
	onDiagnostics?: (d: RetrievalDiagnostics) => void;
}

function withPriorAnswer(query: string, priorAnswer: string): string {
	return `Recent assistant answer: ${priorAnswer.slice(0, PRIOR_ANSWER_CHARS)}\n\nLatest question: ${query}`;
}

export async function retrieve(
	query: string,
	opts: RetrieveOptions = {}
): Promise<RetrievalResult[]> {
	const { priorAnswer = null, onProgress, onDiagnostics } = opts;
	const { chunks, docs } = await ensureChunkMeta();

	const report = (
		path: RetrievalDiagnostics['path'],
		bareTopCosine: number,
		topCosine: number,
		picked: { idx: number; score: number }[] = [],
		reservedBare = 0
	) =>
		onDiagnostics?.({
			query,
			hadPriorAnswer: !!priorAnswer,
			bareTopCosine,
			topCosine,
			path,
			reservedBare,
			matches: picked.map((p) => ({
				title: docs[chunks[p.idx].doc]?.title ?? '(unknown)',
				section: chunks[p.idx].sec,
				score: p.score
			}))
		});

	// Always score the bare question first — it decides both whether the library
	// covers this at all and whether conversational history is needed.
	const bareVec = await embedQuery(query, onProgress);
	let dense = await searchDense(bareVec, INITIAL_K);
	const bareTop = dense[0]?.score ?? 0;

	if (bareTop < MIN_BARE_COSINE) {
		if (typeof console !== 'undefined') {
			console.debug(
				`[aiDoctor] bare cosine ${bareTop.toFixed(4)} < ${MIN_BARE_COSINE}; not in the library`
			);
		}
		report('refused-off-corpus', bareTop, bareTop);
		return [];
	}

	// Weak on its own → probably anaphoric ("why is that controversial?"), so
	// re-embed with the previous answer for context. Strong on its own → the
	// question stands alone; history would only pull it off topic.
	let effectiveQuery = query;
	let path: RetrievalDiagnostics['path'] = 'bare';
	// Held before `dense` is reassigned — enrichment replaces the candidate list
	// entirely, and this is the only copy of what the user actually asked about.
	const bareDense = dense;
	if (bareTop < SELF_CONTAINED_COSINE && priorAnswer) {
		effectiveQuery = withPriorAnswer(query, priorAnswer);
		dense = await searchDense(await embedQuery(effectiveQuery), INITIAL_K);
		path = 'enriched';
	}

	// BM25 runs on whichever query dense settled on, so both halves of the
	// hybrid see the same question.
	const sparse = await searchSparse(effectiveQuery, INITIAL_K);

	// Bail before fusing: nothing in the library is semantically close enough.
	const topCosine = dense[0]?.score ?? 0;
	if (topCosine < MIN_TOP_COSINE) {
		if (typeof console !== 'undefined') {
			console.debug(
				`[aiDoctor] top cosine ${topCosine.toFixed(4)} < ${MIN_TOP_COSINE}; not in the library`
			);
		}
		report('refused-weak', bareTop, topCosine);
		return [];
	}

	// Reciprocal Rank Fusion — combines lists by rank, not raw score, so it
	// is robust to scale mismatch between bounded cosine and unbounded BM25.
	const fused = new Map<number, number>();
	dense.forEach((r, rank) => {
		fused.set(r.idx, (fused.get(r.idx) ?? 0) + HYBRID_WEIGHT / (K_RRF + rank));
	});
	sparse.forEach((r, rank) => {
		fused.set(r.idx, (fused.get(r.idx) ?? 0) + (1 - HYBRID_WEIGHT) / (K_RRF + rank));
	});

	const ranked = [...fused.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([idx, score]) => ({ idx, score }));

	// Spread the evidence: cap per work and per section within a work, then
	// loosen only as far as needed to reach FINAL_K.
	const picked: { idx: number; score: number }[] = [];
	const seen = new Set<number>();
	const perWork = new Map<string, number>();
	const perSection = new Map<string, number>();

	function tryTake(idx: number, score: number, slack: number): boolean {
		if (picked.length >= FINAL_K || seen.has(idx)) return false;
		const meta = chunks[idx];
		const doc = docs[meta.doc];
		const wk = workKey(doc?.title, meta.doc);
		// NUL-joined: workKey emits only [a-z0-9 ] and a heading cannot
		// contain a NUL, so the composite cannot collide across works.
		const sk = `${wk}\u0000${meta.sec}`;
		// Caps are per document TYPE, and `slack` is the ladder's current
		// loosening. Infinity + n is Infinity, so the last rung still disables
		// both caps for either type without a special case.
		const base = capsFor(doc?.type);
		if ((perWork.get(wk) ?? 0) >= base.work + slack) return false;
		if ((perSection.get(sk) ?? 0) >= base.section + slack) return false;
		picked.push({ idx, score });
		seen.add(idx);
		perWork.set(wk, (perWork.get(wk) ?? 0) + 1);
		perSection.set(sk, (perSection.get(sk) ?? 0) + 1);
		return true;
	}

	// Reserve first, so the question the user actually typed leads the sources
	// and cannot be crowded out by a prior topic that happened to fuse better.
	let reservedBare = 0;
	if (path === 'enriched' && bareTop >= MIN_TOP_COSINE) {
		for (let rank = 0; rank < bareDense.length && reservedBare < RESERVED_BARE; rank++) {
			// Scored on the fused scale — what this chunk would have earned had the
			// bare dense list gone through RRF at this rank. Mixing a raw cosine
			// (~0.69) in with RRF scores (~0.012) would make `score` meaningless to
			// every caller, and these are ordered ahead of the fused picks anyway.
			const rrfEquivalent = HYBRID_WEIGHT / (K_RRF + rank);
			if (tryTake(bareDense[rank].idx, rrfEquivalent, 0)) {
				reservedBare++;
			}
		}
	}

	for (const slack of CAP_LADDER) {
		for (const r of ranked) {
			if (picked.length >= FINAL_K) break;
			tryTake(r.idx, r.score, slack);
		}
		if (picked.length >= FINAL_K) break;
	}

	if (picked.length === 0) {
		report(path, bareTop, topCosine);
		return [];
	}

	report(path, bareTop, topCosine, picked, reservedBare);

	// Only now do the bodies get fetched — one Range request per contiguous run.
	const hydrated: Chunk[] = await hydrate(picked.map((p) => p.idx));
	return hydrated.map((chunk, i) => ({ chunk, score: picked[i].score }));
}
