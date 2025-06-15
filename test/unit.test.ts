import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractXml, extractSingleXml, parseSubtaskStrategies, parseWorkerResults } from '../src/utils/xml-parser.js';

describe('XML Parser Utils', () => {
  describe('extractXml', () => {
    it('should extract single XML tag content', () => {
      const text = '<test>Hello World</test>';
      const result = extractXml(text, 'test');
      expect(result).toEqual(['Hello World']);
    });

    it('should extract multiple XML tag contents', () => {
      const text = '<test>First</test><test>Second</test>';
      const result = extractXml(text, 'test');
      expect(result).toEqual(['First', 'Second']);
    });

    it('should handle multiline content', () => {
      const text = `<test>
        Multi
        Line
        Content
      </test>`;
      const result = extractXml(text, 'test');
      expect(result[0]).toContain('Multi');
      expect(result[0]).toContain('Line');
    });

    it('should return empty array for non-existent tags', () => {
      const text = '<other>content</other>';
      const result = extractXml(text, 'test');
      expect(result).toEqual([]);
    });
  });

  describe('extractSingleXml', () => {
    it('should extract first occurrence', () => {
      const text = '<test>First</test><test>Second</test>';
      const result = extractSingleXml(text, 'test');
      expect(result).toBe('First');
    });

    it('should return null for non-existent tags', () => {
      const text = '<other>content</other>';
      const result = extractSingleXml(text, 'test');
      expect(result).toBeNull();
    });
  });

  describe('parseSubtaskStrategies', () => {
    it('should parse approach, agent, and description triplets', () => {
      const text = `
        <approach>Direct Research</approach>
        <agent>search</agent>
        <description>Search for founder information directly</description>
        <approach>Company History</approach>
        <agent>simple</agent>
        <description>Look at company history and founding story</description>
      `;
      
      const result = parseSubtaskStrategies(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        approach: 'Direct Research',
        agentType: 'search',
        description: 'Search for founder information directly'
      });
      expect(result[1]).toEqual({
        approach: 'Company History',
        agentType: 'simple',
        description: 'Look at company history and founding story'
      });
    });

    it('should handle mismatched approach/agent/description counts', () => {
      const text = `
        <approach>First</approach>
        <agent>simple</agent>
        <description>First desc</description>
        <approach>Second</approach>
        <agent>search</agent>
      `;
      
      const result = parseSubtaskStrategies(text);
      expect(result).toHaveLength(1); // Only complete triplets
    });

    it('should handle invalid agent types by defaulting to simple', () => {
      const text = `
        <approach>Test Approach</approach>
        <agent>invalid_type</agent>
        <description>Test description</description>
      `;
      
      const result = parseSubtaskStrategies(text);
      expect(result).toHaveLength(1);
      expect(result[0].agentType).toBe('simple');
    });
  });

  describe('parseWorkerResults', () => {
    it('should parse worker responses with result tags', () => {
      const responses = [
        '<result>First worker result</result>',
        '<result>Second worker result</result>'
      ];
      const approaches = ['Approach 1', 'Approach 2'];
      
      const result = parseWorkerResults(responses, approaches);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        approach: 'Approach 1',
        result: 'First worker result'
      });
      expect(result[1]).toEqual({
        approach: 'Approach 2',
        result: 'Second worker result'
      });
    });

    it('should handle responses without result tags', () => {
      const responses = ['Raw response without tags'];
      const approaches = ['Approach 1'];
      
      const result = parseWorkerResults(responses, approaches);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        approach: 'Approach 1',
        result: 'Raw response without tags'
      });
    });

    it('should handle mismatched response/approach counts', () => {
      const responses = ['Response 1', 'Response 2', 'Response 3'];
      const approaches = ['Approach 1', 'Approach 2'];
      
      const result = parseWorkerResults(responses, approaches);
      expect(result).toHaveLength(2); // Limited by approaches length
    });
  });
});