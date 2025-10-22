/**
 * Agent Execution Engine
 *
 * Executes agents in isolated Docker containers with resource limits
 * Security: no network access, read-only filesystem, CPU/memory limits
 */

import { exec } from "child_process";
import { promisify } from "util";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

export interface ExecutionConfig {
  agentId: string;
  version: string;
  codeUrl: string;
  inputs: Record<string, unknown>;
  timeout_ms: number;
  memory_mb: number;
  cpu_cores: number;
  runtime: {
    language: "nodejs" | "python" | "go" | "rust";
    version: string;
    entrypoint: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  outputs?: Record<string, unknown>;
  error?: string;
  logs: string;
  duration_ms: number;
  exit_code: number;
}

export class AgentExecutor {
  private workDir: string;

  constructor(workDir: string = "/tmp/frameos-agents") {
    this.workDir = workDir;

    // Ensure work directory exists
    if (!existsSync(this.workDir)) {
      mkdirSync(this.workDir, { recursive: true });
    }
  }

  /**
   * Execute agent in isolated Docker container
   */
  async execute(config: ExecutionConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const containerName = `frameos-agent-${executionId}`;
    const executionDir = join(this.workDir, executionId);

    try {
      // Create execution directory
      mkdirSync(executionDir, { recursive: true });

      // Download agent code
      await this.downloadCode(config.codeUrl, join(executionDir, "agent.zip"));

      // Extract code
      await this.extractCode(join(executionDir, "agent.zip"), join(executionDir, "code"));

      // Prepare input file
      const inputPath = join(executionDir, "input.json");
      const outputPath = join(executionDir, "output.json");
      await this.writeInputFile(inputPath, config.inputs);

      // Get Docker image for runtime
      const dockerImage = this.getDockerImage(config.runtime);

      // Build Docker run command
      const dockerCommand = this.buildDockerCommand({
        containerName,
        image: dockerImage,
        codeDir: join(executionDir, "code"),
        inputPath,
        outputPath,
        entrypoint: config.runtime.entrypoint,
        timeout_ms: config.timeout_ms,
        memory_mb: config.memory_mb,
        cpu_cores: config.cpu_cores,
      });

      logger.info(
        {
          executionId,
          agentId: config.agentId,
          runtime: config.runtime.language,
          timeout_ms: config.timeout_ms,
        },
        "Starting agent execution"
      );

      // Execute Docker container
      const { stdout, stderr, exitCode } = await this.runDocker(dockerCommand, config.timeout_ms);

      const duration_ms = Date.now() - startTime;

      // Read output file
      let outputs: Record<string, unknown> | undefined;
      try {
        const outputContent = await import("fs/promises").then((fs) =>
          fs.readFile(outputPath, "utf-8")
        );
        outputs = JSON.parse(outputContent);
      } catch (error) {
        logger.warn({ executionId, error }, "Failed to read output file");
      }

      // Cleanup
      await this.cleanup(containerName, executionDir);

      const result: ExecutionResult = {
        success: exitCode === 0,
        outputs,
        error: exitCode !== 0 ? stderr : undefined,
        logs: stdout + (stderr ? `\n[STDERR]\n${stderr}` : ""),
        duration_ms,
        exit_code: exitCode,
      };

      logger.info(
        {
          executionId,
          agentId: config.agentId,
          success: result.success,
          duration_ms,
          exit_code: exitCode,
        },
        "Agent execution completed"
      );

      return result;
    } catch (error) {
      const duration_ms = Date.now() - startTime;

      logger.error({ executionId, agentId: config.agentId, error }, "Agent execution failed");

      // Cleanup on error
      await this.cleanup(containerName, executionDir).catch(() => {});

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        logs: "",
        duration_ms,
        exit_code: -1,
      };
    }
  }

  /**
   * Download agent code from URL
   */
  private async downloadCode(url: string, destination: string): Promise<void> {
    // For demo, we'll assume code is accessible via HTTP
    // In production, use presigned S3 URLs
    const https = await import("https");
    const file = createWriteStream(destination);

    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download code: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      });
    });
  }

  /**
   * Extract ZIP archive
   */
  private async extractCode(zipPath: string, extractDir: string): Promise<void> {
    mkdirSync(extractDir, { recursive: true });

    await execAsync(`unzip -q ${zipPath} -d ${extractDir}`);
  }

  /**
   * Write input data to JSON file
   */
  private async writeInputFile(path: string, inputs: Record<string, unknown>): Promise<void> {
    const fs = await import("fs/promises");
    await fs.writeFile(path, JSON.stringify(inputs, null, 2), "utf-8");
  }

  /**
   * Get Docker image for runtime
   */
  private getDockerImage(runtime: ExecutionConfig["runtime"]): string {
    switch (runtime.language) {
      case "nodejs":
        return `node:${runtime.version}-alpine`;
      case "python":
        return `python:${runtime.version}-alpine`;
      case "go":
        return `golang:${runtime.version}-alpine`;
      case "rust":
        return `rust:${runtime.version}-alpine`;
      default:
        throw new Error(`Unsupported runtime: ${runtime.language}`);
    }
  }

  /**
   * Build Docker run command with security restrictions
   */
  private buildDockerCommand(params: {
    containerName: string;
    image: string;
    codeDir: string;
    inputPath: string;
    outputPath: string;
    entrypoint: string;
    timeout_ms: number;
    memory_mb: number;
    cpu_cores: number;
  }): string {
    const {
      containerName,
      image,
      codeDir,
      inputPath,
      outputPath,
      entrypoint,
      memory_mb,
      cpu_cores,
    } = params;

    // Security restrictions:
    // - --network=none: No network access
    // - --read-only: Read-only root filesystem
    // - --tmpfs /tmp: Writable /tmp for temporary files
    // - --memory: Memory limit
    // - --cpus: CPU limit
    // - --pids-limit: Process limit
    // - --security-opt=no-new-privileges: Prevent privilege escalation

    return `
      docker run --rm \
        --name ${containerName} \
        --network=none \
        --read-only \
        --tmpfs /tmp \
        --memory=${memory_mb}m \
        --cpus=${cpu_cores} \
        --pids-limit=100 \
        --security-opt=no-new-privileges \
        -v ${codeDir}:/app:ro \
        -v ${inputPath}:/input.json:ro \
        -v ${outputPath}:/output.json:rw \
        -w /app \
        ${image} \
        ${entrypoint}
    `.replace(/\s+/g, " ").trim();
  }

  /**
   * Run Docker command with timeout
   */
  private async runDocker(
    command: string,
    timeout_ms: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = exec(command, { timeout: timeout_ms });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data;
      });

      process.stderr?.on("data", (data) => {
        stderr += data;
      });

      process.on("exit", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      process.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Cleanup container and files
   */
  private async cleanup(containerName: string, executionDir: string): Promise<void> {
    try {
      // Stop and remove container if still running
      await execAsync(`docker stop ${containerName} 2>/dev/null || true`);
      await execAsync(`docker rm ${containerName} 2>/dev/null || true`);

      // Remove execution directory
      const fs = await import("fs/promises");
      await fs.rm(executionDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn({ containerName, executionDir, error }, "Cleanup failed");
    }
  }
}

// Singleton instance
let executor: AgentExecutor | null = null;

export function getExecutor(): AgentExecutor {
  if (!executor) {
    executor = new AgentExecutor();
  }
  return executor;
}
