import OpenAI from "openai"

interface ProductDocument {
    id: string
    title: string
    description: string
    _vectors?: {
        default: number[]
    }
}

export class VectorSearchService {
    private openai: OpenAI | null = null
    private meilisearch: any = null
    private indexName = "products"
    private initPromise: Promise<void> | null = null

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY
        if (apiKey) {
            this.openai = new OpenAI({ apiKey })
        }

        // Initialize Meilisearch asynchronously
        this.initPromise = this.initMeilisearch()
    }

    private async initMeilisearch() {
        try {
            const { MeiliSearch } = await import("meilisearch")
            const meilisearchUrl = process.env.MEILISEARCH_URL || "http://127.0.0.1:7700"
            const meilisearchKey = process.env.MEILISEARCH_API_KEY || ""

            this.meilisearch = new MeiliSearch({
                host: meilisearchUrl,
                apiKey: meilisearchKey,
            })
        } catch (error) {
            console.warn("Meilisearch not available:", error)
        }
    }

    private async ensureInitialized() {
        if (this.initPromise) {
            await this.initPromise
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.openai) {
            throw new Error("OpenAI API key not configured")
        }

        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        })

        return response.data[0].embedding
    }

    async initializeIndex() {
        await this.ensureInitialized()
        if (!this.meilisearch) return

        try {
            const index = this.meilisearch.index(this.indexName)

            // Configure searchable attributes
            await index.updateSearchableAttributes([
                "title",
                "description",
            ])

            // Configure filterable attributes
            await index.updateFilterableAttributes(["id"])

            // Configure embedder for hybrid search
            await index.updateEmbedders({
                default: {
                    source: "userProvided",
                    dimensions: 1536, // OpenAI text-embedding-3-small dimensions
                },
            })

            console.log("Meilisearch index initialized with embedder")
        } catch (error) {
            console.warn("Failed to initialize Meilisearch index:", error)
        }
    }

    async indexProduct(productId: string, title: string, description: string) {
        await this.ensureInitialized()
        if (!this.meilisearch || !this.openai) return

        try {
            const text = `${title} ${description}`.toLowerCase()
            const embedding = await this.generateEmbedding(text)

            const document: ProductDocument = {
                id: productId,
                title,
                description: description || "",
                _vectors: {
                    default: embedding,
                },
            }

            const index = this.meilisearch.index(this.indexName)
            await index.addDocuments([document], { primaryKey: "id" })
        } catch (error) {
            console.warn(`Failed to index product ${productId}:`, error)
        }
    }

    async indexProducts(products: Array<{ id: string; title: string; description: string }>) {
        await this.ensureInitialized()
        if (!this.meilisearch || !this.openai) return

        try {
            const documents: ProductDocument[] = []

            for (const product of products) {
                const text = `${product.title} ${product.description || ""}`.toLowerCase()
                const embedding = await this.generateEmbedding(text)

                documents.push({
                    id: product.id,
                    title: product.title,
                    description: product.description || "",
                    _vectors: {
                        default: embedding,
                    },
                })
            }

            const index = this.meilisearch.index(this.indexName)
            await index.addDocuments(documents, { primaryKey: "id" })

            console.log(`Indexed ${documents.length} products in Meilisearch`)
        } catch (error) {
            console.warn("Failed to index products:", error)
        }
    }

    async searchProducts(query: string, topK: number = 5, semanticRatio: number = 0.9): Promise<string[]> {
        await this.ensureInitialized()

        if (!this.meilisearch || !this.openai) {
            throw new Error("Meilisearch and OpenAI must be configured for semantic search")
        }

        // Generate embedding for the query
        const queryEmbedding = await this.generateEmbedding(query.toLowerCase())
        const index = this.meilisearch.index(this.indexName)

        // Use hybrid search with custom vector
        // semanticRatio: 0.0 = pure keyword, 1.0 = pure semantic
        const results = await index.search(query, {
            vector: queryEmbedding,
            hybrid: {
                semanticRatio: semanticRatio,
                embedder: "default", // Required field for hybrid search
            },
            limit: topK,
            showRankingScore: true,
        })

        return results.hits.map((hit: any) => hit.id)
    }

    async hasEmbeddings(): Promise<boolean> {
        await this.ensureInitialized()
        if (!this.meilisearch) return false

        try {
            const index = this.meilisearch.index(this.indexName)
            const stats = await index.getStats()
            return stats.numberOfDocuments > 0
        } catch (error) {
            return false
        }
    }

    isConfigured(): boolean {
        return this.meilisearch !== null && this.openai !== null
    }
}

// Singleton instance
let vectorSearchInstance: VectorSearchService | null = null

export function getVectorSearchService(): VectorSearchService {
    if (!vectorSearchInstance) {
        vectorSearchInstance = new VectorSearchService()
    }
    return vectorSearchInstance
}
