import { useEffect } from "react";
import { LayoutGroup } from "framer-motion";
import { HomeScreen } from "./components/home/HomeScreen";
import { bootLifecycle } from "./lib/lifecycle";
import { bootPerformance, usePerformanceStore } from "./lib/performance";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";
import "./styles/slopbox.css";

function App() {
  const reduced = usePerformanceStore((s) => s.reduced);

  useEffect(() => {
    bootPerformance();
    void bootLifecycle();
  }, []);

  return (
    <LayoutGroup id={reduced ? "pi" : "desktop"}>
      <HomeScreen />
    </LayoutGroup>
  );
}

export default App;
