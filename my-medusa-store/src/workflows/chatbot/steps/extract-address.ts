import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import OpenAI from "openai"

export interface ExtractAddressInput {
    query: string
}

export interface AddressData {
    firstName?: string
    lastName?: string
    address?: string
    city?: string
    postalCode?: string
    province?: string
    country?: string
    company?: string
    phone?: string
    email?: string
}

export interface AddressExtractionResult {
    hasAddress: boolean
    addressData: AddressData
    confidence: number
    missingFields: string[]
}

export const extractAddressStep = createStep(
    "extract-address-step",
    async ({ query }: ExtractAddressInput) => {
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
            return new StepResponse({
                hasAddress: false,
                addressData: {},
                confidence: 0,
                missingFields: []
            })
        }

        try {
            const openai = new OpenAI({ apiKey })

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Extract shipping address information from the user's message.

Respond with ONLY a JSON object:
{
  "hasAddress": true/false,
  "addressData": {
    "firstName": "string or null",
    "lastName": "string or null",
    "address": "street address or null",
    "city": "string or null",
    "postalCode": "string or null",
    "province": "state/province or null",
    "country": "country name or null",
    "company": "string or null",
    "phone": "string or null",
    "email": "string or null"
  },
  "confidence": 0.0-1.0,
  "missingFields": ["field1", "field2"]
}

Rules:
- Set hasAddress to true only if at least address, city, and country are present
- Extract all available fields from the message
- Use null for missing fields
- Only include ESSENTIAL shipping fields in missingFields: firstName, lastName, address, city, postalCode, province, country
- Optional fields (company, phone, email) should NEVER be included in missingFields
- Confidence should reflect how complete the address is

Examples:

Input: "My address is 123 Main St, New York, NY 10001, USA. Name is John Doe"
Output: {
  "hasAddress": true,
  "addressData": {
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St",
    "city": "New York",
    "postalCode": "10001",
    "province": "NY",
    "country": "USA",
    "company": null,
    "phone": null,
    "email": null
  },
  "confidence": 0.95,
  "missingFields": []
}

Input: "Ship to John Smith, 456 Oak Ave, Los Angeles CA 90001, phone 555-1234"
Output: {
  "hasAddress": true,
  "addressData": {
    "firstName": "John",
    "lastName": "Smith",
    "address": "456 Oak Ave",
    "city": "Los Angeles",
    "postalCode": "90001",
    "province": "CA",
    "country": "USA",
    "company": null,
    "phone": "555-1234",
    "email": null
  },
  "confidence": 0.95,
  "missingFields": []
}

Input: "I want to buy shoes"
Output: {
  "hasAddress": false,
  "addressData": {},
  "confidence": 0,
  "missingFields": []
}`
                    },
                    {
                        role: "user",
                        content: String(query)
                    }
                ],
                temperature: 0.1,
                max_tokens: 500
            })

            const result = completion.choices[0]?.message?.content
            if (result) {
                const parsed = JSON.parse(result)
                return new StepResponse({
                    hasAddress: parsed.hasAddress || false,
                    addressData: parsed.addressData || {},
                    confidence: parsed.confidence || 0,
                    missingFields: parsed.missingFields || []
                })
            }
        } catch (error) {
            console.warn("Address extraction failed:", error)
        }

        return new StepResponse({
            hasAddress: false,
            addressData: {},
            confidence: 0,
            missingFields: []
        })
    }
)
