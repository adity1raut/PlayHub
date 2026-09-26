const TypingIndicator = ({ name }) => {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 border border-border border-l-2 border-l-border-strong bg-muted px-3 py-2.5">
        <span className="sr-only">{name ? `${name} is typing` : "Typing"}</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            className="size-1.5 animate-pulse bg-primary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
};

export default TypingIndicator;
