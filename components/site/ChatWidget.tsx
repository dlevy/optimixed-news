"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/md/Icon";
import { MarkdownLite } from "@/components/site/MarkdownLite";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    'Hi! Ask me about SEO & digital-marketing news — e.g. "show me recent Google algorithm updates" or "what\'s new in technical SEO?"',
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1) }), // drop the canned greeting
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer ?? data.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the assistant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-6 right-6 z-50 grid place-items-center size-14 rounded-full bg-primary text-on-primary shadow-e3 hover:shadow-e4 transition-shadow"
      >
        <Icon name={open ? "close" : "forum"} filled className="text-[26px]" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col w-[min(384px,calc(100vw-2rem))] h-[min(560px,70vh)] rounded-xl bg-surface-container-low shadow-e3 border border-outline-variant overflow-hidden">
          <header className="flex items-center gap-2 px-4 h-14 bg-surface-container border-b border-outline-variant shrink-0">
            <span className="grid place-items-center size-8 rounded-full bg-primary text-on-primary">
              <Icon name="hub" filled className="text-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="text-title-small text-on-surface leading-tight">Optimixed Assistant</div>
              <div className="text-label-small text-on-surface-variant">Searches this site’s articles</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="ml-auto grid place-items-center size-9 rounded-full text-on-surface-variant hover:bg-on-surface/8"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-on-primary px-3.5 py-2 text-body-medium"
                    : "self-start max-w-[90%] rounded-2xl rounded-bl-sm bg-surface-container-high text-on-surface px-3.5 py-2 text-body-medium"
                }
              >
                {m.role === "assistant" ? <MarkdownLite text={m.content} /> : m.content}
              </div>
            ))}
            {loading && (
              <div className="self-start rounded-2xl rounded-bl-sm bg-surface-container-high text-on-surface-variant px-3.5 py-2 text-body-medium">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:0.15s]">•</span>
                  <span className="animate-bounce [animation-delay:0.3s]">•</span>
                </span>
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-outline-variant shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about SEO news…"
              className="flex-1 h-11 rounded-full bg-surface-container-high px-4 text-body-medium text-on-surface outline-none focus:outline-2 focus:outline-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="grid place-items-center size-11 rounded-full bg-primary text-on-primary disabled:opacity-[0.38] disabled:pointer-events-none"
            >
              <Icon name="send" filled className="text-[20px]" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
