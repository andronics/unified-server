/**
 * Topic pattern matching utility
 * Layer 2: Infrastructure
 *
 * Supports wildcard patterns:
 * - * matches a single segment (e.g., "messages.*" matches "messages.sent")
 * - ** matches multiple segments (e.g., "messages.**" matches "messages.user.123.sent")
 */

import { TopicMatcher as ITopicMatcher } from '@shared/types/pubsub-types';

export class TopicMatcher implements ITopicMatcher {
  /**
   * Check if a topic matches a pattern
   * @param topic - Actual topic (e.g., "messages.user.123.sent")
   * @param pattern - Pattern with wildcards (e.g., "messages.*")
   * @returns true if topic matches pattern
   */
  matches(topic: string, pattern: string): boolean {
    // Exact match
    if (topic === pattern) {
      return true;
    }

    // No wildcards, must be exact match (already checked above)
    if (!pattern.includes('*')) {
      return false;
    }

    // Convert pattern to regex
    const regex = this.patternToRegex(pattern);
    return regex.test(topic);
  }

  /**
   * Convert topic pattern to regex
   * @param pattern - Pattern with wildcards
   * @returns Regular expression
   */
  private patternToRegex(pattern: string): RegExp {
    // First, handle ** wildcard replacements BEFORE escaping dots
    // Replace .** at the end with a marker for optional match
    let regexPattern = pattern.replace(/\.\*\*$/g, '__OPTIONAL_TAIL__');

    // Replace remaining ** with a marker for multi-level match
    regexPattern = regexPattern.replace(/\*\*/g, '__MULTI_LEVEL__');

    // Replace single * with a marker (before escaping)
    regexPattern = regexPattern.replace(/\*/g, '__SINGLE_LEVEL__');

    // Now escape special regex characters (no more wildcards to protect)
    regexPattern = regexPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Replace markers with actual regex patterns
    regexPattern = regexPattern.replace(/__OPTIONAL_TAIL__/g, '(\\..*)?');
    regexPattern = regexPattern.replace(/__MULTI_LEVEL__/g, '.*');
    regexPattern = regexPattern.replace(/__SINGLE_LEVEL__/g, '[^.]+');

    // Anchor to start and end
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Get all topics that match a pattern from a list
   * @param topics - List of topics
   * @param pattern - Pattern to match
   * @returns Matching topics
   */
  filter(topics: string[], pattern: string): string[] {
    return topics.filter((topic) => this.matches(topic, pattern));
  }

  /**
   * Check if a pattern contains wildcards
   */
  hasWildcards(pattern: string): boolean {
    return pattern.includes('*');
  }
}

// Export singleton instance
export const topicMatcher = new TopicMatcher();
