import { NextRequest, NextResponse } from "next/server";
import { windowVectorStore, llm } from "../../../../lib/langchain_supabase";
import { sb } from "../../../../lib/supabase";

// Use an LLM to parse the query into people, date_range, keywords
async function parseQuery(query: string) {
  const systemPrompt = `
You are a helpful assistant that extracts structured filters from a search query.
Given a query, extract:
- people: array of names (participants, capitalized or otherwise)
- date_range: a string describing the time range (e.g., "last week", "recently", "2023-01-01 to 2023-01-31")
- keywords: the remaining keywords, cleaned up

Examples:
- "What did John say to me?" -> {"people": ["John"], "date_range": null, "keywords": "said"}
- "Show me messages from Jane last week" -> {"people": ["Jane"], "date_range": "last week", "keywords": "messages"}
- "Recent conversations about work" -> {"people": [], "date_range": "recent", "keywords": "conversations work"}

Return a JSON object with keys: people (array), date_range (string or null), keywords (string).
If a field is not present, use an empty array or null or empty string as appropriate.
Respond with only the JSON.
`;

  const userPrompt = `Query: "${query}"`;

  // Use the LLM to extract the structure
  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  // Parse the LLM's response as JSON
  try {
    const parsed = JSON.parse(response.content.toString().trim());
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      date_range: typeof parsed.date_range === "string" ? parsed.date_range : null,
      keywords: typeof parsed.keywords === "string" ? parsed.keywords : ""
    };
  } catch (e) {
    // Fallback: return everything as keywords
    return { people: [], date_range: null, keywords: query };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    // Parse query for structured filters using LLM
    const { people, date_range, keywords } = await parseQuery(query);

    // Compose a filtered query string for retrieval
    let filteredQuery = keywords;
    if (people && people.length > 0) {
      filteredQuery += " " + people.join(" ");
    }
    if (date_range) {
      filteredQuery += " " + date_range;
    }
    filteredQuery = filteredQuery.trim() || query;
    
    // If the original query contains a name, make sure it's included in the search
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    const namesInQuery = query.match(namePattern);
    if (namesInQuery) {
      filteredQuery += " " + namesInQuery.join(" ");
    }

    // Retriever
    const vectorStore = await windowVectorStore;
    const retriever = vectorStore.asRetriever({ k: 12 });

    // Get relevant docs using the filtered query
    console.log(`Original query: "${query}"`);
    console.log(`Parsed filters:`, { people, date_range, keywords });
    console.log(`Searching for: "${filteredQuery}"`);
    const docs = await retriever.getRelevantDocuments(filteredQuery);
    console.log(`Found ${docs.length} relevant documents`);
    if (docs.length > 0) {
      console.log(`Sample document:`, docs[0].pageContent?.substring(0, 200));
    } else {
      console.log(`No documents found. This might indicate the data needs to be re-uploaded with the new format.`);
    }

    // Sort documents by date if the query asks for temporal information
    // TODO: Improve and generalize this
    let sortedDocs = docs;
    if (date_range && (date_range.includes('recent') || date_range.includes('latest') || date_range.includes('most recent'))) {
      sortedDocs = docs.sort((a, b) => {
        const dateA = new Date(a.metadata?.start_ts || 0);
        const dateB = new Date(b.metadata?.start_ts || 0);
        return dateB.getTime() - dateA.getTime(); // Most recent first
      });
      console.log(`Sorted ${sortedDocs.length} documents by date (most recent first)`);
    } else if (date_range && (date_range.includes('earliest') || date_range.includes('oldest') || date_range.includes('first'))) {
      sortedDocs = docs.sort((a, b) => {
        const dateA = new Date(a.metadata?.start_ts || 0);
        const dateB = new Date(b.metadata?.start_ts || 0);
        return dateA.getTime() - dateB.getTime(); // Earliest first
      });
      console.log(`Sorted ${sortedDocs.length} documents by date (earliest first)`);
    }

    if (docs.length === 0) {
      return NextResponse.json({
        answer: "No relevant conversations found for your query.",
        snippets: [],
        filters: { people, date_range, keywords }
      });
    }

    // Create a more targeted prompt for message analysis
    const systemPrompt = `You are analyzing chat message conversations. Your job is to answer user questions about these conversations in a natural, conversational way.

Each conversation snippet includes:
- The date when it occurred
- The participants involved (contact names/phone numbers)
- The actual message content

RESPONSE GUIDELINES:
- Provide natural, easy-to-understand summaries
- Include relevant context like who said what and when
- Be conversational and clear, not robotic or overly formatted
- If someone asked a specific question, give a direct answer with context
- Mention the person's name and date naturally within your response
- Keep responses concise but informative

EXAMPLES OF GOOD RESPONSES:
- "John suggested meeting at the coffee shop downtown on Tuesday afternoon."
- "Jane mentioned she's working on a new project and might be busy this week."
- "Urjeet recommended trying the new restaurant on Main Street, said the food was amazing."

If the requested information is not present in the conversation snippets, say so clearly.

Provide a natural, conversational response that directly answers the user's question.`;

    const threadIds = [...new Set(docs.map(doc => doc.metadata?.thread_id).filter(Boolean))];
    const contactsByThread: Record<string, string[]> = {};
    
    for (const threadId of threadIds) {
      try {
        const { data: messagesData, error: messagesError } = await sb
          .from('messages')
          .select('contact_name')
          .eq('thread_id', threadId)
          .not('contact_name', 'is', null)
          .limit(10);
        
        if (!messagesError && messagesData) {
          const contactNames = [...new Set(messagesData.map(m => m.contact_name).filter(Boolean))];
          contactsByThread[threadId] = contactNames;
        }
      } catch (error) {
        console.warn(`Failed to fetch contact names for thread ${threadId}:`, error);
      }
    }

    const conversationText = docs.map((doc, index) => {
      const metadata = doc.metadata || {};
      const date = metadata.start_ts ? new Date(metadata.start_ts).toLocaleDateString() : 'Unknown date';
      const threadId = metadata.thread_id || 'Unknown thread';
      const contactNames = contactsByThread[threadId] || [];
      const participantNames = contactNames.length > 0 ? contactNames.join(', ') : 'Unknown participants';
      
      return `Conversation ${index + 1} - Date: ${date} - Participants: ${participantNames}:\n${doc.pageContent}`;
    }).join('\n\n');

    const userPrompt = `User question: "${query}"

Relevant conversations:
${conversationText}

Please provide a natural, conversational answer to the user's question based on the conversation data above. Include relevant context like who said what and when, but keep it easy to read and understand.`;

    const response = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]);

    return NextResponse.json({
      answer: response.content.toString(),
      snippets: docs.map((d) => ({ content: d.pageContent, metadata: d.metadata })),
      filters: { people, date_range, keywords }
    });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
