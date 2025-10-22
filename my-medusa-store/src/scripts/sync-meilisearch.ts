import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules, QueryContext } from "@medusajs/framework/utils";
import { getVectorSearchService } from "../services/vector-search";

export default async function syncMeilisearch({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const productModule = container.resolve(Modules.PRODUCT);

    logger.info("Starting Meilisearch sync...");

    try {
        // Get vector search service
        const vectorSearch = getVectorSearchService();

        // Initialize Meilisearch index (this also ensures initialization is complete)
        logger.info("Initializing Meilisearch index...");
        await vectorSearch.initializeIndex();

        // Check if services are configured
        if (!vectorSearch.isConfigured()) {
            logger.error("Meilisearch or OpenAI not configured!");
            logger.error("Please set MEILISEARCH_URL and OPENAI_API_KEY in .env");
            return;
        }

        // Fetch all products with variants and prices
        logger.info("Fetching products from database...");
        const query_sdk = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

        const { data: products } = await query_sdk.graph({
            entity: "product",
            fields: [
                "id",
                "title",
                "description",
                "metadata",
                "variants.id",
                "variants.calculated_price.*"
            ],
            context: {
                variants: {
                    calculated_price: QueryContext({
                        currency_code: "usd",
                    }),
                },
            },
        });

        logger.info(`Found ${products.length} products to index`);

        if (products.length === 0) {
            logger.warn("No products found. Run seed script first.");
            return;
        }

        // Index products in batches to avoid rate limits
        const batchSize = 10;
        let indexed = 0;

        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);

            logger.info(`Indexing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}...`);

            const productsToIndex = batch.map(product => {
                const variant = product.variants?.[0] as any;
                const price = variant?.calculated_price?.calculated_amount || 0;
                const category = (product.metadata?.category as string) || undefined;

                return {
                    id: product.id,
                    title: product.title,
                    description: product.description || "",
                    price,
                    category
                };
            });

            await vectorSearch.indexProducts(productsToIndex);
            indexed += batch.length;

            logger.info(`Indexed ${indexed}/${products.length} products (with price & category)`);

            // Rate limit: wait 1 second between batches to avoid OpenAI rate limits
            if (i + batchSize < products.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Verify indexing
        const hasEmbeddings = await vectorSearch.hasEmbeddings();
        if (hasEmbeddings) {
            logger.info("✓ Successfully synced all products to Meilisearch!");
            logger.info(`Total products indexed: ${indexed}`);
        } else {
            logger.error("✗ Failed to verify embeddings in Meilisearch");
        }

        // Test semantic search
        logger.info("\n=== Testing Semantic Search ===");
        const testQuery = "red lipstick";
        logger.info(`Query: "${testQuery}"`);

        const results = await vectorSearch.searchProducts(testQuery, 3);
        logger.info(`Found ${results.length} results:`);

        for (const productId of results) {
            const product = products.find(p => p.id === productId);
            if (product) {
                const variant = product.variants?.[0] as any;
                const price = variant?.calculated_price?.calculated_amount || 0;
                logger.info(`  - ${product.title} ($${(price / 100).toFixed(2)})`);
            }
        }

        // Test price filter search
        logger.info("\n=== Testing Price Filter Search ===");
        const priceQuery = "furniture";
        const priceFilter = "price <= 10000"; // Under $100
        logger.info(`Query: "${priceQuery}" with filter: ${priceFilter}`);

        const priceResults = await vectorSearch.searchProducts(priceQuery, 3, 0.9, priceFilter);
        logger.info(`Found ${priceResults.length} results:`);

        for (const productId of priceResults) {
            const product = products.find(p => p.id === productId);
            if (product) {
                const variant = product.variants?.[0] as any;
                const price = variant?.calculated_price?.calculated_amount || 0;
                logger.info(`  - ${product.title} ($${(price / 100).toFixed(2)})`);
            }
        }

    } catch (error) {
        logger.error("Error syncing to Meilisearch:");
        if (error instanceof Error) {
            logger.error(error.message);
            logger.error(error.stack);
        }
        throw error;
    }
}
