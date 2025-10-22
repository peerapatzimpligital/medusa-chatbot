import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface ExtractFiltersInput {
    query: string
}

export interface FilterResult {
    priceFilter?: string
    categoryFilter?: string
    cleanQuery: string
}

export const extractFiltersStep = createStep(
    "extract-filters-step",
    async ({ query }: ExtractFiltersInput) => {
        const lowerQuery = query.toLowerCase()
        let priceFilter: string | undefined
        let categoryFilter: string | undefined
        let cleanQuery = query

        // Extract price constraints
        // Patterns: "under $100", "less than 100", "below 50", "cheaper than $200"
        const underMatch = lowerQuery.match(/(?:under|less than|below|cheaper than|max)\s*\$?(\d+)/)
        if (underMatch) {
            const maxPrice = parseInt(underMatch[1]) // Convert to cents
            priceFilter = `price <= ${maxPrice}`
            cleanQuery = cleanQuery.replace(underMatch[0], '').trim()
        }

        // Patterns: "over $100", "more than 100", "above 50"
        const overMatch = lowerQuery.match(/(?:over|more than|above|min)\s*\$?(\d+)/)
        if (overMatch) {
            const minPrice = parseInt(overMatch[1]) // Convert to cents
            priceFilter = priceFilter
                ? `${priceFilter} AND price >= ${minPrice}`
                : `price >= ${minPrice}`
            cleanQuery = cleanQuery.replace(overMatch[0], '').trim()
        }

        // Patterns: "between $50 and $100"
        const betweenMatch = lowerQuery.match(/between\s*\$?(\d+)\s*and\s*\$?(\d+)/)
        if (betweenMatch) {
            const minPrice = parseInt(betweenMatch[1])
            const maxPrice = parseInt(betweenMatch[2])
            priceFilter = `price >= ${minPrice} AND price <= ${maxPrice}`
            cleanQuery = cleanQuery.replace(betweenMatch[0], '').trim()
        }

        // Extract category (you can expand this list)
        const categories = ['furniture', 'beauty', 'fragrances', 'groceries', 'home-decoration', 'kitchen-accessories']
        for (const cat of categories) {
            if (lowerQuery.includes(cat)) {
                categoryFilter = `category = "${cat}"`
                cleanQuery = cleanQuery.replace(new RegExp(cat, 'gi'), '').trim()
            }
        }

        // Combine filters
        let combinedFilter: string | undefined
        if (priceFilter && categoryFilter) {
            combinedFilter = `${priceFilter} AND ${categoryFilter}`
        } else if (priceFilter) {
            combinedFilter = priceFilter
        } else if (categoryFilter) {
            combinedFilter = categoryFilter
        }

        return new StepResponse({
            priceFilter: combinedFilter,
            categoryFilter,
            cleanQuery: cleanQuery || query // Fallback to original if empty
        })
    }
)
