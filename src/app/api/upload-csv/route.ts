import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { sb } from "../../../../lib/supabase";
import { windowVectorStore } from "../../../../lib/langchain_supabase";

type CSVRow = {
  phone_number?: string;
  contact_name?: string;
  is_from_me?: string;
  date?: string;
  body?: string;
  group_chat_name?: string;
};

export async function POST(request: NextRequest) {
  try {
    console.log("Upload CSV endpoint called");
    const { csvText } = await request.json();
    if (!csvText) return NextResponse.json({ error: "csvText required" }, { status: 400 });
    console.log("CSV text received, length:", csvText.length);

    // Clear all existing data to ensure fresh upload
    console.log("Clearing existing data...");
    const { error: clearEmbeddingsErr } = await sb.from("window_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearEmbeddingsErr) console.warn("Failed to clear embeddings:", clearEmbeddingsErr);
    
    const { error: clearWindowsErr } = await sb.from("windows").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearWindowsErr) console.warn("Failed to clear windows:", clearWindowsErr);
    
    const { error: clearMessagesErr } = await sb.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearMessagesErr) console.warn("Failed to clear messages:", clearMessagesErr);
    
    const { error: clearThreadsErr } = await sb.from("threads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearThreadsErr) console.warn("Failed to clear threads:", clearThreadsErr);
    
    const { error: clearParticipantsErr } = await sb.from("participants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearParticipantsErr) console.warn("Failed to clear participants:", clearParticipantsErr);
    
    console.log("Existing data cleared, starting fresh upload");

    const parsed = Papa.parse<CSVRow>(csvText, { header: true });
    const rows = parsed.data.filter((r: CSVRow) => r.body && r.body.trim().length);

    // 1. Insert participants + threads + messages
    const participantsCache: Record<string, string> = {};
    const threadsCache: Record<string, string> = {};

    async function getOrCreateParticipant(handle: string) {
      if (participantsCache[handle]) return participantsCache[handle];
      const { data, error } = await sb.from("participants").select("id").eq("handle", handle).maybeSingle();
      if (error) throw error;
      if (data) {
        participantsCache[handle] = data.id;
        return data.id;
      }
      const { data: ins, error: insErr } = await sb.from("participants")
        .insert({ handle, display_name: handle })
        .select("id")
        .single();
      if (insErr) throw insErr;
      participantsCache[handle] = ins.id;
      return ins.id;
    }

    async function getOrCreateThread(threadKey: string, displayName?: string) {
      if (threadsCache[threadKey]) return threadsCache[threadKey];
      const { data, error } = await sb.from("threads").select("id").eq("apple_chat_id", threadKey).maybeSingle();
      if (error) throw error;
      if (data) {
        threadsCache[threadKey] = data.id;
        return data.id;
      }
      const { data: ins, error: insErr } = await sb.from("threads")
        .insert({ apple_chat_id: threadKey, display_name: displayName || threadKey })
        .select("id")
        .single();
      if (insErr) throw insErr;
      threadsCache[threadKey] = ins.id;
      return ins.id;
    }

    function parseDate(d?: string) {
      if (!d) return new Date().toISOString();
      if (/^\d+$/.test(d)) {
        const n = Number(d);
        return new Date(d.length >= 13 ? n : n * 1000).toISOString();
      }
      const dt = new Date(d);
      return !isNaN(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
    }

    const messagesToInsert: any[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      
      const handle = r.phone_number || r.group_chat_name || "unknown";
      const threadKey = r.group_chat_name || handle;
      const sentAt = parseDate(r.date);
      const is_from_me = r.is_from_me === "1" || r.is_from_me?.toLowerCase() === "true";
      const body = (r.body || "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\\/g, '\\\\') // Escape backslashes
        .trim();

      try {
        // eslint-disable-next-line no-await-in-loop
        const pid = await getOrCreateParticipant(handle);
        // eslint-disable-next-line no-await-in-loop
        const tid = await getOrCreateThread(threadKey, r.group_chat_name);

        messagesToInsert.push({
          source_message_id: Math.floor(Math.random() * 1e12),
          thread_id: tid,
          sender_id: pid,
          sent_at: sentAt,
          body,
          is_from_me,
          contact_name: r.contact_name || null,
        });
      } catch (error) {
        console.error(`Error processing row ${i + 1}:`, error);
        // Continue with other rows
      }
    }
    
    if (messagesToInsert.length > 0) {
      console.log(`Inserting ${messagesToInsert.length} messages...`);
      const { error: msgErr } = await sb.from("messages").upsert(messagesToInsert, { onConflict: "source_message_id" });
      if (msgErr) {
        console.error("Failed to insert messages:", msgErr);
        return NextResponse.json({ error: "Failed to insert messages", details: msgErr.message }, { status: 500 });
      }
      console.log("All messages inserted successfully");
    }

    // 2. Build windows (45-min gap)
    const { data: newMessages, error: newMsgErr } = await sb.from("messages")
      .select("*")
      .order("sent_at");
    if (newMsgErr) return NextResponse.json({ error: "Failed to fetch new messages", details: newMsgErr.message }, { status: 500 });

    const windows: any[] = [];
    const byThread: Record<string, any[]> = {};
    for (const m of newMessages || []) {
      (byThread[m.thread_id] ||= []).push(m);
    }

    function makeWindow(threadId: string, msgs: any[]) {
      return {
        id: uuidv4(),
        thread_id: threadId,
        start_ts: msgs[0].sent_at,
        end_ts: msgs[msgs.length - 1].sent_at,
        message_count: msgs.length,
        text_snippet: msgs.map((m) => {
          const sender = m.contact_name || (m.is_from_me ? "Me" : "Unknown");
          return `${sender}: ${m.body}`;
        }).join("\n").slice(0, 8000),
      };
    }

    for (const [threadId, msgs] of Object.entries(byThread)) {
      let bucket: any[] = [];
      let lastTs: number | null = null;

      for (const m of msgs) {
        const cur = new Date(m.sent_at).getTime();
        if (!lastTs || cur - lastTs <= 45 * 60 * 1000) {
          bucket.push(m);
        } else {
          if (bucket.length) windows.push(makeWindow(threadId, bucket));
          bucket = [m];
        }
        lastTs = cur;
      }
      if (bucket.length) windows.push(makeWindow(threadId, bucket));
    }

    if (windows.length > 0) {
      console.log(`Inserting ${windows.length} windows...`);
      const { error: winErr } = await sb.from("windows").insert(windows);
      if (winErr) {
        console.error("Failed to insert windows:", winErr);
        return NextResponse.json({ error: "Failed to insert windows", details: winErr.message }, { status: 500 });
      }
      console.log("All windows inserted successfully");
    }

    // 3. Embed windows with LangChain
    if (windows.length > 0) {
      try {
        const vectorStore = await windowVectorStore;
        
        const documents = windows.map((w) => ({
          pageContent: w.text_snippet,
          metadata: { 
            window_id: w.id, 
            thread_id: w.thread_id, 
            start_ts: w.start_ts, 
            end_ts: w.end_ts 
          },
        }));
        
        const result = await vectorStore.addDocuments(documents);
        console.log(`Successfully embedded ${windows.length} windows`);
      } catch (vectorError) {
        console.error("Vector store embedding failed:", vectorError);
        // Continue without embeddings - data is still saved to Supabase
      }
    }

    return NextResponse.json({ ok: true, inserted: messagesToInsert.length, windows: windows.length });
  } catch (error) {
    console.error("Upload error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
