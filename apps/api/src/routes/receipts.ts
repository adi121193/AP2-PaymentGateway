import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { success, ValidationError } from "@ap2/domain";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error-handler.js";

export const receiptsRouter = Router();

/**
 * GET /receipts/:id
 * Retrieve a receipt by ID
 *
 * Supports two formats:
 * - JSON (default): Structured receipt data
 * - CSV: ?format=csv query parameter
 *
 * Authentication: Required
 */
receiptsRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const format = (req.query.format as string)?.toLowerCase() || "json";
    const agentId = req.agentId;

    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    try {
      const receipt = await prisma.receipt.findFirst({
        where: {
          id,
        },
        include: {
          payment: {
            include: {
              mandate: {
                include: {
                  intent: true,
                },
              },
            },
          },
        },
      });

      if (!receipt) {
        res.status(404).json({
          success: false,
          error: {
            code: "RECEIPT_NOT_FOUND",
            message: "Receipt not found",
          },
        });
        return;
      }

      // Verify agent owns this receipt
      if (receipt.agent_id !== agentId) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied to this receipt",
          },
        });
        return;
      }

      // Return CSV format if requested
      if (format === "csv") {
        const csvData = generateReceiptCSV(receipt);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="receipt_${receipt.id}.csv"`
        );
        res.status(200).send(csvData);
        return;
      }

      // Return JSON format (default)
      res.status(200).json(
        success({
          receipt_id: receipt.id,
          payment_id: receipt.payment_id,
          agent_id: receipt.agent_id,
          mandate_id: receipt.payment.mandate_id,
          intent_id: receipt.payment.mandate.intent_id,
          hash: receipt.hash,
          prev_hash: receipt.prev_hash,
          chain_index: receipt.chain_index,
          payment: {
            provider: receipt.payment.provider,
            provider_ref: receipt.payment.provider_ref,
            amount: receipt.payment.amount,
            currency: receipt.payment.currency,
            status: receipt.payment.status,
            settled_at: receipt.payment.settled_at,
          },
          intent: {
            vendor: receipt.payment.mandate.intent.vendor,
            description: receipt.payment.mandate.intent.description,
          },
          created_at: receipt.created_at,
        })
      );
    } catch (dbError) {
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        res.status(503).json({
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Database unavailable",
          },
        });
        return;
      }

      throw dbError;
    }
  })
);

/**
 * GET /receipts
 * List receipts for authenticated agent
 *
 * Query parameters:
 * - limit: Number of receipts to return (default: 20, max: 100)
 * - offset: Offset for pagination (default: 0)
 *
 * Authentication: Required
 */
receiptsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agentId;

    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const [receipts, total] = await Promise.all([
        prisma.receipt.findMany({
          where: {
            agent_id: agentId,
          },
          include: {
            payment: {
              include: {
                mandate: {
                  include: {
                    intent: true,
                  },
                },
              },
            },
          },
          orderBy: {
            chain_index: "desc",
          },
          take: limit,
          skip: offset,
        }),
        prisma.receipt.count({
          where: {
            agent_id: agentId,
          },
        }),
      ]);

      const receiptList = receipts.map((receipt) => ({
        receipt_id: receipt.id,
        payment_id: receipt.payment_id,
        mandate_id: receipt.payment.mandate_id,
        amount: receipt.payment.amount,
        currency: receipt.payment.currency,
        vendor: receipt.payment.mandate.intent.vendor,
        status: receipt.payment.status,
        hash: receipt.hash,
        chain_index: receipt.chain_index,
        created_at: receipt.created_at,
      }));

      res.status(200).json(
        success({
          receipts: receiptList,
          pagination: {
            limit,
            offset,
            total,
            has_more: offset + limit < total,
          },
        })
      );
    } catch (dbError) {
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        res.status(503).json({
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Database unavailable",
          },
        });
        return;
      }

      throw dbError;
    }
  })
);

/**
 * Generate CSV representation of a receipt
 */
function generateReceiptCSV(receipt: any): string {
  const headers = [
    "Receipt ID",
    "Payment ID",
    "Mandate ID",
    "Intent ID",
    "Agent ID",
    "Vendor",
    "Amount",
    "Currency",
    "Provider",
    "Provider Reference",
    "Status",
    "Hash",
    "Previous Hash",
    "Chain Index",
    "Settled At",
    "Created At",
  ];

  const values = [
    receipt.id,
    receipt.payment_id,
    receipt.payment.mandate_id,
    receipt.payment.mandate.intent_id,
    receipt.agent_id,
    receipt.payment.mandate.intent.vendor,
    receipt.payment.amount,
    receipt.payment.currency,
    receipt.payment.provider,
    receipt.payment.provider_ref || "N/A",
    receipt.payment.status,
    receipt.hash,
    receipt.prev_hash || "N/A (genesis)",
    receipt.chain_index,
    receipt.payment.settled_at?.toISOString() || "N/A",
    receipt.created_at.toISOString(),
  ];

  // Escape values that contain commas or quotes
  const escapedValues = values.map((value) => {
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  });

  return [headers.join(","), escapedValues.join(",")].join("\n");
}
