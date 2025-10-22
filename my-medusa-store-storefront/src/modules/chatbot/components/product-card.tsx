"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { addToCartFromChatbot } from "../actions"

interface Variant {
    id: string
    title: string
    inventory_quantity: number
    calculated_price?: {
        calculated_amount: number
        currency_code: string
    }
}

interface ProductCardProps {
    product: {
        id: string
        title: string
        description: string
        thumbnail: string
        price: number
        currency: string
        inStock: boolean
        variantId: string
        variants?: Variant[]
    }
}

export function ProductCard({ product }: ProductCardProps) {
    const [selectedVariantId, setSelectedVariantId] = useState(product.variantId)
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    const hasMultipleVariants = product.variants && product.variants.length > 1
    const selectedVariant = product.variants?.find(v => v.id === selectedVariantId) || product.variants?.[0]

    const handleAddToCart = async () => {
        startTransition(async () => {
            try {
                const result = await addToCartFromChatbot(selectedVariantId, 1)

                if (result.success) {
                    setMessage("✓ Added to cart!")
                    setTimeout(() => setMessage(null), 3000)

                    // Trigger a soft refresh to update cart count
                    window.dispatchEvent(new Event("cart-updated"))
                } else {
                    setMessage(`✗ ${result.error}`)
                    setTimeout(() => setMessage(null), 3000)
                }
            } catch (error) {
                console.error("Add to cart error:", error)
                setMessage("✗ Failed to add to cart")
                setTimeout(() => setMessage(null), 3000)
            }
        })
    }

    const formatPrice = (price: number, currency: string) => {
        // Medusa's calculated_amount is already in display format (not cents)
        // So we format directly without dividing by 100
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(price)
    }

    const currentPrice = selectedVariant?.calculated_price?.calculated_amount || product.price
    const currentCurrency = selectedVariant?.calculated_price?.currency_code || product.currency
    const currentStock = selectedVariant?.inventory_quantity ?? (product.inStock ? 1 : 0)

    return (
        <div className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
            <div className="flex space-x-3">
                {product.thumbnail && (
                    <div className="relative w-20 h-20 flex-shrink-0">
                        <Image
                            src={product.thumbnail}
                            alt={product.title}
                            fill
                            className="object-cover rounded"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{product.title}</h4>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                        {product.description}
                    </p>

                    {/* Variant Selector */}
                    {hasMultipleVariants && (
                        <div className="mt-2">
                            <select
                                value={selectedVariantId}
                                onChange={(e) => setSelectedVariantId(e.target.value)}
                                className="text-xs border rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {product.variants?.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                        {variant.title}
                                        {variant.inventory_quantity <= 0 && " (Out of Stock)"}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Success/Error Message */}
                    {message && (
                        <div className={`mt-2 text-xs px-2 py-1 rounded ${message.startsWith("✓")
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                            }`}>
                            {message}
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                        <div>
                            <span className="font-bold text-sm">
                                {formatPrice(currentPrice, currentCurrency)}
                            </span>
                            {currentStock <= 0 && (
                                <span className="ml-2 text-xs text-red-600">Out of Stock</span>
                            )}
                        </div>
                        <button
                            onClick={handleAddToCart}
                            disabled={currentStock <= 0 || isPending}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {isPending ? "Adding..." : "Add"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
