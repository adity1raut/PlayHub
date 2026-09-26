import { useEffect, useLayoutEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button, inputClass } from "../../../components/ui";
import { cn } from "../../../lib/cn";

const MAX_LENGTH = 1000; // Message.content maxLength on the server
const MAX_HEIGHT = 128;

const MessageInput = ({
  conversationId,
  messageInput,
  handleInputChange,
  handleKeyPress,
  handleTypingStop,
  sendMessage,
  isConnected = true,
  sending = false,
  placeholder = "Type a message",
}) => {
  const textareaRef = useRef(null);
  const canSend = Boolean(messageInput.trim()) && messageInput.length <= MAX_LENGTH && !sending;

  // Grow with the content up to MAX_HEIGHT
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_HEIGHT)}px`;
  }, [messageInput]);

  // Focus the composer when a thread opens (skip on touch so the keyboard doesn't pop up)
  useEffect(() => {
    if (conversationId && window.matchMedia?.("(pointer: fine)").matches) textareaRef.current?.focus();
  }, [conversationId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canSend) sendMessage();
  };

  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label htmlFor="chat-composer" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={1}
          value={messageInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onBlur={handleTypingStop}
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          className={cn(inputClass, "h-auto min-h-10 resize-none py-2 leading-relaxed caret-primary scrollbar-thin")}
          style={{ maxHeight: MAX_HEIGHT }}
        />
        <Button type="submit" variant="solid" icon={Send} loading={sending} disabled={!canSend} aria-label="Send message">
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] tracking-[0.04em] text-faint">
        {isConnected ? (
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
        ) : (
          <span role="status" className="text-warning">
            Link.Reconnecting — messages are sent over HTTP
          </span>
        )}
        <span
          className={cn(
            "ml-auto tabular-nums",
            messageInput.length > MAX_LENGTH * 0.9 ? "text-warning" : !messageInput && "invisible",
          )}
        >
          {messageInput.length}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
};

export default MessageInput;
