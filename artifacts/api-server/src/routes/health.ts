import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// The deployment platform health-checks the service's base path ("/api"), not
// "/api/healthz". Without a handler here Express returns 404, so the container
// is marked unhealthy and the deploy never promotes. Respond 200 on both.
router.get("/", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
