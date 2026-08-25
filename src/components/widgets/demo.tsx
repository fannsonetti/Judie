import { createContext, useContext, type ReactNode } from "react";

const WidgetDemoContext = createContext(false);

export function WidgetDemoProvider({ children }: { children: ReactNode }) {
  return <WidgetDemoContext.Provider value={true}>{children}</WidgetDemoContext.Provider>;
}

export function useWidgetDemo() {
  return useContext(WidgetDemoContext);
}
