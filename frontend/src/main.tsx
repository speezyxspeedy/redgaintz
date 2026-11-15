import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./styles.css";
import App from "./App";

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ maxWidth: 560, margin: "20vh auto", padding: 24, color: "#eaf2f6", font: "16px/1.5 system-ui" }}>
        <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
        <p>TERRASCAN hit an unexpected error. Reload the page. If it keeps happening, your saved results are safe: nothing is stored on a server.</p>
        <button onClick={() => location.reload()} style={{ minHeight: 44, padding: "0 18px" }}>Reload</button>
      </main>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><Boundary><App /><SpeedInsights /></Boundary></React.StrictMode>);
