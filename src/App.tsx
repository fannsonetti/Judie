import { useEffect, useState } from "react";
import { HomeScreen } from "./components/home/HomeScreen";
import { UpdateOverlay } from "./components/home/UpdateOverlay";
import { bootLifecycle } from "./lib/lifecycle";
import { watchKioskFocus } from "./lib/windowControls";
import { useSettingsStore } from "./store/settingsStore";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";
import "./styles/slopbox.css";

function App() {
  const [updating, setUpdating] = useState(false);
  const lockAspect1610 = useSettingsStore((s) => s.lockAspect1610);

  useEffect(() => {
    void bootLifecycle(() => setUpdating(true));
    return watchKioskFocus();
  }, []);

  return (
    <div className={`aspect-frame${lockAspect1610 ? " locked-1610" : ""}`}>
      <div className="aspect-stage">
        <HomeScreen />
        {updating && <UpdateOverlay />}
      </div>
    </div>
  );
}

export default App;
