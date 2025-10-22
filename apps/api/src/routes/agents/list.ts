/**
 * Agent Listing Endpoint
 *
 * GET /agents
 * GET /agents/:id
 *
 * Public endpoints for browsing agent marketplace
 */

import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { logger } from "../../logger.js";
import { z } from "zod";

const router = Router();

/**
 * Query parameters for agent listing
 */
const ListAgentsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["downloads", "rating", "newest"]).default("downloads"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["active", "pending_review", "all"]).default("active"),
});

/**
 * GET /agents
 *
 * Query parameters:
 * - category: Filter by category (optional)
 * - search: Search in name/description (optional)
 * - sort: Sort order (downloads | rating | newest) - default: downloads
 * - limit: Results per page (1-100) - default: 20
 * - offset: Pagination offset - default: 0
 * - status: Filter by status (active | pending_review | all) - default: active
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     agents: [...],
 *     total: number,
 *     limit: number,
 *     offset: number
 *   }
 * }
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const queryValidation = ListAgentsQuerySchema.safeParse(req.query);

    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message: "Invalid query parameters",
          details: queryValidation.error.errors,
        },
      });
      return;
    }

    const { category, search, sort, limit, offset, status } = queryValidation.data;

    // Build where clause
    const where: any = {};

    if (status !== "all") {
      where.status = status;
    }

    if (category) {
      where.manifest = {
        path: ["category"],
        equals: category,
      };
    }

    if (search) {
      // Search in name or description
      // Note: Prisma doesn't support JSON field search well, so we'll filter in memory
      // In production, use PostgreSQL full-text search
    }

    // Build order by clause
    let orderBy: any = {};
    switch (sort) {
      case "downloads":
        orderBy = { downloads: "desc" };
        break;
      case "rating":
        orderBy = { rating: "desc" };
        break;
      case "newest":
        orderBy = { created_at: "desc" };
        break;
    }

    // Fetch agents
    const [agents, total] = await Promise.all([
      prisma.agentDefinition.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          manifest: true,
          status: true,
          downloads: true,
          rating: true,
          created_at: true,
          updated_at: true,
          developer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.agentDefinition.count({ where }),
    ]);

    // Filter by search term in memory (temporary solution)
    let filteredAgents = agents;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAgents = agents.filter((agent) => {
        const manifest = agent.manifest as any;
        const name = manifest.name?.toLowerCase() || "";
        const description = manifest.description?.toLowerCase() || "";
        return name.includes(searchLower) || description.includes(searchLower);
      });
    }

    // Transform response
    const transformedAgents = filteredAgents.map((agent) => {
      const manifest = agent.manifest as any;
      return {
        id: agent.id,
        name: manifest.name,
        slug: manifest.slug,
        version: manifest.version,
        description: manifest.description,
        category: manifest.category,
        tags: manifest.tags || [],
        pricing: manifest.pricing,
        author: {
          name: agent.developer.name,
          email: agent.developer.email,
        },
        downloads: agent.downloads,
        rating: agent.rating,
        status: agent.status,
        icon_url: manifest.icon_url,
        created_at: agent.created_at.toISOString(),
        updated_at: agent.updated_at.toISOString(),
      };
    });

    res.json({
      success: true,
      data: {
        agents: transformedAgents,
        total: search ? filteredAgents.length : total,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to list agents");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to list agents",
      },
    });
  }
});

/**
 * GET /agents/:id
 *
 * Get detailed information about a specific agent
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     ...full manifest,
 *     downloads: number,
 *     rating: number,
 *     versions: [...],
 *     author: {...}
 *   }
 * }
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const agent = await prisma.agentDefinition.findUnique({
      where: { id },
      include: {
        developer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        versions: {
          orderBy: { created_at: "desc" },
          select: {
            version: true,
            changelog: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    if (!agent) {
      res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: `Agent with ID "${id}" not found`,
        },
      });
      return;
    }

    // Only show active agents to public (unless developer is viewing their own)
    if (agent.status !== "active") {
      res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not available",
        },
      });
      return;
    }

    const manifest = agent.manifest as any;

    res.json({
      success: true,
      data: {
        ...manifest,
        id: agent.id,
        downloads: agent.downloads,
        rating: agent.rating,
        status: agent.status,
        author: {
          id: agent.developer.id,
          name: agent.developer.name,
          email: agent.developer.email,
        },
        versions: agent.versions.map((v) => ({
          version: v.version,
          changelog: v.changelog,
          status: v.status,
          released_at: v.created_at.toISOString(),
        })),
        created_at: agent.created_at.toISOString(),
        updated_at: agent.updated_at.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error, agentId: req.params.id }, "Failed to get agent details");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to get agent details",
      },
    });
  }
});

export { router as listRouter };
