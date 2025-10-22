import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface FormatResponseInput {
    query: string
    products: any[]
    searchType: "semantic" | "keyword" | "all"
    totalFound: number
    intentType: string
}

export interface ChatbotResponse {
    message: string
    products: any[]
    suggestions?: string[]
}

export const formatResponseStep = createStep(
    "format-response-step",
    async ({ query, products, searchType, totalFound, intentType }: FormatResponseInput) => {
        if (intentType === "clarification") {
            return new StepResponse({
                message: "I can help you find products or answer questions about our store. What would you like to do?",
                products: [],
                suggestions: ["Show me popular products", "I'm looking for a specific item"]
            })
        }

        const formattedProducts = products.slice(0, 5).map(formatProduct)

        let message: string
        if (searchType === "all") {
            message = `I couldn't find products matching "${query}". Here are some of our products:`
        } else if (searchType === "semantic") {
            message = `I found ${totalFound} products matching "${query}". Here are the best matches:`
        } else {
            message = `I found ${totalFound} products matching "${query}". Here are the results:`
        }

        return new StepResponse({
            message,
            products: formattedProducts,
            suggestions: searchType === "all" ? ["Show me all products", "What's popular?"] : undefined
        })
    }
)

function formatProduct(product: any) {
    const variant = product.variants?.[0]
    const priceAmount = variant?.calculated_price?.calculated_amount || 0

    return {
        id: product.id,
        title: product.title,
        description: product.description,
        thumbnail: product.thumbnail,
        price: priceAmount,
        currency: variant?.calculated_price?.currency_code || "usd",
        inStock: true,
        variantId: variant?.id,
        variants: product.variants?.map((v: any) => ({
            id: v.id,
            title: v.title,
            inventory_quantity: 100,
            calculated_price: {
                calculated_amount: v.calculated_price?.calculated_amount || 0,
                currency_code: v.calculated_price?.currency_code || "usd"
            }
        }))
    }
}
