/**
 * Agent Execution Endpoints
 *
 * POST /agents/:id/execute - Execute an agent
 * GET /executions/:id - Get execution status/result
 */

import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { z } from "zod";
import { logger } from "../../logger.js";
import { idempotency } from "../../middleware/idempotency.js";
import { getExecutor } from "@ap2/agent-runtime/executor";
import { getStorageService } from "../../services/agent-storage.js";

const router = Router();

/**
 * Execute agent request schema
 */
const ExecuteAgentRequestSchema = z.object({
  deployment_id: z.string().optional(), // If user has deployed agent
  inputs: z.record(z.unknown()),
  version: z.string().optional(), // Specific version, defaults to latest
});

/**
 * POST /agents/:id/execute
 *
 * Execute an agent with given inputs
 *
 * Headers:
 * - Idempotency-Key: Required for execute operations
 *
 * Body:
 * {
 *   deployment_id?: string,  // Optional: user's deployment
 *   inputs: { ... },         // Agent inputs
 *   version?: string         // Optional: specific version
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     execution_id: string,
 *     status: "pending" | "running" | "succeeded" | "failed",
 *     outputs?: {...},
 *     error?: string
 *   }
 * }
 */
router.post("/:id/execute", idempotency, async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.id!; // Guaranteed by route pattern

    // Validate request body
    const bodyValidation = ExecuteAgentRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid request body",
          details: bodyValidation.error.errors,
        },
      });
      return;
    }

    const { inputs, version, deployment_id } = bodyValidation.data;

    // Fetch agent
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: agentId },
      include: {
        versions: {
          where: version ? { version } : { status: "active" },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: `Agent "${agentId}" not found`,
        },
      });
      return;
    }

    if (agent.status !== "active") {
      res.status(400).json({
        success: false,
        error: {
          code: "AGENT_NOT_ACTIVE",
          message: "Agent is not active",
        },
      });
      return;
    }

    if (agent.versions.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "NO_VERSION_AVAILABLE",
          message: version
            ? `Version "${version}" not found`
            : "No active version available",
        },
      });
      return;
    }

    const agentVersion = agent.versions[0];
    if (!agentVersion) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Agent version not found",
        },
      });
      return;
    }

    const manifest = agentVersion.manifest as any;

    // Validate inputs against manifest
    const inputValidation = validateInputs(inputs, manifest.inputs || []);
    if (!inputValidation.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUTS",
          message: "Invalid agent inputs",
          details: inputValidation.errors,
        },
      });
      return;
    }

    // Get or create deployment
    let deploymentId = deployment_id;
    if (!deploymentId) {
      // Create temporary deployment for one-time execution
      const deployment = await prisma.agentDeployment.create({
        data: {
          agent_id: agentId,
          user_id: "user_demo", // TODO: Get from auth
          version: agentVersion.version,
          config: {},
          status: "active",
        },
      });
      deploymentId = deployment.id;
    }

    // Create execution record
    const execution = await prisma.agentExecution.create({
      data: {
        agent_id: agentId,
        deployment_id: deploymentId,
        inputs: inputs as any,
        status: "pending",
      },
    });

    // Execute agent asynchronously
    executeAgentAsync(execution.id, {
      agentId,
      version: agentVersion.version,
      codeUrl: agentVersion.code_url,
      inputs,
      timeout_ms: manifest.runtime?.timeout_ms || 300000,
      memory_mb: manifest.runtime?.memory_mb || 512,
      cpu_cores: manifest.runtime?.cpu_cores || 1,
      runtime: manifest.runtime,
    });

    logger.info(
      {
        executionId: execution.id,
        agentId,
        version: agentVersion.version,
      },
      "Agent execution initiated"
    );

    res.status(202).json({
      success: true,
      data: {
        execution_id: execution.id,
        status: "pending",
        agent_id: agentId,
        version: agentVersion.version,
        created_at: execution.created_at.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to execute agent");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to execute agent",
      },
    });
  }
});

