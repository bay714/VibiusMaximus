import React from "react";
import ReactDOM from "react-dom/client";
import BoardApp from "./BoardApp";
import "@/i18n";
import "../capture/capture.css";
import "./board.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BoardApp />
  </React.StrictMode>,
);
