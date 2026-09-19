import Typography from "@mui/material/Typography";

export default function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[var(--mui-palette-divider)] px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-[var(--mui-palette-divider)] text-[var(--mui-palette-text-secondary)]">
        {icon}
      </span>
      <Typography className="!font-semibold">{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </div>
  );
}
