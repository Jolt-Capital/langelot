export function extractXml(text: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs');
  const matches = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  return matches;
}

export function extractSingleXml(text: string, tag: string): string | null {
  const matches = extractXml(text, tag);
  return matches.length > 0 ? matches[0] : null;
}

export interface SubtaskStrategy {
  approach: string;
  description: string;
  agentType: 'simple' | 'search' | 'librarian';
}

export function parseSubtaskStrategies(text: string): SubtaskStrategy[] {
  const approaches = extractXml(text, 'approach');
  const descriptions = extractXml(text, 'description');
  const agents = extractXml(text, 'agent');
  
  const strategies: SubtaskStrategy[] = [];
  const minLength = Math.min(approaches.length, descriptions.length, agents.length);
  
  for (let i = 0; i < minLength; i++) {
    const agentType = agents[i].toLowerCase() as 'simple' | 'search' | 'librarian';
    
    // Validate agent type
    if (!['simple', 'search', 'librarian'].includes(agentType)) {
      console.warn(`Invalid agent type "${agents[i]}", defaulting to "simple"`);
    }
    
    strategies.push({
      approach: approaches[i],
      description: descriptions[i],
      agentType: ['simple', 'search', 'librarian'].includes(agentType) ? agentType : 'simple',
    });
  }
  
  return strategies;
}

export interface WorkerResult {
  approach: string;
  result: string;
}

export function parseWorkerResults(responses: string[], approaches: string[]): WorkerResult[] {
  const results: WorkerResult[] = [];
  
  for (let i = 0; i < responses.length && i < approaches.length; i++) {
    const result = extractSingleXml(responses[i], 'result') || responses[i];
    results.push({
      approach: approaches[i],
      result: result.trim(),
    });
  }
  
  return results;
}