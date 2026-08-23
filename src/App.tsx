import { useEffect, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { HomeScreen } from "./components/home/HomeScreen";
import { UpdateOverlay } from "./components/home/UpdateOverlay";
import { bootLifecycle } from "./lib/lifecycle";
import { bootPerformance, usePerformanceStore } from "./lib/performance";
import { watchKioskFocus } from "./lib/windowControls";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";
import "./styles/slopbox.css";

function App() {
  const reduced = usePerformanceStore((s) => s.reduced);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    bootPerformance();
    void bootLifecycle(() => setUpdating(true));
    return watchKioskFocus();
  }, []);

  return (
    <LayoutGroup id={reduced ? "pi" : "desktop"}>
      <HomeScreen />
      {updating && <UpdateOverlay />}
    </LayoutGroup>
  );
}

export default App;
