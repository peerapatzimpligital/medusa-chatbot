interface Product {
    id: string
    title: string
    description: string
    thumbnail: string
    price: number
    currency: string
    inStock: boolean
    variantId: string
}

interface ActionButton {
    id: string
    label: string
    action: string
    variant?: string
}

interface AddressData {
    firstName?: string
    lastName?: string
    company?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    phone?: string
    email?: string
}

interface ChatMessageProps {
    message: {
        type: "user" | "bot"
        content: string
        timestamp: Date
        products?: Product[]
        suggestions?: string[]
        actions?: ActionButton[]
        showActions?: boolean
        addressData?: AddressData
        hasAddress?: boolean
        missingFields?: string[]
    }
    onSuggestionClick?: (suggestion: string) => void
    onActionClick?: (action: ActionButton) => void
    onAddToCart?: (product: Product) => void
}

export function ChatMessage({ message, onSuggestionClick, onActionClick, onAddToCart }: ChatMessageProps) {
    const isUser = message.type === "user"

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[80%] rounded-lg p-3 ${isUser
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
            >
                <p className="text-sm">{message.content}</p>
                
                {/* Display products if available */}
                {message.products && message.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {message.products.map((product) => (
                            <div key={product.id} className="bg-white rounded-lg p-3 border">
                                <div className="flex items-start space-x-3">
                                    <img 
                                        src={product.thumbnail} 
                                        alt={product.title}
                                        className="w-16 h-16 object-cover rounded"
                                    />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900 text-sm">{product.title}</h4>
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="font-semibold text-green-600">
                                                ${(product.price / 100).toFixed(2)}
                                            </span>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                product.inStock 
                                                    ? "bg-green-100 text-green-800" 
                                                    : "bg-red-100 text-red-800"
                                            }`}>
                                                {product.inStock ? "In Stock" : "Out of Stock"}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onAddToCart?.(product)}
                                            disabled={!product.inStock}
                                            className={`w-full mt-2 px-3 py-1 text-xs rounded transition-colors ${
                                                product.inStock
                                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            }`}
                                        >
                                            {product.inStock ? "Add to Cart" : "Out of Stock"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Display extracted address if available */}
                {message.hasAddress && message.addressData && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h4 className="text-sm font-medium text-green-800">Address Information Extracted</h4>
                        </div>
                        <div className="text-xs text-green-700 space-y-1">
                            {message.addressData.firstName && message.addressData.lastName && (
                                <div><strong>Name:</strong> {message.addressData.firstName} {message.addressData.lastName}</div>
                            )}
                            {message.addressData.company && (
                                <div><strong>Company:</strong> {message.addressData.company}</div>
                            )}
                            {message.addressData.address && (
                                <div><strong>Address:</strong> {message.addressData.address}</div>
                            )}
                            {message.addressData.city && (
                                <div><strong>City:</strong> {message.addressData.city}</div>
                            )}
                            {message.addressData.province && (
                                <div><strong>State/Province:</strong> {message.addressData.province}</div>
                            )}
                            {message.addressData.postalCode && (
                                <div><strong>Postal Code:</strong> {message.addressData.postalCode}</div>
                            )}
                            {message.addressData.country && (
                                <div><strong>Country:</strong> {message.addressData.country}</div>
                            )}
                            {message.addressData.phone && (
                                <div><strong>Phone:</strong> {message.addressData.phone}</div>
                            )}
                            {message.addressData.email && (
                                <div><strong>Email:</strong> {message.addressData.email}</div>
                            )}
                        </div>
                        {message.missingFields && message.missingFields.length > 0 && (
                            <div className="mt-2 text-xs text-orange-600">
                                <strong>Missing:</strong> {message.missingFields.join(", ")}
                            </div>
                        )}
                    </div>
                )}

                {/* Display suggestions if available */}
                {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => onSuggestionClick?.(suggestion)}
                                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* Display action buttons if available */}
                {message.showActions && message.actions && message.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => onActionClick?.(action)}
                                className={`text-xs px-3 py-1 rounded transition-colors ${
                                    action.variant === "outline"
                                        ? "border border-blue-600 text-blue-600 hover:bg-blue-50"
                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </span>
            </div>
        </div>
    )
}
