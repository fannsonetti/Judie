import { LayoutGroup } from "framer-motion";
import { HomeScreen } from "./components/home/HomeScreen";
import "./styles/global.css";
import "./styles/apps.css";
import "./styles/chrome.css";

function App() {
  return (
    <LayoutGroup>
      <HomeScreen />
    </LayoutGroup>
  );
}

export default App;
