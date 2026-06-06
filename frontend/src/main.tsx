import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { Dashboard } from "./app/App";
import { ReportRoute } from "./app/ReportRoute";
import { ShopeeRoute } from "./app/ShopeeRoute";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Handoff targets owned by H2 — placeholders so routing is wired. */}
        <Route path="/report/:runId" element={<ReportRoute />} />
        <Route path="/shopee/:listingId" element={<ShopeeRoute />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
