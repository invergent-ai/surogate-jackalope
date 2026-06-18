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
import { Logs } from "./panels/Logs";
import { Welcome } from "./panels/Welcome";
import { Setup } from "./panels/Setup";
import { Settings } from "./panels/Settings";
import { useTheme } from "./lib/theme";
import { getConfig, runStatus } from "./lib/ipc";

type Boot = "loading" | "setup" | "app";

export default function App() {
  const [boot, setBoot] = useState<Boot>("loading");
  const [tab, setTab] = useState<Tab>("home");
  const [theme, toggleTheme] = useTheme();
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    getConfig()
      .then((c) => setBoot(c.onboarded ? "app" : "setup"))
      .catch(() => setBoot("app"));
  }, []);

  useEffect(() => {
    const t = setInterval(() => runStatus().then(setStatus).catch(() => {}), 1000);
    return () => clearInterval(t);
  }, []);

  if (boot === "loading") return <div className="boot" />;
  if (boot === "setup") return <Setup onDone={() => setBoot("app")} />;

  const showRail = tab !== "home" && tab !== "settings";

  return (
    <div className="shell">
      <Header status={status} theme={theme} onToggleTheme={toggleTheme} />
      <div className={"body" + (showRail ? "" : " no-rail")}>
        <Sidebar tab={tab} onTab={setTab} />
        <main className="content">
          {tab === "home" && <Welcome onGo={(w) => setTab(w === "launch" ? "launch" : "providers")} />}
          {tab === "monitor" && <Monitor status={status} />}
          {tab === "launch" && <Launch onLaunched={() => setTab("monitor")} />}
          {tab === "runs" && <Runs />}
          {tab === "logs" && <Logs />}
          {tab === "models" && <HfBrowser kind="models" />}
          {tab === "datasets" && <HfBrowser kind="datasets" />}
          {tab === "gpus" && <Gpus />}
          {tab === "files" && <Files />}
          {tab === "providers" && <Providers />}
          {tab === "tips" && <Tips />}
          {tab === "settings" && (
            <Settings theme={theme} onToggleTheme={toggleTheme} onRerunSetup={() => setBoot("setup")} />
          )}
        </main>
        {showRail && <TipsRail />}
      </div>
    </div>
  );
}
