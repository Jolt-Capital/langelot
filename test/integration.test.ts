import { describe, it, expect, beforeAll } from 'vitest';
import { OpenAIConnector } from '../src/connectors/index.js';
import { FlexibleOrchestrator } from '../src/orchestrator.js';
import { OrchestratorOptions } from '../src/types/index.js';

describe('Langelot Integration Tests', () => {
  let connector: OpenAIConnector;
  let orchestrator: FlexibleOrchestrator;

  beforeAll(() => {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for integration tests');
    }

    connector = new OpenAIConnector();
    const options: OrchestratorOptions = {
      model: 'gpt-3.5-turbo', // Use cheaper model for testing
      temperature: 0.7,
      maxTokens: 1000,
    };
    orchestrator = new FlexibleOrchestrator(connector, options);
  });

  it('should successfully orchestrate a simple research task', async () => {
    const task = 'Find the name of the founder of Sinequa';
    
    const result = await orchestrator.orchestrate(task);

    // Verify the structure of the result
    expect(result).toBeDefined();
    expect(result.task).toBe(task);
    expect(result.strategies).toBeDefined();
    expect(result.strategies.length).toBeGreaterThanOrEqual(2);
    expect(result.strategies.length).toBeLessThanOrEqual(3);
    
    // Verify each strategy has required fields
    result.strategies.forEach(strategy => {
      expect(strategy.approach).toBeDefined();
      expect(strategy.approach.length).toBeGreaterThan(0);
      expect(strategy.description).toBeDefined();
      expect(strategy.description.length).toBeGreaterThan(0);
    });

    // Verify worker results
    expect(result.results).toBeDefined();
    expect(result.results.length).toBe(result.strategies.length);
    
    result.results.forEach(workerResult => {
      expect(workerResult.approach).toBeDefined();
      expect(workerResult.result).toBeDefined();
      expect(workerResult.result.length).toBeGreaterThan(0);
    });

    // Verify synthesis
    expect(result.synthesis).toBeDefined();
    expect(result.synthesis.length).toBeGreaterThan(0);

    // Log the result for manual verification
    console.log('\n=== INTEGRATION TEST RESULT ===');
    console.log(`Task: ${result.task}`);
    console.log('\nStrategies:');
    result.strategies.forEach((strategy, index) => {
      console.log(`${index + 1}. ${strategy.approach}: ${strategy.description}`);
    });
    console.log('\nWorker Results:');
    result.results.forEach((workerResult, index) => {
      console.log(`${index + 1}. ${workerResult.approach}:`);
      console.log(`   ${workerResult.result.substring(0, 200)}...`);
    });
    console.log('\nSynthesis:');
    console.log(result.synthesis);
    console.log('=== END RESULT ===\n');

    // Basic content validation - should mention Sinequa and likely contain a founder's name
    const synthesisLower = result.synthesis.toLowerCase();
    expect(synthesisLower).toMatch(/sinequa/i);
    
    // Check that at least one result contains substantial content
    const hasSubstantialContent = result.results.some(r => r.result.length > 50);
    expect(hasSubstantialContent).toBe(true);
  }, 60000); // 60 second timeout for API calls

  it('should handle context-enhanced tasks', async () => {
    const task = 'Find information about Sinequa as a company';
    const context = {
      focus: 'company background and technology',
      industry: 'enterprise search'
    };

    const options: OrchestratorOptions = {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      context
    };

    const contextOrchestrator = new FlexibleOrchestrator(connector, options);
    const result = await contextOrchestrator.orchestrate(task);

    expect(result).toBeDefined();
    expect(result.task).toBe(task);
    expect(result.strategies.length).toBeGreaterThanOrEqual(2);
    expect(result.synthesis).toBeDefined();
    expect(result.synthesis.length).toBeGreaterThan(0);

    // Verify context is being used effectively
    const synthesisLower = result.synthesis.toLowerCase();
    expect(synthesisLower).toMatch(/sinequa/i);

    console.log('\n=== CONTEXT-ENHANCED TEST RESULT ===');
    console.log(`Task: ${result.task}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);
    console.log(`Synthesis: ${result.synthesis.substring(0, 300)}...`);
    console.log('=== END CONTEXT RESULT ===\n');
  }, 60000);

  it('should handle error conditions gracefully', async () => {
    // Test with invalid API key
    const invalidConnector = new OpenAIConnector('invalid-key');
    const invalidOrchestrator = new FlexibleOrchestrator(invalidConnector);

    await expect(invalidOrchestrator.orchestrate('test task')).rejects.toThrow();
  }, 30000);
});