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
  const [isVisible, setIsVisible] = useState(true);

  const tabs = Array.isArray(children) ? children : [children];

  useEffect(() => {
    // trigger a quick exit/enter animation when active tab changes
    setIsVisible(false)
    const t = setTimeout(() => setIsVisible(true), 20)
    return () => clearTimeout(t)
  }, [active])

  return (
    <div className="w-full">
      {/* Tab headers */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab: any, idx) => (
          <button
            key={idx}
            onClick={() => setActive(idx)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-medium transition-colors ${
              active === idx
                ? (tab.props.activeHeaderClassName || "bg-white text-slate-900")
                : (tab.props.headerClassName || "text-slate-500 hover:text-slate-700")
            }`}
          >
            {tab.props.icon && <span className="text-lg">{tab.props.icon}</span>}
            {tab.props.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`transition-all duration-200 ease-in-out ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'}`}>
        {React.cloneElement(tabs[active] as React.ReactElement<any>, { isActive: true } as any)}
      </div>
    </div>
  );
};

export default Tabs
