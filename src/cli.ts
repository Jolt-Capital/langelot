#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { OpenAIConnector } from './connectors/index.js';
import { FlexibleOrchestrator } from './orchestrator.js';
import { OrchestratorOptions } from './types/index.js';

const program = new Command();

interface CLIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string;
  verbose?: boolean;
}

program
  .name('langelot')
  .description('CLI tool for orchestrated task execution using LLM agents')
  .version('1.0.0');

program
  .command('orchestrate')
  .alias('o')
  .description('Execute a task using the orchestrator-workers pattern')
  .argument('<task>', 'Task to be executed')
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4')
  .option('-t, --temperature <temperature>', 'Temperature for LLM calls', '0.7')
  .option('--max-tokens <tokens>', 'Maximum tokens per LLM call', '1500')
  .option('-c, --context <context>', 'Additional context as JSON string')
  .option('-v, --verbose', 'Verbose output showing intermediate steps')
  .action(async (task: string, options: CLIOptions) => {
    try {
      console.log(chalk.blue('🚀 Starting Langelot orchestration...\n'));
      
      // Validate API key
      if (!process.env.OPENAI_API_KEY) {
        console.error(chalk.red('❌ Error: OPENAI_API_KEY environment variable is required'));
        process.exit(1);
      }

      // Parse context if provided
      let context: Record<string, any> = {};
      if (options.context) {
        try {
          context = JSON.parse(options.context);
        } catch (error) {
          console.error(chalk.red('❌ Error: Invalid JSON in context parameter'));
          process.exit(1);
        }
      }

      // Initialize connector and orchestrator
      const connector = new OpenAIConnector();
      const orchestratorOptions: OrchestratorOptions = {
        model: options.model || 'gpt-4',
        temperature: parseFloat(String(options.temperature || '0.7')),
        maxTokens: parseInt(String(options.maxTokens || '1500')),
        context,
      };

      const orchestrator = new FlexibleOrchestrator(connector, orchestratorOptions);

      console.log(chalk.green(`📋 Task: ${task}`));
      if (Object.keys(context).length > 0) {
        console.log(chalk.gray(`📝 Context: ${JSON.stringify(context, null, 2)}`));
      }
      console.log(chalk.gray(`🤖 Model: ${orchestratorOptions.model}`));
      console.log('');

      // Execute orchestration
      const result = await orchestrator.orchestrate(task);

      // Display results
      console.log(chalk.yellow('🔍 Generated Strategies:'));
      result.strategies.forEach((strategy, index) => {
        console.log(chalk.cyan(`${index + 1}. ${strategy.approach}`));
        if (options.verbose) {
          console.log(chalk.gray(`   ${strategy.description}`));
        }
      });
      console.log('');

      if (options.verbose) {
        console.log(chalk.yellow('⚙️  Worker Results:'));
        result.results.forEach((workerResult, index) => {
          console.log(chalk.cyan(`${index + 1}. ${workerResult.approach}:`));
          console.log(chalk.white(workerResult.result));
          console.log('');
        });
      }

      console.log(chalk.green('✨ Final Synthesis:'));
      console.log(chalk.white(result.synthesis));

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show information about Langelot')
  .action(() => {
    console.log(chalk.blue('🤖 Langelot - Orchestrator-Workers CLI'));
    console.log(chalk.gray('A TypeScript CLI tool that implements the orchestrator-workers pattern'));
    console.log(chalk.gray('for complex task execution using multiple LLM agents.'));
    console.log('');
    console.log(chalk.yellow('Features:'));
    console.log(chalk.white('• Task decomposition into multiple approaches'));
    console.log(chalk.white('• Parallel worker execution'));
    console.log(chalk.white('• Result synthesis'));
    console.log(chalk.white('• Configurable models and parameters'));
    console.log('');
    console.log(chalk.yellow('Requirements:'));
    console.log(chalk.white('• OPENAI_API_KEY environment variable'));
    console.log(chalk.white('• OpenAI API access'));
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

program.parse();