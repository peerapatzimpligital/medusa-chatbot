import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { detectIntentStep } from "./steps/detect-intent"
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

        // Step 2: Search products
        const searchInput = transform({ intent, query: input.query }, (data) => ({
            query: data.query,
            keywords: data.intent.keywords || ""
        }))

        const searchResult = searchProductsStep(searchInput)

        // Step 3: Format response
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
