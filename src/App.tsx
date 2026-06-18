import { useEffect, useState } from "react";
import { Sidebar, type Tab } from "./components/Sidebar";
import { Header } from "./components/Header";
import { TipsRail } from "./components/TipsRail";
import { Monitor } from "./panels/Monitor";
import { Launch } from "./panels/Launch";
import { Runs } from "./panels/Runs";
import { Gpus } from "./panels/Gpus";
import { Tips } from "./panels/Tips";
import { Files } from "./panels/Files";
import { Providers } from "./panels/Providers";
import { HfBrowser } from "./panels/HfBrowser";
import { useTheme } from "./lib/theme";
import { runStatus } from "./lib/ipc";

export default function App() {
  const [tab, setTab] = useState<Tab>("monitor");
  const [theme, toggleTheme] = useTheme();
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const t = setInterval(() => runStatus().then(setStatus).catch(() => {}), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="shell">
      <Header status={status} theme={theme} onToggleTheme={toggleTheme} />
      <div className="body">
        <Sidebar tab={tab} onTab={setTab} />
        <main className="content">
          {tab === "monitor" && <Monitor />}
          {tab === "launch" && <Launch onLaunched={() => setTab("monitor")} />}
          {tab === "runs" && <Runs />}
          {tab === "models" && <HfBrowser kind="models" />}
          {tab === "datasets" && <HfBrowser kind="datasets" />}
          {tab === "gpus" && <Gpus />}
          {tab === "files" && <Files />}
          {tab === "providers" && <Providers />}
          {tab === "tips" && <Tips />}
        </main>
        <TipsRail />
      </div>
    </div>
  );
}
