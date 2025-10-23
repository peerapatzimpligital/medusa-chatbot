import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface GenerateFollowupInput {
    missingFields: string[]
    addressData: any
}

export interface FollowupResult {
    needsFollowup: boolean
    message: string
    suggestions: string[]
}

export const generateFollowupStep = createStep(
    "generate-followup-step",
    async ({ missingFields, addressData }: GenerateFollowupInput) => {
        if (!missingFields || missingFields.length === 0) {
            return new StepResponse({
                needsFollowup: false,
                message: "",
                suggestions: []
            })
        }

        // Generate friendly message asking for missing fields
        const fieldLabels: Record<string, string> = {
            firstName: "first name",
            lastName: "last name",
            address: "street address",
            city: "city",
            postalCode: "postal/zip code",
            province: "state/province",
            country: "country",
            phone: "phone number",
            email: "email address",
            company: "company name"
        }

        const missingLabels = missingFields.map(field => fieldLabels[field] || field)

        let message = ""
        if (missingFields.length === 1) {
            message = `Great! I just need your ${missingLabels[0]}.`
        } else if (missingFields.length === 2) {
            message = `Great! I just need your ${missingLabels[0]} and ${missingLabels[1]}.`
        } else {
            const lastField = missingLabels.pop()
            message = `Great! I just need a few more details: ${missingLabels.join(", ")}, and ${lastField}.`
        }

        // Generate example suggestions
        const suggestions: string[] = []

        if (missingFields.includes("phone")) {
            suggestions.push("555-1234")
        }
        if (missingFields.includes("email")) {
            suggestions.push("john@example.com")
        }
        if (missingFields.includes("postalCode")) {
            suggestions.push("10001")
        }

        return new StepResponse({
            needsFollowup: true,
            message,
            suggestions
        })
    }
)
