import { ExecArgs } from "@medusajs/framework/types";
import {
    ContainerRegistrationKeys,
    Modules,
    ProductStatus,
} from "@medusajs/framework/utils";
import {
    createInventoryLevelsWorkflow,
    createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

interface DummyProduct {
    id: number;
    title: string;
    description: string;
    category: string;
    price: number;
    discountPercentage: number;
    rating: number;
    stock: number;
    tags: string[];
    brand: string;
    sku: string;
    thumbnail: string;
    images: string[];
}

export default async function seedDummyJsonData({ container }: ExecArgs) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const storeModuleService = container.resolve(Modules.STORE);
    const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
    const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

    logger.info("Fetching products from DummyJSON API...");

    const response = await fetch("https://dummyjson.com/products?limit=1000");
    const data = await response.json();
    const dummyProducts: DummyProduct[] = data.products;

    logger.info(`Fetched ${dummyProducts.length} products from DummyJSON`);

    // Use CDN URLs directly (no upload needed)
    logger.info("Using DummyJSON CDN URLs for images...");

    // Get store and sales channel
    const [store] = await storeModuleService.listStores();
    const defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
        name: "Default Sales Channel",
    });

    if (!defaultSalesChannel.length) {
        throw new Error("Default sales channel not found. Please run the main seed script first.");
    }

    // Get shipping profile
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
        type: "default",
    });

    if (!shippingProfiles.length) {
        throw new Error("Shipping profile not found. Please run the main seed script first.");
    }
    const shippingProfile = shippingProfiles[0];

    // Check for existing products and delete them
    logger.info("Checking for existing DummyJSON products...");
    const productModule = container.resolve(Modules.PRODUCT);

    const existingProducts = await productModule.listProducts({
        handle: dummyProducts.map(p => `${p.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}-${p.id}`)
    });

    if (existingProducts.length > 0) {
        logger.info(`Found ${existingProducts.length} existing products. Deleting...`);

        // Get inventory items for these products
        const inventoryModule = container.resolve(Modules.INVENTORY);
        const { data: inventoryItems } = await query.graph({
            entity: "inventory_item",
            fields: ["id", "sku"],
        });

        // Get SKUs from existing products
        const existingSkus = new Set<string>();
        for (const product of existingProducts) {
            const variants = await productModule.listProductVariants({ product_id: product.id });
            variants.forEach(v => v.sku && existingSkus.add(v.sku));
        }

        // Find inventory items to delete
        const inventoryItemsToDelete = inventoryItems.filter((item: any) =>
            existingSkus.has(item.sku)
        );

        if (inventoryItemsToDelete.length > 0) {
            logger.info(`Deleting ${inventoryItemsToDelete.length} inventory items...`);
            await inventoryModule.deleteInventoryItems(inventoryItemsToDelete.map((item: any) => item.id));
        }

        await productModule.deleteProducts(existingProducts.map(p => p.id));
        logger.info("Existing products deleted.");
    }

    logger.info("Converting DummyJSON products to Medusa format...");

    // Helper function to create URL-safe handle
    const createHandle = (title: string, id: number): string => {
        const baseHandle = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single
            .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

        // Add product ID to ensure uniqueness
        return `${baseHandle}-${id}`;
    };

    // Convert DummyJSON products to Medusa format
    const medusaProducts = dummyProducts.map((product) => ({
        title: product.title,
        description: product.description,
        handle: createHandle(product.title, product.id),
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        images: product.images.map((url) => ({ url })),
        options: [
            {
                title: "Default",
                values: ["Default"],
            },
        ],
        variants: [
            {
                title: "Default",
                sku: product.sku,
                options: {
                    Default: "Default",
                },
                prices: [
                    {
                        amount: Math.round(product.price * 100), // Convert to cents
                        currency_code: "usd",
                    },
                    {
                        amount: Math.round(product.price * 0.85 * 100), // EUR conversion
                        currency_code: "eur",
                    },
                ],
                manage_inventory: true,
            },
        ],
        sales_channels: [
            {
                id: defaultSalesChannel[0].id,
            },
        ],
        metadata: {
            brand: product.brand,
            category: product.category,
            rating: product.rating,
            tags: product.tags.join(", "),
        },
    }));

    logger.info("Seeding products to Medusa...");

    const { result: createdProducts } = await createProductsWorkflow(container).run({
        input: {
            products: medusaProducts,
        },
    });

    logger.info(`Successfully created ${createdProducts.length} products`);

    // Set inventory levels
    logger.info("Setting inventory levels...");

    // Get only the newly created inventory items
    const newProductIds = createdProducts.map((p: any) => p.id);

    // Get inventory items - check which ones already have levels
    const inventoryModule = container.resolve(Modules.INVENTORY);
    const allInventoryLevels = await inventoryModule.listInventoryLevels({});
    const existingInventoryItemIds = new Set(allInventoryLevels.map((level: any) => level.inventory_item_id));

    const { data: allInventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "sku"],
    });

    // Filter to only new inventory items (ones without existing levels)
    const newInventoryItems = allInventoryItems.filter((item: any) =>
        !existingInventoryItemIds.has(item.id)
    );

    if (newInventoryItems.length === 0) {
        logger.info("No new inventory items to set levels for");
        return;
    }

    const stockLocations = await query.graph({
        entity: "stock_location",
        fields: ["id"],
    });

    if (!stockLocations.data.length) {
        throw new Error("No stock location found. Please run the main seed script first.");
    }

    const stockLocation = stockLocations.data[0];

    // Create inventory levels only for new items
    const inventoryLevels = newInventoryItems.map((item: any) => ({
        location_id: stockLocation.id,
        stocked_quantity: 100, // Default stock for all products
        inventory_item_id: item.id,
    }));

    await createInventoryLevelsWorkflow(container).run({
        input: {
            inventory_levels: inventoryLevels,
        },
    });

    logger.info("Finished seeding DummyJSON products!");
    logger.info(`Total products created: ${createdProducts.length}`);
}
