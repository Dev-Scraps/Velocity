import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, Refresh01Icon } from '@hugeicons/core-free-icons'

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentView?: "home" | "liked" | "downloads" | "settings" | "cookies";
  onSync?: () => void;
}

export const SearchBar = ({ searchQuery, setSearchQuery, currentView, onSync }: SearchBarProps) => {
  const getPageTitle = () => {
    switch (currentView) {
      case "home": return "Library";
      case "liked": return "Liked Videos";
      case "downloads": return "Downloads";
      case "settings": return "Settings";
      case "cookies": return "Cookies";
      default: return "";
    }
  };

  return (
    <div className="flex items-center justify-center flex-1 min-w-0">
      <div 
        className="h-8 rounded-lg flex items-center px-3 bg-secondary border border-border flex-1 min-w-0 max-w-lg"
        data-tauri-drag-region={false}
      >
        <HugeiconsIcon icon={Search01Icon} size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-xs outline-none ml-2 min-w-0 text-foreground placeholder-muted-foreground"
          />
      </div>
      <h1 className="text-xl font-bold text-foreground">
        {getPageTitle()}
      </h1>
      {onSync && (currentView === "liked" || currentView === "home") && (
        <button
          onClick={onSync}
          className="fluent-button rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center shrink-0"
          data-tauri-drag-region={false}
        >
          <HugeiconsIcon icon={Refresh01Icon} size={18} />
        </button>
      )}
    </div>
  );
};
