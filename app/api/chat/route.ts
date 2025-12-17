// apps/web/app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { searchYelp } from "@/lib/yelp";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sessionId, userLocation, userCoordinates } = body;

    console.log(`[API] Processing Session: ${sessionId}`);

    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemPrompt = `
        You are Connie, the Digital Concierge for the "Converge" platform.
        Current Date: ${currentDate}. 
        User Context: The user is in ${userLocation || "Austin, TX"}.

        MISSION: Help groups make decisions by finding Yelp businesses and TALLYING VOTES.
        
        RULES:
        1. To find places: ALWAYS call 'findLocalBusinesses'.
        2. To show options: Call 'showProposalCard' immediately after finding businesses.
        3. To declare a winner: If the user asks "Who won?" or "Decide", call 'getVotingResults'.
           - Compare the vote counts.
           - Declare the business with the highest votes as the winner.
           - Provide the address and a celebratory message.
    `;

    const result = await generateText({
      model: openai("gpt-4o"),
      messages,
      system: systemPrompt,
      tools: {
        findLocalBusinesses: tool({
          description: 'Query Yelp for businesses.',
          parameters: z.object({
            query: z.string().describe("The search term"),
            location: z.string().describe("The city or neighborhood"),
          }),
          execute: async ({ query, location }) => {
            console.log(`[Tool] search: ${query}`);
            const coords = userCoordinates
              ? { lat: userCoordinates.latitude, lng: userCoordinates.longitude }
              : undefined;
            const response = await searchYelp(query, location, coords);
            return {
              summary: response.summary,
              businesses: response.businesses,
            };
          },
        }),
        showProposalCard: tool({
          description: "Renders the interactive voting card.",
          parameters: z.object({
            reasoning: z.string(),
            businesses: z.array(z.object({}).passthrough()),
          }),
          execute: async ({ reasoning, businesses }) => {
            console.log(`[Tool] rendering ${businesses.length} items`);
            const businessesWithContext = businesses.map((b: any) => ({
                ...b,
                _sessionId: sessionId 
            }));

            if (sessionId && businesses.length > 0) {
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              await supabase.from("messages").insert({
                session_id: sessionId,
                role: "assistant",
                content: reasoning,
                tool_payload: { type: "proposal", businesses: businessesWithContext },
                sender_id: null,
              });
              return { rendered: true, count: businesses.length };
            }
            return { rendered: false };
          },
        }),
        // NEW TOOL: Allows Connie to see the database state
        getVotingResults: tool({
            description: "Check the current vote counts from the database to declare a winner.",
            parameters: z.object({}), // No params needed, uses sessionId from closure
            execute: async () => {
                console.log(`[Tool] Counting votes for session: ${sessionId}`);
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );
                
                // Get all votes for this session
                const { data: votes } = await supabase
                    .from('votes')
                    .select('business_id')
                    .eq('session_id', sessionId);

                if (!votes || votes.length === 0) return "No votes have been cast yet.";

                // Tally votes
                const tally: Record<string, number> = {};
                votes.forEach(v => {
                    tally[v.business_id] = (tally[v.business_id] || 0) + 1;
                });

                // Get Business Names (Recovered from message history for context)
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('tool_payload')
                    .eq('session_id', sessionId)
                    .not('tool_payload', 'is', null);
                
                let businessMap: Record<string, string> = {}; // ID -> Name
                msgs?.forEach(msg => {
                    const payload = msg.tool_payload as any;
                    if (payload.type === 'proposal' && Array.isArray(payload.businesses)) {
                        payload.businesses.forEach((b: any) => {
                            businessMap[b.id] = b.name;
                        });
                    }
                });

                // Format results for the LLM
                const results = Object.entries(tally).map(([id, count]) => ({
                    name: businessMap[id] || "Unknown Place",
                    id,
                    votes: count
                }));

                return results;
            }
        })
      },
      maxSteps: 5,
    });

    if (result.text && sessionId && result.toolCalls.length === 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: result.text,
        sender_id: null,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[API] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}