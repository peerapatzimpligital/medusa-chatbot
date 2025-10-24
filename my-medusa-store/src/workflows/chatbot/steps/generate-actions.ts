import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface GenerateActionsInput {
    intentType: string
    hasProducts: boolean
    cartItemCount?: number
}

export interface ActionButton {
    id: string
    label: string
    action: string
    variant?: "primary" | "secondary" | "outline"
}

export interface ActionsResult {
    actions: ActionButton[]
    showActions: boolean
}

export const generateActionsStep = createStep(
    "generate-actions-step",
    async ({ intentType, hasProducts, cartItemCount = 0 }: GenerateActionsInput) => {
        const actions: ActionButton[] = []

        // Product search results - offer to continue or checkout
        if (intentType === "product_search" && hasProducts) {
            actions.push({
                id: "continue_shopping",
                label: "Continue Shopping",
                action: "continue_shopping",
                variant: "outline"
            })

            if (cartItemCount > 0) {
                // actions.push({
                //     id: "view_cart",
                //     label: `View Cart (${cartItemCount})`,
                //     action: "view_cart",
                //     variant: "secondary"
                // })
                actions.push({
                    id: "complete_order_now",
                    label: "Complete Order Now",
                    action: "complete_order_now",
                    variant: "primary"
                })
            }
        }

        // After adding to cart
        if (intentType === "add_to_cart") {
            actions.push({
                id: "continue_shopping",
                label: "Continue Shopping",
                action: "continue_shopping",
                variant: "outline"
            })
            // actions.push({
            //     id: "view_cart",
            //     label: `View Cart (${cartItemCount})`,
            //     action: "view_cart",
            //     variant: "secondary"
            // })
            actions.push({
                id: "complete_order_now",
                label: "Complete Order Now",
                action: "complete_order_now",
                variant: "primary"
            })
        }

        // Cart inquiry
        if (intentType === "cart_inquiry" && cartItemCount > 0) {
            actions.push({
                id: "continue_shopping",
                label: "Continue Shopping",
                action: "continue_shopping",
                variant: "outline"
            })
            actions.push({
                id: "complete_order_now",
                label: "Complete Order Now",
                action: "complete_order_now",
                variant: "primary"
            })
        }

        // Greeting - offer to browse
        if (intentType === "greeting") {
            actions.push({
                id: "browse_products",
                label: "Browse Products",
                action: "browse_products",
                variant: "primary"
            })
            if (cartItemCount > 0) {
                // actions.push({
                //     id: "view_cart",
                //     label: `View Cart (${cartItemCount})`,
                //     action: "view_cart",
                //     variant: "secondary"
                // })
            }
        }

        // Delivery options
        if (intentType === "delivery_options") {
            actions.push({
                id: "view_delivery_options",
                label: "View Delivery Options",
                action: "view_delivery_options",
                variant: "primary"
            })
            // actions.push({
            //     id: "get_delivery_recommendation",
            //     label: "Get Recommendation",
            //     action: "get_delivery_recommendation",
            //     variant: "secondary"
            // })
        }

        // Delivery recommendation
        if (intentType === "delivery_recommendation") {
            // actions.push({
            //     id: "get_delivery_recommendation",
            //     label: "Get Recommendation",
            //     action: "get_delivery_recommendation",
            //     variant: "primary"
            // })
            actions.push({
                id: "view_delivery_options",
                label: "View All Options",
                action: "view_delivery_options",
                variant: "outline"
            })
        }

        // Payment options
        if (intentType === "payment_options") {
            actions.push({
                id: "view_payment_options",
                label: "View Payment Options",
                action: "view_payment_options",
                variant: "primary"
            })
            // actions.push({
            //     id: "get_payment_recommendation",
            //     label: "Get Recommendation",
            //     action: "get_payment_recommendation",
            //     variant: "secondary"
            // })
        }

        // Payment recommendation
        if (intentType === "payment_recommendation") {
            // actions.push({
            //     id: "get_payment_recommendation",
            //     label: "Get Recommendation",
            //     action: "get_payment_recommendation",
            //     variant: "primary"
            // })
            actions.push({
                id: "view_payment_options",
                label: "View All Options",
                action: "view_payment_options",
                variant: "outline"
            })
        }

        // Payment selection
        if (intentType === "payment_selection") {
            actions.push({
                id: "select_payment_method",
                label: "Select Payment Method",
                action: "select_payment_method",
                variant: "primary"
            })
            actions.push({
                id: "view_payment_options",
                label: "View Options",
                action: "view_payment_options",
                variant: "outline"
            })
        }

        // Order completion
        if (intentType === "order_completion") {
            if (cartItemCount > 0) {
                actions.push({
                    id: "continue_to_review",
                    label: "Continue to Review",
                    action: "continue_to_review",
                    variant: "primary"
                })
                actions.push({
                    id: "complete_order_now",
                    label: "Complete Order Now",
                    action: "complete_order_now",
                    variant: "secondary"
                })
                actions.push({
                    id: "view_cart",
                    label: "Check My Cart",
                    action: "view_cart",
                    variant: "outline"
                })
            } else {
                actions.push({
                    id: "browse_products",
                    label: "Browse Products",
                    action: "browse_products",
                    variant: "primary"
                })
            }
        }

        // Order review
        if (intentType === "order_review") {
            if (cartItemCount > 0) {
                actions.push({
                    id: "review_order_details",
                    label: "Review Order Details",
                    action: "review_order_details",
                    variant: "primary"
                })
                actions.push({
                    id: "continue_to_payment",
                    label: "Continue to Payment",
                    action: "continue_to_payment",
                    variant: "secondary"
                })
                actions.push({
                    id: "edit_cart",
                    label: "Edit My Cart",
                    action: "edit_cart",
                    variant: "outline"
                })
            } else {
                actions.push({
                    id: "browse_products",
                    label: "Browse Products",
                    action: "browse_products",
                    variant: "primary"
                })
            }
        }

        // Checkout assistance
        if (intentType === "checkout_help" || intentType === "help") {
            if (cartItemCount > 0) {
                // actions.push({
                //     id: "view_cart",
                //     label: "Review Cart",
                //     action: "view_cart",
                //     variant: "secondary"
                // })
                // actions.push({
                //     id: "checkout",
                //     label: "Continue to Checkout",
                //     action: "checkout",
                //     variant: "primary"
                // })
            } else {
                actions.push({
                    id: "browse_products",
                    label: "Browse Products",
                    action: "browse_products",
                    variant: "primary"
                })
            }
        }

        return new StepResponse({
            actions,
            showActions: actions.length > 0
        })
    }
)
