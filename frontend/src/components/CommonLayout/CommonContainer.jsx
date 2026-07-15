import React, { useState } from "react";
import { Box, Container } from "@mui/material";
import Sidebar from "./Sidebar";
import Header from "./Header";
import HelpDrawer from "./HelpDrawer";
import NotificationScroller from "./NotificationScroller";
import { FilterContext } from "../../utils/FilterContext";
import { useAuth } from "../../utils/AuthContext";
import { HelpProvider, useHelp } from "../../utils/HelpContext";

export default function CommonContainer({
  title,
  filters,
  onFiltersChange,
  hideFilters = false,
  disablePadding = false,
  /** fullHeight: the child manages its own scrolling; disable the outer scroll Box */
  fullHeight = false,
  children,
}) {
  const { channels, selectedChannel, setSelectedChannel, platforms, platformMetadata, setPlatform, platform, platformsFetched } = React.useContext(FilterContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <CommonLayoutContent
      title={title}
      filters={filters}
      onFiltersChange={onFiltersChange}
      hideFilters={hideFilters}
      disablePadding={disablePadding}
      fullHeight={fullHeight}
      channels={channels}
      selectedChannel={selectedChannel}
      setSelectedChannel={setSelectedChannel}
      platforms={platforms}
      platformMetadata={platformMetadata}
      platformsFetched={platformsFetched}
      setPlatform={setPlatform}
      currentPlatform={platform}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
      isCollapsed={isCollapsed}
      setIsCollapsed={setIsCollapsed}
      user={user}
    >
      {children}
    </CommonLayoutContent>
  );
}

function CommonLayoutContent({
  title,
  filters,
  onFiltersChange,
  hideFilters,
  disablePadding,
  fullHeight,
  channels,
  selectedChannel,
  setSelectedChannel,
  platforms,
  platformMetadata,
  platformsFetched,
  setPlatform,
  currentPlatform,
  mobileMenuOpen,
  setMobileMenuOpen,
  isCollapsed,
  setIsCollapsed,
  user,
  children,
}) {
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
        channels={channels}
        selectedChannel={selectedChannel}
        onChannelChange={(ch) => {
          setSelectedChannel(ch);
          // Clear local filters.platform so the new context platform value flows through
          onFiltersChange?.((prev) => ({ ...prev, platform: undefined }));
        }}
        platforms={platforms}
        platformMetadata={platformMetadata}
        platformsFetched={platformsFetched}
        selectedPlatform={filters?.platform || currentPlatform}
        onPlatformChange={(p) => {
          setPlatform?.(p);
          onFiltersChange?.((prev) => ({ ...prev, platform: p }));
        }}
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
        <NotificationScroller />

        <Header
          title={title}
          onMenuClick={() => setMobileMenuOpen(true)}
          filters={filters}
          onFiltersChange={onFiltersChange}
          hideFilters={hideFilters}
          sx={{
            overflowX: "hidden", // <-- prevents header small horizontal shift
          }}
        />

        {/* Scrollable only vertically (or overflow:hidden when child manages scrolling) */}
        <Box
          sx={{
            flex: 1,
            overflowY: fullHeight ? "hidden" : "auto",
            overflowX: "hidden", // 🔥 IMPORTANT
            minHeight: 0, // Ensure flex scrolling works
            WebkitOverflowScrolling: fullHeight ? "auto" : "touch",
            // fullHeight mode: become a flex column so the child can fill 100%
            ...(fullHeight && {
              display: "flex",
              flexDirection: "column",
            }),
          }}
        >
          <Container
            maxWidth={false}
            disableGutters
            sx={{
              px: disablePadding ? 0 : { xs: 2, sm: 3 },
              py: disablePadding ? 0 : { xs: 2, sm: 3 },
              width: "100%",
              overflowX: "hidden", // 🔥 no horizontal scroll inside content
              // fullHeight: stretch container to fill the scroll box
              ...(fullHeight && {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                height: "100%",
              }),
            }}
          >
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
