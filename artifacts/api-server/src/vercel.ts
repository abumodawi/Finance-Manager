import app from "./app";

// Vercel's Node runtime invokes the default export as the request handler.
// An Express application is itself a `(req, res)` handler, so exporting the
// app directly is all that is required. Note: we intentionally do NOT call
// `app.listen()` here — Vercel manages the HTTP server for us.
export default app;
