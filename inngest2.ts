import { Sandbox } from '@e2b/code-interpreter';
import {
  createAgent,
  createNetwork,
  createState,
  createTool,
  type Message,
  gemini,
  type Tool,
} from '@inngest/agent-kit';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from '@/prompt';
import { inngest } from './client';
import { 
  getSandbox, 
  lastAssistantTextMessageContent, 
  parseAgentOutput 
} from './utils';

// --- Types & Constants ---
export interface FileCollection {
  [path: string]: string;
}

export interface AgentState {
  summary: string;
  files: FileCollection;
}

const SANDBOX_TIMEOUT_IN_MS = 60 * 60 * 1000; 

// --- The Main Function ---
export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    
    // 1. Initialize Sandbox
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("vibe-nextjs-prod");
      await sandbox.setTimeout(SANDBOX_TIMEOUT_IN_MS);
      return sandbox.sandboxId;
    });

    // 2. Fetch Message History (Memory)
    const previousMessages = await step.run("get-previous-messages", async () => {
      const messages = await prisma.message.findMany({
        where: { projectId: event.data.projectId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      return messages.map((m: { role: string; content: string }) => ({
        type: "text" as const,
        role: m.role === "ASSISTANT" ? "assistant" as const : "user" as const,
        content: m.content,
      })).reverse();
    });

    // 3. Initialize Agent State
    const state = createState<AgentState>(
      { summary: "", files: {} },
      { messages: previousMessages }
    );

    // 4. Define the Coding Agent & Tools
    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: gemini({ 
        model: "gemini-2.0-flash",
        defaultParameters: { generationConfig: { temperature: 0.1 } } 
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Run shell commands in the sandbox",
          parameters: z.object({ command: z.string() }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };
              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => { buffers.stdout += data; },
                  onStderr: (data: string) => { buffers.stderr += data; },
                });
                return result.stdout || result.stderr;
              } catch (e) {
                return `Error: ${e}\nSTDOUT: ${buffers.stdout}\nSTDERR: ${buffers.stderr}`;
              }
            });
          }
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Write files to the sandbox",
          parameters: z.object({
            files: z.array(z.object({ path: z.string(), content: z.string() })),
          }),
          handler: async ({ files }, { step, network }: Tool.Options<AgentState>) => {
            const updated = await step?.run("write-files", async () => {
              const sandbox = await getSandbox(sandboxId);
              const currentFiles = network.state.data.files || {};
              for (const file of files) {
                await sandbox.files.write(file.path, file.content);
                currentFiles[file.path] = file.content;
              }
              return currentFiles;
            });
            if (updated) network.state.data.files = updated;
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({ files: z.array(z.string()) }),
          handler: async ({ files }, { step }) => {
            return await step?.run("read-files", async () => {
              const sandbox = await getSandbox(sandboxId);
              const results = [];
              for (const path of files) {
                const content = await sandbox.files.read(path);
                results.push({ path, content });
              }
              return JSON.stringify(results);
            });
          }
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const text = lastAssistantTextMessageContent(result);
          if (text?.includes("<task_summary>") && network) {
            network.state.data.summary = text;
          }
          return result;
        },
      }
    });

    // 5. Run the Network
    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => network.state.data.summary ? undefined : codeAgent,
    });

    const result = await network.run(event.data.value, { state });

    // 6. Refinement Sub-Agents (Parallel)
    const [titleOutput, responseOutput] = await Promise.all([
      createAgent({ name: "title-gen", system: FRAGMENT_TITLE_PROMPT, model: gemini({ model: "gemini-2.0-flash" }) }).run(result.state.data.summary),
      createAgent({ name: "resp-gen", system: RESPONSE_PROMPT, model: gemini({ model: "gemini-2.0-flash" }) }).run(result.state.data.summary)
    ]);

    // 7. Finalize Result
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      return `https://${sandbox.getHost(3000)}`;
    });

    const isError = !result.state.data.summary || Object.keys(result.state.data.files).length === 0;

    await step.run("save-to-db", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Deployment failed. Please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput.output),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl,
              title: parseAgentOutput(titleOutput.output),
              files: result.state.data.files,
            }
          }
        },
      });
    });

    return {
      url: sandboxUrl,
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);