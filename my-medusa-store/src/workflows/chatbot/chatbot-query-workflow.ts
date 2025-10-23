import { createWorkflow, WorkflowResponse, transform } from "@medusajs/framework/workflows-sdk"
import { detectIntentStep } from "./steps/detect-intent"
import { extractFiltersStep } from "./steps/extract-filters"
import { searchProductsStep } from "./steps/search-products"
import { formatResponseStep } from "./steps/format-response"
import { generateActionsStep } from "./steps/generate-actions"
import { extractAddressStep } from "./steps/extract-address"
import { generateFollowupStep } from "./steps/generate-followup"

export interface ChatbotQueryInput {
    query: string
    cartItemCount?: number
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

        // Step 7: Extract address information (if present)
        const addressExtraction = extractAddressStep({ query: input.query })

        // Step 7b: Generate follow-up message for missing fields
        const followup = generateFollowupStep(
            transform({ addressExtraction }, (data) => ({
                missingFields: data.addressExtraction.missingFields || [],
                addressData: data.addressExtraction.addressData || {}
            }))
        )

        // Step 8: Generate contextual action buttons
        const actionsInput = transform({ intent, searchResult, cartItemCount: input.cartItemCount }, (data) => ({
            intentType: data.intent.type,
            hasProducts: data.searchResult.products.length > 0,
            cartItemCount: data.cartItemCount || 0
        }))

        const actions = generateActionsStep(actionsInput)

        // Return final response
        return new WorkflowResponse(
            transform({ intent, response, actions, addressExtraction, followup }, (data) => ({
                intent: data.intent.type,
                message: data.response.message,
                products: data.response.products,
                suggestions: data.response.suggestions,
                actions: data.actions.actions,
                showActions: data.actions.showActions,
                addressData: data.addressExtraction.hasAddress ? data.addressExtraction.addressData : null,
                hasAddress: data.addressExtraction.hasAddress,
                missingFields: data.addressExtraction.missingFields,
                needsFollowup: data.followup.needsFollowup,
                followupMessage: data.followup.message,
                followupSuggestions: data.followup.suggestions
            }))
        )
    }
)
