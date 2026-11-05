interface HashDisplayProps {
  label: string;
  hash: string | null;
}

const HashDisplay = ({ label, hash }: HashDisplayProps) => (
  <div className="flex-1 rounded-lg border bg-muted/50 p-4">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    {hash ? (
      <p className="hash-text animate-hash-reveal text-xs text-foreground leading-relaxed">
        {hash}
      </p>
    ) : (
      <p className="text-xs italic text-muted-foreground">Pending…</p>
    )}
  </div>
);

export default HashDisplay;
