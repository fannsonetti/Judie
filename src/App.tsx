import { useEffect } from "react";
import { HomeScreen } from "./components/home/HomeScreen";
import { UpdateOverlay } from "./components/home/UpdateOverlay";
import { bootLifecycle, useUpdateStore } from "./lib/lifecycle";
import { watchKioskFocus } from "./lib/windowControls";
import { useSettingsStore } from "./store/settingsStore";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";
import "./styles/slopbox.css";

function App() {
  const installing = useUpdateStore((s) => s.installing);
  const lockAspect1610 = useSettingsStore((s) => s.lockAspect1610);

  useEffect(() => {
    bootLifecycle();
    return watchKioskFocus();
  }, []);

  return (
    <div className={`aspect-frame${lockAspect1610 ? " locked-1610" : ""}`}>
      <div className="aspect-stage">
        <HomeScreen />
        {installing && <UpdateOverlay />}
      </div>
    </div>
  );
}

export default App;
