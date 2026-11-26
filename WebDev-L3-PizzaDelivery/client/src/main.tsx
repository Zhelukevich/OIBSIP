import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/nanum-pen-script/latin-400.css";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <main className="flex min-h-screen items-center justify-center bg-warm-bone p-6">
      <div className="rounded-cards border border-hairline bg-paper-white p-8 text-center">
        <h1 className="text-4xl font-medium tracking-tight">Pizza Delivery</h1>
        <button
          type="button"
          className="mt-6 rounded-buttons bg-indigo-bolt px-6 py-3 font-medium text-white"
        >
          Order now
        </button>
      </div>
    </main>
  </React.StrictMode>,
);
