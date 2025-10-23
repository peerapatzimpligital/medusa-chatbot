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

        if (intentType === "delivery_options") {
            return new StepResponse({
                message: "I can help you choose the best delivery option for your order. Let me show you the available shipping methods.",
                products: [],
                suggestions: ["Show delivery options", "Get delivery recommendation"]
            })
        }

        if (intentType === "delivery_recommendation") {
            return new StepResponse({
                message: "I'd be happy to recommend the best delivery option for you! Let me analyze the available shipping methods based on your preferences.",
                products: [],
                suggestions: ["Fastest delivery", "Cheapest option", "Eco-friendly shipping"]
            })
        }

        if (intentType === "payment_options") {
            return new StepResponse({
                message: "I can help you choose the best payment method for your order. Let me show you the available payment options.",
                products: [],
                suggestions: ["Show payment options", "Get payment recommendation", "Secure payment methods"]
            })
        }

        if (intentType === "payment_recommendation") {
            return new StepResponse({
                message: "I'd be happy to recommend the best payment method for you! Let me analyze the available payment options based on your preferences.",
                products: [],
                suggestions: ["Most secure option", "Fastest payment", "Popular choice", "Simple payment"]
            })
        }

        if (intentType === "payment_selection") {
            return new StepResponse({
                message: "I can help you select and set up your preferred payment method. Which payment option would you like to use?",
                products: [],
                suggestions: ["Credit/Debit Card", "PayPal", "Show all options"]
            })
        }

        if (intentType === "order_completion") {
            return new StepResponse({
                message: "Great! I can help you complete your order. Let me guide you through the final steps to place your order.",
                products: [],
                suggestions: ["Continue to review", "Complete order now", "Check my cart"]
            })
        }

        if (intentType === "order_review") {
            return new StepResponse({
                message: "Let me show you your order summary so you can review everything before completing your purchase.",
                products: [],
                suggestions: ["Review order details", "Continue to payment", "Edit my cart"]
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
