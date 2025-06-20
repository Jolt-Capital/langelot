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
  documents?: string;
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
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4.1')
  .option('-t, --temperature <temperature>', 'Temperature for LLM calls', '0.7')
  .option('--max-tokens <tokens>', 'Maximum tokens per LLM call', '1500')
  .option('-c, --context <context>', 'Additional context as JSON string')
  .option('-v, --verbose', 'Verbose output showing all agent interactions and detailed logs')
  .option('-d, --documents <documents>', 'Comma-separated list of document paths for analysis')
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

      // Parse documents if provided
      let documents: string[] = [];
      if (options.documents) {
        documents = options.documents.split(',').map(f => f.trim());
      }

      // Initialize connector and orchestrator
      const connector = new OpenAIConnector(undefined, options.verbose);
      const orchestratorOptions: OrchestratorOptions = {
        model: options.model || 'gpt-4.1',
        temperature: parseFloat(String(options.temperature || '0.7')),
        maxTokens: parseInt(String(options.maxTokens || '1500')),
        context,
        documents,
      };

      const orchestrator = new FlexibleOrchestrator(connector, orchestratorOptions);

      console.log(chalk.green(`📋 Task: ${task}`));
      if (Object.keys(context).length > 0) {
        console.log(chalk.gray(`📝 Context: ${JSON.stringify(context, null, 2)}`));
      }
      console.log(chalk.gray(`🤖 Model: ${orchestratorOptions.model}`));
      if (options.verbose) {
        console.log(chalk.gray(`🔧 Verbose mode enabled - showing all agent interactions`));
      }
      if (documents.length > 0) {
        console.log(chalk.gray(`📚 Documents available: ${documents.length} files`));
      }
      console.log('');

      // Execute orchestration
      const result = await orchestrator.orchestrate(task);

      // Display summary (non-verbose output)
      if (!options.verbose) {
        console.log(chalk.yellow('🔍 Generated Strategies:'));
        result.strategies.forEach((strategy, index) => {
          console.log(chalk.cyan(`${index + 1}. ${strategy.approach}`));
        });
        console.log('');
      }

      // Show worker results in verbose mode
      if (options.verbose) {
        console.log(chalk.yellow('\n⚙️  Worker Results:'));
        result.results.forEach((workerResult, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${workerResult.approach}:`));
          
          // Show worker type and model info
          if (workerResult.workerType) {
            const workerEmoji = {
              'simple': '⚡',
              'search': '🔍',
              'librarian': '📚'
            }[workerResult.workerType] || '⚙️';
            console.log(chalk.gray(`   ${workerEmoji} Worker type: ${workerResult.workerType}`));
          }
          
          if (workerResult.model) {
            console.log(chalk.gray(`   🤖 Model: ${workerResult.model}`));
          }
          
          if (workerResult.duration) {
            console.log(chalk.gray(`   ⏱️  Duration: ${workerResult.duration}ms`));
          }
          
          // Show search-specific info
          if (workerResult.searchPerformed) {
            console.log(chalk.green('   🔍 Web search performed'));
            if (workerResult.sources && workerResult.sources.length > 0) {
              console.log(chalk.gray(`   Sources: ${workerResult.sources.length} found`));
            }
          } else if (workerResult.workerType === 'search') {
            console.log(chalk.yellow('   📚 Fallback to training data (web search unavailable)'));
          }
          
          // Show librarian-specific info
          if (workerResult.filesUsed && workerResult.filesUsed.length > 0) {
            console.log(chalk.blue(`   📄 Files analyzed: ${workerResult.filesUsed.join(', ')}`));
          }
          
          console.log(chalk.white('   ' + workerResult.result.split('\n').join('\n   ')));
          
          // Show sources if available
          if (workerResult.sources && workerResult.sources.length > 0) {
            console.log(chalk.gray('\n   Sources:'));
            workerResult.sources.forEach((source, sourceIndex) => {
              console.log(chalk.gray(`   ${sourceIndex + 1}. ${source.title} - ${source.url}`));
              if (source.snippet) {
                console.log(chalk.gray(`      ${source.snippet}`));
              }
            });
          }
        });
        console.log('');
      }

      // Show call logs summary if verbose
      if (options.verbose) {
        const logs = connector.getCallLogs();
        console.log(chalk.yellow('📊 Agent Interaction Summary:'));
        console.log(chalk.cyan(`Total LLM calls: ${logs.length}`));
        
        const totalTokens = logs.reduce((sum, log) => sum + (log.usage?.total_tokens || 0), 0);
        const totalDuration = logs.reduce((sum, log) => sum + log.duration, 0);
        
        if (totalTokens > 0) {
          console.log(chalk.cyan(`Total tokens used: ${totalTokens}`));
        }
        console.log(chalk.cyan(`Total execution time: ${totalDuration}ms`));
        
        // Show agent statistics
        const searchResults = result.results.filter(r => r.searchPerformed);
        if (searchResults.length > 0) {
          console.log(chalk.cyan(`Web searches performed: ${searchResults.length}`));
        }
        
        const totalSources = result.results.reduce((sum, r) => sum + (r.sources?.length || 0), 0);
        if (totalSources > 0) {
          console.log(chalk.cyan(`Sources found: ${totalSources}`));
        }

        const filesAnalyzed = result.results.filter(r => r.filesUsed && r.filesUsed.length > 0);
        if (filesAnalyzed.length > 0) {
          console.log(chalk.cyan(`Document analyses performed: ${filesAnalyzed.length}`));
        }
        console.log('');
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
    console.log(chalk.white('• Intelligent task decomposition with agent selection'));
    console.log(chalk.white('• Multiple specialized agent types:'));
    console.log(chalk.white('  - Simple agents (gpt-4.1-mini) for reasoning tasks'));
    console.log(chalk.white('  - Search agents (gpt-4.1) with real-time web search'));
    console.log(chalk.white('  - Librarian agents (gpt-4.1) for document analysis'));
    console.log(chalk.white('• Orchestrator chooses optimal agent mix per subtask'));
    console.log(chalk.white('• Parallel mixed-agent execution'));
    console.log(chalk.white('• Comprehensive result synthesis'));
    console.log(chalk.white('• Document upload and analysis support'));
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