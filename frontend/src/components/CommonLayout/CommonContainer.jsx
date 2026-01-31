import React, { useState } from "react";
import { Box, Container } from "@mui/material";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { FilterContext } from "../../utils/FilterContext";

export default function CommonContainer({
  title,
  filters,
  onFiltersChange,
  children,
}) {
  const { platforms } = React.useContext(FilterContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sidebarWidth = isCollapsed ? "72px" : "250px";

  return (
    <Box
      sx={{
        display: "flex",
        height: "100dvh",
        width: "100vw",

        // 🔥 REMOVE ALL HORIZONTAL SCROLL
        overflowX: "hidden",
        overflowY: "hidden",

        bgcolor: "#f5f5f5",
      }}
    >
      <Sidebar
        platforms={platforms}
        selectedPlatform={filters?.platform}
        onPlatformChange={(p) =>
          onFiltersChange?.((prev) => ({ ...prev, platform: p }))
        }
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        sx={{
          overflowX: "hidden", // <-- sidebar safe
        }}
      />

      <Box
        sx={{
          flex: 1,

          marginLeft: { xs: 0, sm: sidebarWidth },
          width: { xs: "100%", sm: `calc(100% - ${sidebarWidth})` },
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",

          // 🔥 Remove horizontal scroll here also
          overflowX: "hidden",
          overflowY: "hidden",
          minHeight: 0, // Ensure flex child shrinking works
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
            minHeight: 0, // Ensure flex scrolling works
            "-webkit-overflow-scrolling": "touch", // Smooth scroll on iOS
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
