import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

export default function PageHeader({
  title,
  subtitle,
  onAdd,
  addLabel = "Tambah",
}: {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </div>
      {onAdd && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}
