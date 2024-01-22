
import yahooFinance from 'yahoo-finance2';
export const ssr = true


// export function load(event) {
// 	console.log(event)
// 	// console.log(`the answer is ${event.locals}`)
// 	return {
// 		message: `the answer is ${event.locals.answer}`
// 	};
// }

export async function load({ request, getClientAddress }) {

	const query = 'GC=F';
	const queryOptions = { period1: '2002-02-01', period2: '2023-02-01' };
	const result = await yahooFinance.historical(query, queryOptions);

	const getFloatDate = (d) => {
		
		const year = d.getUTCFullYear()

		const yearStart = new Date(year, 0, 0)
		const diff = d - yearStart
		const oneDay = 1000 * 60 * 60 * 24;
		const day = Math.floor(diff / oneDay) / 366;
		return year + day
	}
	result.map(v => v.dateNumber = getFloatDate(v.date))

	return {
		result
	};
}