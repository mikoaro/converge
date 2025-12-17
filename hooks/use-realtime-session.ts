// apps/web/hooks/use-realtime-session.ts
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_payload?: any;
  created_at?: string;
}

export function useRealtimeSession(sessionId: string) {
  const [userId, setUserId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("converge_user_id");
      if (!storedId) {
        storedId = uuidv4();
        localStorage.setItem("converge_user_id", storedId);
      }
      setUserId(storedId);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const fetchHistory = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    fetchHistory();

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newMsg.id);
            if (exists) return prev;
            
            if (newMsg.role === 'assistant') setIsTyping(false);
            
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: text,
      sender_id: userId,
    });

    setIsTyping(true);

    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          sessionId: sessionId,
          userLocation: "Austin, TX",
        }),
      });
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return { userId, messages, handleSend, isTyping };
}