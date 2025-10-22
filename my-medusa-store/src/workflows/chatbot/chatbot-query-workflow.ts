import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { detectIntentStep } from "./steps/detect-intent"
import { extractFiltersStep } from "./steps/extract-filters"
import { searchProductsStep } from "./steps/search-products"
import { formatResponseStep } from "./steps/format-response"

export interface ChatbotQueryInput {
    query: string
}

export const chatbotQueryWorkflow = createWorkflow(
    "chatbot-query-workflow",
    (input: ChatbotQueryInput) => {
        // Step 1: Detect intent
        const intent = detectIntentStep({ query: input.query })

        // Step 2: Extract filters (price, category)
        const filters = extractFiltersStep({ query: input.query })

        // Step 3: Search products with filters
        const searchInput = transform({ intent, filters }, (data) => ({
            query: data.filters.cleanQuery,
            keywords: data.intent.keywords || "",
            filter: data.filters.priceFilter
        }))

        const searchResult = searchProductsStep(searchInput)

        // Step 4: Format response
        const formatInput = transform({ intent, searchResult, query: input.query }, (data) => ({
            query: data.query,
            products: data.searchResult.products,
            searchType: data.searchResult.searchType as "semantic" | "keyword" | "all",
            totalFound: data.searchResult.totalFound,
            intentType: data.intent.type
        }))

        const response = formatResponseStep(formatInput)

        // Return final response
        return new WorkflowResponse(
            transform({ intent, response }, (data) => ({
                intent: data.intent.type,
                message: data.response.message,
                products: data.response.products,
                suggestions: data.response.suggestions
            }))
        )
    }
)
