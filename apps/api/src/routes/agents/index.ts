/**
 * Agent Routes - Main Router
 *
 * Combines all agent-related endpoints
 */

import { Router } from "express";
import { registerRouter } from "./register.js";
import { listRouter } from "./list.js";
import { executeRouter } from "./execute.js";

const router = Router();

// Public routes (no auth required)
router.use("/", listRouter); // GET /agents, GET /agents/:id

// Protected routes (developer auth required)
router.use("/register", registerRouter); // POST /agents/register

// Execution routes (agent auth required)
router.use("/", executeRouter); // POST /agents/:id/execute, GET /executions/:id

export { router as agentsRouter };
