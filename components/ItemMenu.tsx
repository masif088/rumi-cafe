"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";

/** Menu titik tiga: edit, sembunyikan/tampilkan, hapus (dengan konfirmasi). */
export default function ItemMenu({
  name,
  hidden,
  deleteHint,
  onEdit,
  onToggleHidden,
  onDelete,
}: {
  name: string;
  hidden?: boolean;
  deleteHint?: string;
  onEdit: () => void;
  onToggleHidden: () => Promise<void> | void;
  onDelete: () => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Menu ${name}`}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onToggleHidden();
          }}
        >
          <ListItemIcon>
            {hidden ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          {hidden ? "Tampilkan" : "Sembunyikan"}
        </MenuItem>
        <MenuItem
          className="!text-[var(--mui-palette-error-main)]"
          onClick={() => {
            setAnchor(null);
            setConfirm(true);
          }}
        >
          <ListItemIcon className="!text-inherit">
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Hapus
        </MenuItem>
      </Menu>

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>Hapus {name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Data yang dihapus tidak bisa dikembalikan.
            {deleteHint ? ` ${deleteHint}` : ""} Kalau hanya ingin
            menyembunyikan, pilih Sembunyikan.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Batal</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete();
                setConfirm(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Hapus
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
