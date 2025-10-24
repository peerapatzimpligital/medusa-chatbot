import { createWorkflow, WorkflowResponse, transform, when } from "@medusajs/framework/workflows-sdk"
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
    context?: {
        isCollectingAddress?: boolean
        partialAddress?: any
        recentMessages?: Array<{
            type: string
            content: string
            hasAddress?: boolean
            addressData?: any
        }>
    }
}

export const chatbotQueryWorkflow = createWorkflow(
    "chatbot-query-workflow",
    (input: ChatbotQueryInput) => {
        // Step 1: Detect intent
        const intent = detectIntentStep({ query: input.query, context: input.context })

        // Product search branch - executed only when intent is product_search
        const productSearchData = when(
            "product-search-flow",
            intent,
            (intentData) => intentData.type === "product_search"
        ).then(() => {
            // Step 2 & 3: Extract filters and search products (only for product search intents)
            const filters = extractFiltersStep({ query: input.query })

            const searchInput = transform({ intent, filters }, (data) => ({
                query: data.filters.cleanQuery,
                keywords: data.intent.keywords || "",
                filter: data.filters.priceFilter
            }))

            const searchResult = searchProductsStep(searchInput)

            return transform({ intent, searchResult, query: input.query }, (data) => ({
                query: data.query,
                products: data.searchResult.products,
                searchType: data.searchResult.searchType as "semantic" | "keyword" | "all",
                totalFound: data.searchResult.totalFound,
                intentType: data.intent.type
            }))
        })

        // Non-product search branch - executed for all other intents
        const nonProductSearchData = when(
            "non-product-search-flow",
            intent,
            (intentData) => intentData.type !== "product_search"
        ).then(() => {
            return transform({ intent, query: input.query }, (data) => ({
                query: data.query,
                products: [],
                searchType: "all" as "semantic" | "keyword" | "all",
                totalFound: 0,
                intentType: data.intent.type
            }))
        })

        // Combine results from both branches and format response
        const formatInput = transform({ productSearchData, nonProductSearchData }, (data) => {
            return data.productSearchData || data.nonProductSearchData
        })

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
        const actionsInput = transform({ intent, response, cartItemCount: input.cartItemCount }, (data) => ({
            intentType: data.intent.type,
            hasProducts: data.response.products.length > 0,
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
