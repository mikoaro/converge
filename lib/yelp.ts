// apps/web/lib/yelp.ts
import { z } from 'zod';

export const YelpBusinessSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number().optional().default(0),
  review_count: z.number().optional().default(0),
  image_url: z.string().optional(),
  price: z.string().optional(),
  display_phone: z.string().optional(),
  categories: z.array(z.object({ alias: z.string(), title: z.string() })).optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  // Capture the specific Yelp AI snippet
  review_snippet: z.string().optional(), 
});

export async function searchYelp(query: string, location: string, coords?: { lat: number; lng: number }) {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
      console.warn("No YELP_API_KEY detected in environment variables."); 
      return { businesses: [], summary: "" };
  }

  // Fallback coordinates for Austin, TX if only string is provided
  // Explicit coordinates drastically improve Yelp AI v2 accuracy
  const latitude = coords?.lat || 30.2672;
  const longitude = coords?.lng || -97.7431;

  try {
    const res = await fetch('https://api.yelp.com/ai/chat/v2', {
      method: 'POST',
      headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'accept': 'application/json' 
      },
      body: JSON.stringify({
        query: query,
        user_context: {
            locale: "en_US",
            latitude: latitude,
            longitude: longitude
        }
      })
    });
    
    if (!res.ok) {
        const txt = await res.text();
        console.error(`Yelp AI API Error (${res.status}):`, txt);
        return { businesses: [], summary: "" };
    }

    const data = await res.json();
    
    // Extract Yelp's own high-quality summary
    const yelpSummary = data?.response?.text || "";

    let businesses: any[] = [];
    
    // V2 RESPONSE MAPPING: Extract rich data including snippets
    if (data?.entities && Array.isArray(data.entities)) {
        for (const entity of data.entities) {
            if (entity.businesses && Array.isArray(entity.businesses)) {
                const mapped = entity.businesses.map((b: any) => ({
                    ...b,
                    // Lift the review_snippet from nested contextual_info if available
                    review_snippet: b.contextual_info?.review_snippet || null
                }));
                businesses = [...businesses, ...mapped];
            }
        }
    } else if (data?.businesses) {
        businesses = data.businesses;
    }

    console.log(`[lib/yelp] Extracted ${businesses.length} businesses. Summary: "${yelpSummary.substring(0, 50)}..."`);
    return { businesses, summary: yelpSummary };
  } catch (e) {
    console.error("Yelp Fetch Failed:", e);
    return { businesses: [], summary: "" };
  }
}