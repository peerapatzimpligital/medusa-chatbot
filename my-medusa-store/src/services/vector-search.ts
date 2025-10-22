import OpenAI from "openai"

interface ProductEmbedding {
    productId: string
    embedding: number[]
    text: string
}

// In-memory storage for POC (use a vector DB like Pinecone/Weaviate in production)
let productEmbeddings: ProductEmbedding[] = []

export class VectorSearchService {
    private openai: OpenAI | null = null

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY
        if (apiKey) {
            this.openai = new OpenAI({ apiKey })
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

    async indexProduct(productId: string, title: string, description: string) {
        if (!this.openai) return

        const text = `${title} ${description}`.toLowerCase()
        const embedding = await this.generateEmbedding(text)

        // Store or update embedding
        const existingIndex = productEmbeddings.findIndex(p => p.productId === productId)
        if (existingIndex >= 0) {
            productEmbeddings[existingIndex] = { productId, embedding, text }
        } else {
            productEmbeddings.push({ productId, embedding, text })
        }
    }

    async indexProducts(products: Array<{ id: string; title: string; description: string }>) {
        if (!this.openai) return

        for (const product of products) {
            await this.indexProduct(product.id, product.title, product.description || "")
        }
    }

    cosineSimilarity(a: number[], b: number[]): number {
        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    async searchProducts(query: string, topK: number = 5): Promise<string[]> {
        if (!this.openai || productEmbeddings.length === 0) {
            // Fallback to keyword search
            return []
        }

        const queryEmbedding = await this.generateEmbedding(query.toLowerCase())

        // Calculate similarity scores
        const scores = productEmbeddings.map(product => ({
            productId: product.productId,
            score: this.cosineSimilarity(queryEmbedding, product.embedding)
        }))

        // Sort by score and return top K
        scores.sort((a, b) => b.score - a.score)
        return scores.slice(0, topK).map(s => s.productId)
    }

    hasEmbeddings(): boolean {
        return productEmbeddings.length > 0
    }

    isConfigured(): boolean {
        return this.openai !== null
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