/**
 * GET /executions/:id
 *
 * Get execution status and results
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     execution_id: string,
 *     status: "pending" | "running" | "succeeded" | "failed",
 *     outputs?: {...},
 *     error?: string,
 *     started_at?: string,
 *     completed_at?: string,
 *     duration_ms?: number
 *   }
 * }
 */
router.get("/executions/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const execution = await prisma.agentExecution.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            manifest: true,
          },
        },
      },
    });

    if (!execution) {
      res.status(404).json({
        success: false,
        error: {
          code: "EXECUTION_NOT_FOUND",
          message: `Execution "${id}" not found`,
        },
      });
      return;
    }

    const manifest = execution.agent.manifest as any;

    // Calculate duration if completed
    let duration_ms: number | undefined;
    if (execution.started_at && execution.completed_at) {
      duration_ms = execution.completed_at.getTime() - execution.started_at.getTime();
    }

    res.json({
      success: true,
      data: {
        execution_id: execution.id,
        agent_id: execution.agent_id,
        agent_name: manifest.name,
        status: execution.status,
        inputs: execution.inputs,
        outputs: execution.outputs,
        error: execution.error,
        started_at: execution.started_at?.toISOString(),
        completed_at: execution.completed_at?.toISOString(),
        duration_ms,
        created_at: execution.created_at.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error, executionId: req.params.id }, "Failed to get execution");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get execution",
      },
    });
  }
});

/**
 * Execute agent in background
 * Updates database with results when complete
 */
async function executeAgentAsync(executionId: string, config: any): Promise<void> {
  try {
    // Update status to running
    await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: "running",
        started_at: new Date(),
      },
    });

    // Get presigned download URL for code
    const storageService = getStorageService();
    const codeDownloadUrl = await storageService.getPresignedDownloadUrl(config.codeUrl);

    // Execute agent
    const executor = getExecutor();
    const result = await executor.execute({
      ...config,
      codeUrl: codeDownloadUrl,
    });

    // Update execution with results
    await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: result.success ? "succeeded" : "failed",
        outputs: result.outputs as any,
        error: result.error,
        completed_at: new Date(),
      },
    });

    logger.info(
      {
        executionId,
        agentId: config.agentId,
        success: result.success,
        duration_ms: result.duration_ms,
      },
      "Agent execution completed"
    );
  } catch (error) {
    logger.error({ error, executionId }, "Agent execution failed");

    await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date(),
      },
    });
  }
}

/**
 * Validate inputs against manifest input schema
 */
function validateInputs(
  inputs: Record<string, unknown>,
  inputSchema: Array<{
    name: string;
    type: string;
    required?: boolean;
    validation?: any;
  }>
): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // Check required inputs
  for (const param of inputSchema) {
    if (param.required && !(param.name in inputs)) {
      errors.push(`Missing required input: ${param.name}`);
    }

    if (param.name in inputs) {
      const value = inputs[param.name];

      // Type validation
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== param.type && param.type !== "url" && param.type !== "email") {
        errors.push(`Input "${param.name}" must be of type ${param.type}, got ${actualType}`);
      }

      // Additional validations
      if (param.validation) {
        if (param.validation.min !== undefined) {
          if (typeof value === "string" && value.length < param.validation.min) {
            errors.push(
              `Input "${param.name}" must be at least ${param.validation.min} characters`
            );
          }
          if (typeof value === "number" && value < param.validation.min) {
            errors.push(`Input "${param.name}" must be at least ${param.validation.min}`);
          }
        }

        if (param.validation.max !== undefined) {
          if (typeof value === "string" && value.length > param.validation.max) {
            errors.push(
              `Input "${param.name}" must be at most ${param.validation.max} characters`
            );
          }
          if (typeof value === "number" && value > param.validation.max) {
            errors.push(`Input "${param.name}" must be at most ${param.validation.max}`);
          }
        }

        if (param.validation.pattern && typeof value === "string") {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`Input "${param.name}" does not match required pattern`);
          }
        }

        if (param.validation.enum && !param.validation.enum.includes(value)) {
          errors.push(
            `Input "${param.name}" must be one of: ${param.validation.enum.join(", ")}`
          );
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

export { router as executeRouter };
