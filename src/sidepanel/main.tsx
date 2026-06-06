import React from "react";
import ReactDOM from "react-dom/client";
import "@shared/theme.css";
import { SidePanelApp } from "./App";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidePanelApp />
    </React.StrictMode>
  );
}
