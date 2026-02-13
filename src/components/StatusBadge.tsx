interface StatusBadgeProps {
  status: "idle" | "anchored" | "neutral";
  label: string;
}

const variants: Record<StatusBadgeProps["status"], string> = {
  idle: "bg-muted text-muted-foreground",
  anchored: "bg-teal-50 text-primary border-primary/20",
  neutral: "bg-slate-100 text-slate-700 border-slate-300",
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${variants[status]}`}
  >
    {status === "anchored" && (
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse-gentle" />
    )}
    {label}
  </span>
);

export default StatusBadge;
