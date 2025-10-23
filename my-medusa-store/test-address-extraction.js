const OpenAI = require('openai');
require('dotenv').config();

async function testAddressExtraction() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        console.log("❌ No OpenAI API key found");
        return;
    }
    
    console.log("✅ OpenAI API key found");
    
    const openai = new OpenAI({ apiKey });
    const query = "John Doe, 123 Main St, New York, NY 10001, USA";
    
    try {
        console.log("🔍 Testing address extraction with query:", query);
        
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
- List critical missing fields in missingFields array
- Confidence should reflect how complete the address is`
                },
                {
                    role: "user",
                    content: String(query)
                }
            ],
            temperature: 0.1,
            max_tokens: 500
        });

        const result = completion.choices[0]?.message?.content;
        console.log("🤖 OpenAI Response:", result);
        
        if (result) {
            const parsed = JSON.parse(result);
            console.log("✅ Parsed result:", JSON.stringify(parsed, null, 2));
            
            if (parsed.hasAddress) {
                console.log("🎉 Address successfully extracted!");
            } else {
                console.log("❌ No address detected");
            }
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testAddressExtraction();