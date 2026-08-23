import { useEffect, useState } from "react";
import { HomeScreen } from "./components/home/HomeScreen";
import { UpdateOverlay } from "./components/home/UpdateOverlay";
import { bootLifecycle } from "./lib/lifecycle";
import { watchKioskFocus } from "./lib/windowControls";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";
import "./styles/slopbox.css";

function App() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    void bootLifecycle(() => setUpdating(true));
    return watchKioskFocus();
  }, []);

  return (
    <>
      <HomeScreen />
      {updating && <UpdateOverlay />}
    </>
  );
}

export default App;
