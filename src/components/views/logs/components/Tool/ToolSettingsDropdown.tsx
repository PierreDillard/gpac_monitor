import { useMemo, useCallback, memo, useState, forwardRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { IoSettings } from 'react-icons/io5';
import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { TOOL_DISPLAY_NAMES } from '../../utils/constants';
import { getEffectiveLevel, sortTools } from '../../utils/toolUtils';
import { useSearchFilter } from '@/shared/hooks/filters/useSearchFilter';
import { ToolRow } from './ToolRow';

interface ToolSettingsDropdownProps {
  levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
  defaultAllLevel: GpacLogLevel;
  currentTool: GpacLogTool;
  onToolLevelChange: (tool: GpacLogTool, level: GpacLogLevel) => void;
  onDefaultAllLevelChange: (level: GpacLogLevel) => void;
  onToolNavigate?: (tool: GpacLogTool) => void;
}

export const ToolSettingsDropdown = memo(
  forwardRef<HTMLButtonElement, ToolSettingsDropdownProps>(
    function ToolSettingsDropdown(
      {
        levelsByTool,
        defaultAllLevel,
        currentTool,
        onToolLevelChange,
        onDefaultAllLevelChange,
        onToolNavigate,
      },
      ref,
    ) {
      const [isOpen, setIsOpen] = useState(false);
      const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
      const [searchQuery, setSearchQuery] = useState('');

      const handleLevelChange = useCallback(
        (tool: GpacLogTool, level: GpacLogLevel) => {
          if (tool === GpacLogTool.ALL) onDefaultAllLevelChange(level);
          else onToolLevelChange(tool, level);
          setOpenSubMenu(null);
        },
        [onToolLevelChange, onDefaultAllLevelChange],
      );

      const sortedTools = useMemo(() => sortTools(currentTool), [currentTool]);

      const filteredTools = useSearchFilter(
        sortedTools,
        searchQuery,
        useCallback(
          (tool: GpacLogTool) => [tool, TOOL_DISPLAY_NAMES[tool]],
          [],
        ),
      );

      const toolItems = useMemo(() => {
        if (!isOpen) return [];

        return filteredTools.map((tool) => {
          const effectiveLevel = getEffectiveLevel(
            tool,
            levelsByTool,
            defaultAllLevel,
          );
          const isCurrentTool = tool === currentTool;
          return {
            tool,
            effectiveLevel,
            isCurrentTool,
            displayName: TOOL_DISPLAY_NAMES[tool],
          };
        });
      }, [isOpen, filteredTools, levelsByTool, defaultAllLevel, currentTool]);

      const handleLevelSelect = useCallback(
        (tool: GpacLogTool, level: GpacLogLevel) => {
          // Even if the effective level is the same, we need to clean levelsByTool
          handleLevelChange(tool, level);
        },
        [handleLevelChange],
      );

      const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
      }, []);

      const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
          setSearchQuery('');
          setOpenSubMenu(null);
        }
      }, []);

      return (
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              ref={ref}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-md
              text-slate-300 hover:text-slate-100
              hover:bg-slate-800/60
              focus-visible:ring-2 focus-visible:ring-emerald-500/40
              focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              aria-label="Open logs settings"
            >
              <IoSettings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={6}
            avoidCollisions
            onScroll={() => setOpenSubMenu(null)}
            className="z-20 w-64 max-h-80 overflow-y-auto p-0
            rounded-xl shadow-xl shadow-black/50"
          >
            <div className="relative font-cond text-slate-200 text-xs">
              {/* Sticky header */}
              <div
                className="sticky top-0 z-10 w-full flex flex-col
                bg-slate-900/95 border-b border-slate-700/50"
              >
                <div className="px-3 py-2 text-sm text-slate-300">
                  Logs Configuration
                </div>
                <div className="px-3 pb-2">
                  <SearchBar
                    onSearchChange={handleSearchChange}
                    placeholder="Filter tools..."
                    debounceMs={150}
                  />
                </div>
                <DropdownMenuSeparator />
                <div
                  className="flex items-center justify-between px-8 py-2 text-[0.786rem] font-medium text-slate-400"
                  style={{
                    background:
                      'linear-gradient(to right, transparent 49%, rgba(148,163,184,.6) 49%, rgba(148,163,184,.6) 51%, transparent 51%)',
                  }}
                >
                  <span>Tool</span>
                  <span>Level</span>
                </div>
              </div>

              {/* Tools list */}
              {isOpen &&
                toolItems.map(
                  ({ tool, effectiveLevel, isCurrentTool, displayName }) => (
                    <ToolRow
                      key={tool}
                      tool={tool}
                      displayName={displayName}
                      effectiveLevel={effectiveLevel}
                      isCurrentTool={isCurrentTool}
                      isSubMenuOpen={openSubMenu === tool}
                      onToolNavigate={() => onToolNavigate?.(tool)}
                      onSubMenuToggle={(open) =>
                        setOpenSubMenu(open ? tool : null)
                      }
                      onLevelSelect={(level) => handleLevelSelect(tool, level)}
                      onMouseLeaveSubMenu={() => setOpenSubMenu(null)}
                    />
                  ),
                )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  ),
);
