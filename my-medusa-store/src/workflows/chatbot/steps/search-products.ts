import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { getVectorSearchService } from "../../../services/vector-search"

export interface SearchProductsInput {
    query: string
    keywords: string
    filter?: string
}

export const searchProductsStep = createStep(
    "search-products-step",
    async ({ query, keywords, filter }: SearchProductsInput, { container }) => {
        const vectorSearch = getVectorSearchService()
        const query_sdk = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

        // Fetch all products
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
                        currency_code: "usd",
                    }),
                },
            },
        })

        // Index products if needed
        if (vectorSearch.isConfigured() && !await vectorSearch.hasEmbeddings() && allProducts.length > 0) {
            const productsToIndex = allProducts.map(p => {
                const variant = p.variants?.[0] as any
                const price = variant?.calculated_price?.calculated_amount || 0

                return {
                    id: p.id,
                    title: p.title || "",
                    description: p.description || "",
                    price,
                    category: (p.metadata?.category as string) || undefined
                }
            })
            await vectorSearch.indexProducts(productsToIndex)
        }

        // Use semantic search only
        if (!vectorSearch.isConfigured() || !await vectorSearch.hasEmbeddings()) {
            throw new Error("Semantic search is not configured. Please configure Meilisearch and OpenAI.")
        }

        const productIds = await vectorSearch.searchProducts(query, 5, 0.9, filter)

        if (productIds.length === 0) {
            return new StepResponse({
                products: [],
                searchType: "semantic",
                totalFound: 0
            })
        }

        const products = allProducts.filter(p => productIds.includes(p.id))
        products.sort((a, b) => productIds.indexOf(a.id) - productIds.indexOf(b.id))

        return new StepResponse({
            products,
            searchType: "semantic",
            totalFound: products.length
        })
    }
)
