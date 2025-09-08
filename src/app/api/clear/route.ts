import { NextRequest, NextResponse } from "next/server";
import { sb } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  try {
    console.log("Clear all data endpoint called");

    // Clear all tables in the correct order to respect foreign key constraints
    // Start with the most dependent tables first
    
    // 1. Clear window_embeddings (depends on windows)
    console.log("Clearing window_embeddings...");
    const { error: clearEmbeddingsErr } = await sb
      .from("window_embeddings")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearEmbeddingsErr) {
      console.error("Failed to clear window_embeddings:", clearEmbeddingsErr);
      return NextResponse.json({ 
        error: "Failed to clear window_embeddings", 
        details: clearEmbeddingsErr.message 
      }, { status: 500 });
    }
    
    // 2. Clear windows (depends on threads)
    console.log("Clearing windows...");
    const { error: clearWindowsErr } = await sb
      .from("windows")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearWindowsErr) {
      console.error("Failed to clear windows:", clearWindowsErr);
      return NextResponse.json({ 
        error: "Failed to clear windows", 
        details: clearWindowsErr.message 
      }, { status: 500 });
    }
    
    // 3. Clear messages (depends on threads and participants)
    console.log("Clearing messages...");
    const { error: clearMessagesErr } = await sb
      .from("messages")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearMessagesErr) {
      console.error("Failed to clear messages:", clearMessagesErr);
      return NextResponse.json({ 
        error: "Failed to clear messages", 
        details: clearMessagesErr.message 
      }, { status: 500 });
    }
    
    // 4. Clear threads (independent)
    console.log("Clearing threads...");
    const { error: clearThreadsErr } = await sb
      .from("threads")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearThreadsErr) {
      console.error("Failed to clear threads:", clearThreadsErr);
      return NextResponse.json({ 
        error: "Failed to clear threads", 
        details: clearThreadsErr.message 
      }, { status: 500 });
    }
    
    // 5. Clear participants (independent)
    console.log("Clearing participants...");
    const { error: clearParticipantsErr } = await sb
      .from("participants")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearParticipantsErr) {
      console.error("Failed to clear participants:", clearParticipantsErr);
      return NextResponse.json({ 
        error: "Failed to clear participants", 
        details: clearParticipantsErr.message 
      }, { status: 500 });
    }
    
    console.log("All tables cleared successfully");
    
    return NextResponse.json({ 
      ok: true, 
      message: "All data cleared successfully" 
    });
    
  } catch (error) {
    console.error("Clear data error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
