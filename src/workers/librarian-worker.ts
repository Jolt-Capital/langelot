import fs from 'fs';
import path from 'path';
import { OpenAIConnector } from '../connectors/index.js';
import { WorkerOptions } from '../types/index.js';

export interface LibrarianWorkerOptions extends WorkerOptions {
  filePaths?: string[];
}

export interface LibrarianWorkerResult {
  approach: string;
  result: string;
  filesUsed: string[];
  model: string;
  duration: number;
}

export interface UploadedFile {
  id: string;
  path: string;
  name: string;
}

export class LibrarianWorker {
  private connector: OpenAIConnector;
  private options: Required<LibrarianWorkerOptions>;
  private uploadedFiles: UploadedFile[] = [];

  constructor(connector: OpenAIConnector, options: LibrarianWorkerOptions = {}) {
    this.connector = connector;
    this.options = {
      model: options.model || 'gpt-4.1',
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.3,
      filePaths: options.filePaths || [],
    };
  }

  async initialize(): Promise<void> {
    if (this.options.filePaths.length === 0) {
      throw new Error('LibrarianWorker requires at least one file path to initialize');
    }

    for (const filePath of this.options.filePaths) {
      try {
        await this.uploadFile(filePath);
      } catch (error) {
        console.warn(`Failed to upload file ${filePath}: ${error}`);
      }
    }

    if (this.uploadedFiles.length === 0) {
      throw new Error('LibrarianWorker failed to upload any files');
    }
  }

  private async uploadFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    // Check if file type is supported (PDF, text files, etc.)
    const supportedExtensions = ['.pdf', '.txt', '.md', '.doc', '.docx'];
    if (!supportedExtensions.includes(extension)) {
      throw new Error(`Unsupported file type: ${extension}. Supported types: ${supportedExtensions.join(', ')}`);
    }

    try {
      const fileResponse = await this.connector.uploadFile(filePath);
      
      this.uploadedFiles.push({
        id: fileResponse.id,
        path: filePath,
        name: fileName,
      });

      console.log(`✅ Uploaded file: ${fileName} (ID: ${fileResponse.id})`);
    } catch (error) {
      throw new Error(`Failed to upload ${fileName}: ${error}`);
    }
  }

  async execute(
    task: string,
    approach: string,
    description: string,
    context?: Record<string, any>
  ): Promise<LibrarianWorkerResult> {
    const startTime = Date.now();

    if (this.uploadedFiles.length === 0) {
      throw new Error('LibrarianWorker not initialized. Call initialize() first.');
    }

    const contextInfo = context && Object.keys(context).length > 0 
      ? `\n\nAdditional context: ${JSON.stringify(context, null, 2)}`
      : '';

    const filesInfo = this.uploadedFiles.map(f => f.name).join(', ');

    const textContent = `You are a specialized librarian worker with access to uploaded documents. Your task is to analyze the provided files and use the information to complete the assigned approach.

Original Task: ${task}
Your Approach: ${approach}
Approach Description: ${description}${contextInfo}

Available documents: ${filesInfo}

Please analyze the uploaded documents to find relevant information for this task and approach. Use the document contents to provide a comprehensive response that addresses the specific approach you've been assigned.

Focus on:
1. Finding relevant information in the uploaded documents
2. Synthesizing information from multiple documents if applicable
3. Providing specific citations or references to the source documents
4. Clearly distinguishing between information from the documents vs. your general knowledge

Format your response as:
<result>
Your detailed result based on the document analysis
</result>`;

    try {
      const response = await this.connector.fileBasedCall(
        textContent,
        this.uploadedFiles.map(f => f.id),
        this.options.model,
        `LIBRARIAN-WORKER (${approach})`
      );

      const duration = Date.now() - startTime;

      // Extract result from XML tags
      const resultMatch = response.content.match(/<result>([\s\S]*?)<\/result>/);
      const result = resultMatch ? resultMatch[1].trim() : response.content;

      return {
        approach,
        result,
        filesUsed: this.uploadedFiles.map(f => f.name),
        model: this.options.model,
        duration,
      };

    } catch (error) {
      throw new Error(`LibrarianWorker execution failed: ${error}`);
    }
  }

  getUploadedFiles(): UploadedFile[] {
    return [...this.uploadedFiles];
  }

  async cleanup(): Promise<void> {
    // Note: OpenAI files are automatically cleaned up after a period
    // But we could implement explicit cleanup if needed
    this.uploadedFiles = [];
  }
}