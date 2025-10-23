// Country name to ISO 3166-1 alpha-2 code mapping
export const countryNameToCode: Record<string, string> = {
    // Common countries
    "united states": "US",
    "usa": "US",
    "us": "US",
    "america": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "great britain": "GB",
    "england": "GB",
    "canada": "CA",
    "australia": "AU",
    "germany": "DE",
    "france": "FR",
    "italy": "IT",
    "spain": "ES",
    "netherlands": "NL",
    "belgium": "BE",
    "switzerland": "CH",
    "austria": "AT",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "finland": "FI",
    "poland": "PL",
    "portugal": "PT",
    "greece": "GR",
    "ireland": "IE",
    "czech republic": "CZ",
    "hungary": "HU",
    "romania": "RO",

    // Asian countries
    "china": "CN",
    "japan": "JP",
    "south korea": "KR",
    "korea": "KR",
    "india": "IN",
    "singapore": "SG",
    "malaysia": "MY",
    "thailand": "TH",
    "indonesia": "ID",
    "philippines": "PH",
    "vietnam": "VN",
    "taiwan": "TW",
    "hong kong": "HK",

    // Middle East
    "saudi arabia": "SA",
    "united arab emirates": "AE",
    "uae": "AE",
    "dubai": "AE",
    "israel": "IL",
    "turkey": "TR",

    // Latin America
    "mexico": "MX",
    "brazil": "BR",
    "argentina": "AR",
    "chile": "CL",
    "colombia": "CO",

    // Africa
    "south africa": "ZA",
    "egypt": "EG",
    "nigeria": "NG",

    // Oceania
    "new zealand": "NZ"
}

export function getCountryCode(countryName: string): string {
    const normalized = countryName.toLowerCase().trim()

    // Direct lookup
    if (countryNameToCode[normalized]) {
        return countryNameToCode[normalized]
    }

    // Partial match
    for (const [name, code] of Object.entries(countryNameToCode)) {
        if (normalized.includes(name) || name.includes(normalized)) {
            return code
        }
    }

    // If it's already a 2-letter code, return uppercase
    if (normalized.length === 2) {
        return normalized.toUpperCase()
    }

    // Default to US
    return "US"
}
