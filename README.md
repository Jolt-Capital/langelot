# Langelot

A TypeScript CLI tool that implements the orchestrator-workers pattern for complex task execution using multiple LLM agents.

## Overview

Langelot mimics the orchestrator-workers pattern from the Anthropic cookbook, breaking down complex tasks into multiple approaches and executing them in parallel using specialized worker agents.

## Features

- **Task Decomposition**: Automatically breaks down complex tasks into 2-3 distinct approaches
- **Parallel Execution**: Runs worker agents in parallel for efficient processing
- **Result Synthesis**: Combines worker results into a comprehensive final output
- **Configurable**: Supports different OpenAI models, temperature settings, and token limits
- **Context Aware**: Accepts additional context to improve task execution

## Installation

```bash
npm install -g langelot
```

## Prerequisites

- Node.js 18+
- OpenAI API key set as `OPENAI_API_KEY` environment variable

## Usage

### Basic Usage

```bash
langelot orchestrate "Create marketing copy for an eco-friendly water bottle"
```

### Advanced Usage

```bash
langelot orchestrate "Design a REST API for a task management system" \
  --model gpt-4 \
  --temperature 0.8 \
  --max-tokens 2000 \
  --context '{"target_audience": "developers", "framework": "Express.js"}' \
  --verbose
```

### Commands

- `langelot orchestrate <task>` - Execute a task using the orchestrator-workers pattern
- `langelot info` - Show information about Langelot

### Options

- `-m, --model <model>` - OpenAI model to use (default: gpt-4)
- `-t, --temperature <temperature>` - Temperature for LLM calls (default: 0.7)
- `--max-tokens <tokens>` - Maximum tokens per LLM call (default: 1500)
- `-c, --context <context>` - Additional context as JSON string
- `-v, --verbose` - Show intermediate steps and worker results

## Architecture

Langelot follows the orchestrator-workers pattern:

1. **Orchestrator**: Analyzes the main task and generates 2-3 distinct subtask strategies
2. **Workers**: Execute specific subtasks in parallel based on the orchestrator's breakdown
3. **Synthesis**: Combines all worker results into a comprehensive final output

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev orchestrate "your task here"

# Build the project
npm run build

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run integration tests (requires OPENAI_API_KEY)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck
```

## Testing

The project includes both unit and integration tests:

- **Unit tests** (`test/unit.test.ts`): Test XML parsing utilities and core functions
- **Integration tests** (`test/integration.test.ts`): End-to-end tests with actual OpenAI API calls

To run integration tests, you need to set the `OPENAI_API_KEY` environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
npm run test:integration
```

The integration test includes a real example: "Find the name of the founder of Sinequa"

## Examples

### Marketing Copy Generation
```bash
langelot orchestrate "Create marketing copy for an eco-friendly water bottle" --verbose
```

### API Design
```bash
langelot orchestrate "Design a REST API for user authentication" \
  --context '{"security": "JWT", "database": "PostgreSQL"}'
```

### Code Review
```bash
langelot orchestrate "Review this React component for best practices" \
  --context '{"component": "UserProfile", "framework": "React 18"}'
```

## License

ISC