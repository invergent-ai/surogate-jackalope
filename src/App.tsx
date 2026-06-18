import { useState } from "react";
import { Sidebar, type Tab } from "./components/Sidebar";
import { Monitor } from "./panels/Monitor";
import { Launch } from "./panels/Launch";
import { Runs } from "./panels/Runs";

export default function App() {
  const [tab, setTab] = useState<Tab>("monitor");
  return (
    <div className="layout">
      <Sidebar tab={tab} onTab={setTab} />
      <main className="content">
        {tab === "monitor" && <Monitor />}
        {tab === "launch" && <Launch onLaunched={() => setTab("monitor")} />}
        {tab === "runs" && <Runs />}
      </main>
    </div>
  );
}
