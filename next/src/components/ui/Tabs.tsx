import React, { useState, useEffect, ReactNode } from "react";
import { ChatCircleDots, Lightbulb, Gear } from "@phosphor-icons/react";

type TabChildren = ReactNode | ((opts: { isActive?: boolean }) => ReactNode)

type TabProps = {
  label: string;
  icon?: ReactNode;
  children: TabChildren;
  headerClassName?: string;
  activeHeaderClassName?: string;
  isActive?: boolean;
};

export const Tab = ({ children, isActive }: TabProps) => {
  const isRenderProp = (c: TabChildren): c is ((opts: { isActive?: boolean }) => ReactNode) => typeof c === 'function';
  if (isRenderProp(children)) {
    try { return <>{children({ isActive })}</> } catch { return null }
  }

  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<any>;
    // If it's a native DOM element (type is string) or Fragment, don't inject props
    if (typeof el.type === 'string') {
      return <>{el}</>;
    }
    try {
      return <>{React.cloneElement(el, { isActive } as any)}</>;
    } catch {
      return <>{children}</>;
    }
  }

  return <>{children}</>;
};

export const Tabs = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState(0);
  const tabs = Array.isArray(children) ? children : [children];

  return (
    <div className="w-full">
      {/* Tab headers */}
      <div className="flex gap-2 border-b border-gray-200/50 dark:border-primary-700/20 dark:bg-slate-950/80 rounded-t-xl sm:rounded-tl-4xl" role="tablist" aria-label="Sections">
        {tabs.map((tab: any, idx) => (
          <button
            key={idx}
            onClick={() => setActive(idx)}
            className={`flex cursor-pointer items-center gap-1 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-t-xl text-base sm:text-lg font-fredoka font-medium transition-colors ${
              active === idx
                ? (tab.props.activeHeaderClassName || "text-primary-800 dark:text-gray-100 border-b-2 border-primary-500")
                : (tab.props.headerClassName || "text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200 border-b-2 border-transparent")
            }`}
            role="tab"
            aria-selected={active === idx}
            aria-controls={`tabpanel-${idx}`}
            id={`tab-${idx}`}
          >
            {tab.props.icon && <span className="text-base sm:text-lg" aria-hidden="true">{tab.props.icon}</span>}
            <span className={`${active === idx ? 'inline' : 'hidden sm:inline'}`}>{tab.props.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content (no animation) */}
      <div
        id={`tabpanel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
      >
        {React.cloneElement(tabs[active] as React.ReactElement<any>, { isActive: true } as any)}
      </div>
    </div>
  );
};

export default Tabs
