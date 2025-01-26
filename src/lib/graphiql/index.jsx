import { toChecksumAddress } from "../crypto"
import { formatQuery, normalizeSpacing } from "../string"

export const GRAPHQL_PULSEX = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex'
export const GRAPHQL_PULSEX_V2 = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsexv2'

export const getSearchQuery = (searchTerm) => {
  const query = formatQuery(`
    query {
        pairs(
            orderBy: totalTransactions,
            orderDirection: desc,
            first: 10, 
            where: { 
            and: [
                { 
                    or: [
                        { name_contains: "${searchTerm.toLowerCase()}" },
                        { name_contains: "${searchTerm.toUpperCase()}" },
                        { id: "${searchTerm.toLowerCase()}" },
                        { token0_: { id: "${searchTerm.toLowerCase()}" } },
						{ token1_: { id: "${searchTerm.toLowerCase()}" } }
                    ]
                },
                { name_contains:"WPLS"},
                { reserveUSD_gte: 1000 }
            ]
            }
        ) {
            totalTransactions
            reserveUSD
            id
            name
            reserve0
            reserve1
            token0 {
                id
                name
                symbol
                decimals
                derivedUSD
            }
            token1 {
                id
                name
                symbol
                decimals
                derivedUSD
            }
        }
    }`)
    return query
}
