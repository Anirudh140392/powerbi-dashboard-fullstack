import React, { useState } from "react";
import { Box, Container } from "@mui/material";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function CommonContainer({
  title,
  filters,
  onFiltersChange,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",

        // 🔥 REMOVE ALL HORIZONTAL SCROLL
        overflowX: "hidden",
        overflowY: "hidden",

        bgcolor: "#f5f5f5",
      }}
    >
      <Sidebar
        platforms={["Blinkit", "Instamart", "Zepto"]}
        selectedPlatform={filters?.platform}
        onPlatformChange={(p) =>
          onFiltersChange?.((prev) => ({ ...prev, platform: p }))
        }
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sx={{
          overflowX: "hidden", // <-- sidebar safe
        }}
      />

      <Box
        sx={{
          flex: 1,

          marginLeft: { xs: 0, sm: "250px" },
          width: { xs: "100%", sm: "calc(100% - 250px)" },
          display: "flex",
          flexDirection: "column",

          // 🔥 Remove horizontal scroll here also
          overflowX: "hidden",
          overflowY: "hidden",
        }}
      >
        <Header
          title={title}
          onMenuClick={() => setMobileMenuOpen(true)}
          filters={filters}
          onFiltersChange={onFiltersChange}
          sx={{
            overflowX: "hidden", // <-- prevents header small horizontal shift
          }}
        />

        {/* Scrollable only vertically */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden", // 🔥 IMPORTANT
          }}
        >
          <Container
            maxWidth={false}
            disableGutters
            sx={{
              py: 3,
              px: { xs: 2, sm: 3 },
              width: "100%",
              boxSizing: "border-box",

              overflowX: "hidden", // 🔥 no horizontal scroll inside content
            }}
          >
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
