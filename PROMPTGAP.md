Isotope Prompt Comparison & Gap Analysis

This report compares the provided prompt requirements in pasted_content.txt with the actual implementation in the Isotope codebase (src/prompt.ts).




1. Summary of Findings

The Isotope codebase already contains the exact prompt strings defined in the provided file. However, there are several architectural and implementation gaps where the application logic does not yet support the advanced features described in those prompts.

Prompt Variable
Status in Codebase
Alignment with Requirements
PLAN_PROMPT
Implemented
100% Match (Literal string match)
TASK_GRAPH_PLAN_PROMPT
Implemented
100% Match (Literal string match)







2. Identified Gaps & Missing Features

While the prompt text is present, the following features mentioned in the prompts are either missing or incomplete in the supporting application logic:

A. Architecture Map & Memory Stats

The PLAN_PROMPT expects <architecture_map> and <memory_stats> as input.

•
Gap: The PlannerOptions and generateTaskGraph function in src/planning/planner.ts only pass sandboxId and userRequest.

•
Missing Logic: There is no code to calculate memory_stats (token counts/file counts) or to inject the architecture_map (from project.contextDocument) into the planning phase.

B. Schema & Folder Structure in Plan

The PLAN_PROMPT output format includes proposedSchema and folderStructure.

•
Gap: The TaskGraphSchema in src/execution/taskGraph.ts does not include fields for proposedSchema, folderStructure, memoryStats, or riskFlags.

•
Impact: Even if the AI generates these fields, the system will strip them out during Zod validation or fail to store them in the database (prisma.message.plan is a stringified version of the validated graph).

C. Task Graph Complexity

The TASK_GRAPH_PLAN_PROMPT describes a sophisticated dependency-aware execution model.

•
Status: This is partially implemented. The TaskExecutor does handle dependsOn and priority.

•
Gap: The TaskSchema is missing some of the descriptive metadata mentioned in the "FEATURE 3" section of the prompts (like approach, complexity, and estimatedTime).

D. Missing Agent Types

The TASK_GRAPH_PLAN_PROMPT defines four task types: ui, backend, db, and integration.

•
Gap: In src/inngest/functions.ts, all four types are routed to the same runner (which uses runCodeAgent).

•
Missing Logic: There is no specialized "DB Agent" or "Integration Agent" logic. The "Backend Agent" implementation in prompt.ts is comprehensive, but the execution layer treats them as generic code tasks.




3. Recommended Implementation Steps

To fully support the prompts provided, the following changes are required:

1.
Update Planner Logic: Modify generateTaskGraph in src/planning/planner.ts to accept and inject the architecture_map and calculate token usage for memory_stats.

2.
Expand TaskGraph Schema: Update src/execution/taskGraph.ts to include the new fields: summary, approach, complexity, estimatedTime, proposedSchema, folderStructure, and riskFlags.

3.
Update Database Schema: Ensure the Message model in prisma/schema.prisma can store these additional planning details (currently stored in a single plan JSON field, which is fine if the Zod schema is updated).

4.
Specialized Agents: Implement distinct logic or system prompts for db and integration tasks to improve accuracy in those domains.

