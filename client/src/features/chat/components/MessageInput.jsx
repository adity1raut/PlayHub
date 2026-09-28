import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button, IconButton, inputClass } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB, attachmentIcon, attachmentKind, formatBytes } from "../attachments";

const MAX_LENGTH = 1000; // Message.content maxLength on the server
const MAX_HEIGHT = 128;

/** The picked file above the composer: thumbnail (photo / video) or icon, size, and upload progress. */
const AttachmentPreview = ({ file, progress, onRemove }) => {
  const kind = attachmentKind(file.type);
  const [previewUrl, setPreviewUrl] = useState(null);
  const uploading = progress !== null;
  const Icon = attachmentIcon(file.type);

  // Object URLs are cheap to create but must be released
  useEffect(() => {
    if (kind !== "image" && kind !== "video") return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, kind]);

  return (
    <div className="mb-2 flex items-center gap-3 border border-border bg-background/60 p-2">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-primary">
        {kind === "image" && previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : kind === "video" && previewUrl ? (
          <video src={previewUrl} muted playsInline preload="metadata" className="size-full object-cover" />
        ) : (
          <Icon className="size-5" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-foreground">{file.name}</p>
        <p className="mt-0.5 text-[11px] text-faint tabular-nums">
          {uploading ? `Uploading… ${progress}%` : `${formatBytes(file.size)} · add a caption or press Send`}
        </p>
        {uploading && (
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-1.5 h-1 bg-muted"
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {!uploading && <IconButton icon={X} label="Remove attachment" size="sm" onClick={onRemove} />}
    </div>
  );
};

const MessageInput = ({
  conversationId,
  messageInput,
  handleInputChange,
  handleKeyPress,
  handleTypingStop,
  sendMessage,
  isConnected = true,
  sending = false,
  attachment = null,
  onAttach,
  onRemoveAttachment,
  uploadProgress = null,
  uploadBusy = false,
  placeholder = "Type a message",
}) => {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const uploading = uploadProgress !== null;
  const canSend =
    (Boolean(messageInput.trim()) || Boolean(attachment)) &&
    messageInput.length <= MAX_LENGTH &&
    !sending &&
    !(attachment && uploadBusy);

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

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onAttach?.(file);
    textareaRef.current?.focus();
  };

  // Pasting a screenshot / file attaches it
  const handlePaste = (e) => {
    const file = e.clipboardData?.files?.[0];
    if (!file || uploading) return;
    e.preventDefault();
    onAttach?.(file);
  };

  const dropProps = onAttach && {
    onDragOver: (e) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false),
    onDrop: (e) => {
      const file = e.dataTransfer?.files?.[0];
      setDragging(false);
      if (!file) return;
      e.preventDefault();
      if (!uploading) onAttach(file);
    },
  };

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-card p-3 transition-colors",
        dragging && "bg-primary/[0.06] outline-1 -outline-offset-4 outline-primary outline-dashed",
      )}
      {...dropProps}
    >
      {attachment && <AttachmentPreview file={attachment} progress={uploadProgress} onRemove={onRemoveAttachment} />}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {onAttach && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={pickFile}
              tabIndex={-1}
            />
            <IconButton
              icon={Paperclip}
              label="Attach a photo, video or file"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            />
          </>
        )}
        <label htmlFor="chat-composer" className="sr-only">
          {attachment ? "Caption" : "Message"}
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={1}
          value={messageInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onBlur={handleTypingStop}
          onPaste={handlePaste}
          maxLength={MAX_LENGTH}
          placeholder={attachment ? "Add a caption (optional)" : placeholder}
          className={cn(inputClass, "h-auto min-h-10 resize-none py-2 leading-relaxed caret-primary scrollbar-thin")}
          style={{ maxHeight: MAX_HEIGHT }}
        />
        <Button
          type="submit"
          variant="solid"
          icon={Send}
          loading={sending || uploading}
          disabled={!canSend}
          aria-label={attachment ? "Send file" : "Send message"}
        >
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] tracking-[0.04em] text-faint">
        {isConnected ? (
          <span className="hidden sm:inline">
            Enter to send · Shift+Enter for a new line · Drop or paste files up to {MAX_ATTACHMENT_MB}MB
          </span>
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
