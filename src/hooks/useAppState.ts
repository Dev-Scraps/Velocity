import { useState } from "react";

export const useAppState = () => {
  const [currentView, setCurrentView] = useState<
    "playlist" | "downloads"
  >("downloads");
  const [searchQuery, setSearchQuery] = useState("");

  return {
    currentView,
    setCurrentView,
    searchQuery,
    setSearchQuery,
  };
};
