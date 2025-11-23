import React from "react";
import { Drawer, Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function UniversalDrawer({
  open,
  onClose,
  title = "Drawer",
  width = "60vw",
  children
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: "65vw",
          maxWidth: "1000px",
          minWidth: "800px",
          bgcolor: "#ffffff",
          borderRadius: 0,
          display: "flex",
          flexDirection: "column"
        }
      }}
    >
      {/* Header (Title + Close button) */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "#fff"
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "#111827"
          }}
        >
          {title}
        </Typography>

        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "#6b7280",
            "&:hover": { bgcolor: "#f3f4f6" }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 3
        }}
      >
        {children}
      </Box>
    </Drawer>
  );
}
