import { useState, ReactNode } from "react";
import { ChatCircleDots, Lightbulb, Gear } from "@phosphor-icons/react";

type TabProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
};

export const Tab = ({ children }: TabProps) => {
  return <>{children}</>;
};

export const Tabs = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState(0);

  const tabs = Array.isArray(children) ? children : [children];

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
                ? "bg-white text-slate-900 border border-b-0 border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.props.icon && <span className="text-lg">{tab.props.icon}</span>}
            {tab.props.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 border border-slate-200 rounded-b-xl bg-white shadow-sm">
        {tabs[active]}
      </div>
    </div>
  );
};

// Example usage (non-exported)
function ExampleTabs() {
  return (
    <Tabs>
      <Tab
        label="Chat"
        icon={<ChatCircleDots size={20} weight="duotone" />}
      >
        <p>Here’s where chat messages will show up.</p>
      </Tab>

      <Tab
        label="Ideas"
        icon={<Lightbulb size={20} weight="duotone" />}
      >
        <ul className="list-disc pl-5 space-y-1">
          <li>Mind map brainstorms</li>
          <li>AI-generated suggestions</li>
          <li>Random shower thoughts</li>
        </ul>
      </Tab>

      <Tab
        label="Settings"
        icon={<Gear size={20} weight="duotone" />}
      >
        <p>Manage your board preferences and options here.</p>
      </Tab>
    </Tabs>
  );
}

export default Tabs
