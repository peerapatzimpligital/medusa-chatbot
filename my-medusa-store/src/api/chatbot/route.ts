import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { getVectorSearchService } from "../../services/vector-search"

export const POST = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    const body = req.body as { query: string; conversationId?: string; context?: any }
    const { query, conversationId, context } = body

    try {
        // Detect intent from query
        const intent = detectIntent(query)

        let response
        switch (intent.type) {
            case 'product_search':
                response = await handleProductSearch(req, query, intent)
                break
            default:
                response = await handleClarification(query)
        }

        res.json({
            conversationId: conversationId || generateConversationId(),
            message: response.message,
            products: response.products || [],
            intent: intent.type,
            suggestions: response.suggestions || []
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Failed to process query' })
    }
}

function detectIntent(query: string) {
    const lowerQuery = query.toLowerCase()

    // Product search patterns
    if (lowerQuery.match(/looking for|search|find|show me|need|want/)) {
        return { type: 'product_search', keywords: extractKeywords(query) }
    }

    return { type: 'clarification' }
}

async function handleProductSearch(req: MedusaRequest, query: string, intent: any) {
    const vectorSearch = getVectorSearchService()

    // Use remoteQuery for cleaner API access
    const query_sdk = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

    const { data: allProducts } = await query_sdk.graph({
        entity: "product",
        fields: [
            "id",
            "title",
            "description",
            "thumbnail",
            "variants.id",
            "variants.title",
            "variants.inventory_quantity",
            "variants.calculated_price.*"
        ],
        context: {
            variants: {
                calculated_price: QueryContext({
                    currency_code: "usd", // Replace with your desired currency code
                }),
            },
        },
    })

    // Index products if not already done and vector search is configured
    if (vectorSearch.isConfigured() && !await vectorSearch.hasEmbeddings() && allProducts.length > 0) {
        console.log("Indexing products for vector search...")
        const productsToIndex = allProducts.map(p => ({
            id: p.id,
            title: p.title || "",
            description: p.description || ""
        }))
        await vectorSearch.indexProducts(productsToIndex)
        console.log(`Indexed ${allProducts.length} products`)
    }

    let products = allProducts

    // Try vector search if configured
    if (vectorSearch.isConfigured() && await vectorSearch.hasEmbeddings()) {
        try {
            const productIds = await vectorSearch.searchProducts(query, 5)
            if (productIds.length > 0) {
                // Filter products by vector search results
                products = allProducts.filter(p => productIds.includes(p.id))
                // Sort by vector search ranking
                products.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id))

                return {
                    message: `I found ${products.length} products matching "${query}". Here are the best matches:`,
                    products: products.map(formatProduct)
                }
            }
        } catch (error) {
            console.error("Vector search failed, falling back to keyword search:", error)
        }
    }

    // Fallback to keyword search
    const keywords = intent.keywords.toLowerCase()
    products = allProducts.filter(p =>
        p.title?.toLowerCase().includes(keywords) ||
        p.description?.toLowerCase().includes(keywords)
    )

    if (products.length === 0) {
        return {
            message: `I couldn't find products matching "${query}". Here are some of our products:`,
            products: allProducts.slice(0, 5).map(formatProduct),
            suggestions: ["Show me all products", "What's popular?"]
        }
    }

    return {
        message: `I found ${products.length} products matching "${query}". Here are the results:`,
        products: products.slice(0, 5).map(formatProduct)
    }
}

async function handleClarification(_query: string) {
    return {
        message: "I can help you find products or answer questions about our store. What would you like to do?",
        suggestions: [
            "Show me popular products",
            "I'm looking for a specific item"
        ]
    }
}

function formatProduct(product: any) {
    const variant = product.variants?.[0]

    // Get price - Medusa stores in smallest unit (cents), so 1500 = $15.00
    const priceAmount = variant?.calculated_price?.calculated_amount || 0

    return {
        id: product.id,
        title: product.title,
        description: product.description,
        thumbnail: product.thumbnail,
        price: priceAmount, // Already in cents
        currency: variant?.calculated_price?.currency_code || "usd",
        inStock: true,
        variantId: variant?.id,
        variants: product.variants?.map((v: any) => ({
            id: v.id,
            title: v.title,
            inventory_quantity: 100, // Default stock for POC
            calculated_price: {
                calculated_amount: v.calculated_price?.calculated_amount || 0,
                currency_code: v.calculated_price?.currency_code || "usd"
            }
        }))
    }
}

function extractKeywords(query: string): string {
    // Remove common words and extract meaningful keywords
    const stopWords = ['looking', 'for', 'show', 'me', 'find', 'need', 'want', 'a', 'an', 'the']
    return query.toLowerCase()
        .split(' ')
        .filter(word => !stopWords.includes(word))
        .join(' ')
}

function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
