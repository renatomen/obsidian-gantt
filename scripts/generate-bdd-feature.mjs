#!/usr/bin/env node
/**
 * OG-38: BDD Feature Template Generator
 * 
 * CLI tool to generate properly structured feature files following project conventions
 * Usage: npm run generate:feature <domain> <feature-name>
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Project BDD conventions
const DOMAINS = [
  'gantt-visualization',
  'task-management', 
  'bases-integration',
  'data-sources',
  'user-experience',
  'infrastructure',
  'performance'
];

const TAG_CATEGORIES = {
  priority: ['@critical', '@high', '@medium', '@low'],
  testType: ['@smoke', '@regression', '@integration'],
  domain: ['@task-management', '@gantt-visualization', '@bases-integration', '@data-sources', '@user-experience'],
  platform: ['@desktop', '@mobile', '@cross-platform'],
  performance: ['@performance', '@load-test'],
  accessibility: ['@accessibility', '@keyboard-nav']
};

/**
 * Generate feature file template
 */
function generateFeatureTemplate(domain, featureName, options = {}) {
  const {
    userType = 'project manager',
    functionality = 'perform an action',
    businessValue = 'achieve a goal',
    includeBackground = true,
    includeScenarioOutline = false,
    tags = ['@medium', '@regression']
  } = options;

  const featureTitle = featureName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const domainTag = `@${domain}`;
  const allTags = [domainTag, ...tags].join(' ');

  let template = `Feature: ${featureTitle}
  As a ${userType}
  I want ${functionality}
  So that ${businessValue}
`;

  if (includeBackground) {
    template += `
  Background:
    Given I have a vault with task notes
    And the Obsidian Gantt plugin is enabled
    And I have Bases integration configured
`;
  }

  template += `
  ${allTags}
  Scenario: Basic ${featureName.replace(/-/g, ' ')} functionality
    Given I have the necessary setup
    When I perform the main action
    Then I should see the expected result
    And the system should behave correctly
`;

  if (includeScenarioOutline) {
    template += `
  ${allTags} @data-driven
  Scenario Outline: ${featureTitle} with different parameters
    Given I have a setup with <parameter>
    When I perform an action with <parameter>
    Then I should see <expected_result>
    
    Examples:
      | parameter | expected_result |
      | value1    | result1        |
      | value2    | result2        |
`;
  }

  template += `
  ${allTags} @error-handling
  Scenario: Handle error conditions gracefully
    Given I have an invalid setup
    When I attempt the action
    Then I should see a helpful error message
    And the system should remain stable
`;

  return template;
}

/**
 * Create feature file
 */
function createFeatureFile(domain, featureName, options = {}) {
  // Validate domain
  if (!DOMAINS.includes(domain)) {
    console.error(`❌ Invalid domain: ${domain}`);
    console.error(`Available domains: ${DOMAINS.join(', ')}`);
    process.exit(1);
  }

  // Validate feature name
  if (!featureName || !/^[a-z0-9-]+$/.test(featureName)) {
    console.error('❌ Feature name must be lowercase with hyphens (e.g., task-editing)');
    process.exit(1);
  }

  const featuresDir = join(process.cwd(), 'features', domain);
  const featureFile = join(featuresDir, `${featureName}.feature`);

  // Check if file already exists
  if (existsSync(featureFile)) {
    console.error(`❌ Feature file already exists: ${featureFile}`);
    process.exit(1);
  }

  // Create directory if it doesn't exist
  if (!existsSync(featuresDir)) {
    mkdirSync(featuresDir, { recursive: true });
    console.log(`📁 Created directory: ${featuresDir}`);
  }

  // Generate template
  const template = generateFeatureTemplate(domain, featureName, options);

  // Write file
  writeFileSync(featureFile, template);
  console.log(`✅ Created feature file: ${featureFile}`);

  return featureFile;
}

/**
 * Interactive prompts for feature generation
 */
function promptForFeatureDetails() {
  console.log('🛠️ BDD Feature Generator - Interactive Mode\n');
  
  // This is a simplified version - in a real implementation you'd use inquirer or similar
  console.log('Available domains:');
  DOMAINS.forEach((domain, index) => {
    console.log(`  ${index + 1}. ${domain}`);
  });
  
  console.log('\nUsage: npm run generate:feature <domain> <feature-name>');
  console.log('Example: npm run generate:feature task-management task-editing');
  console.log('\nOptions:');
  console.log('  --user-type "user type"');
  console.log('  --functionality "what they want"');
  console.log('  --business-value "why they want it"');
  console.log('  --no-background (skip background section)');
  console.log('  --scenario-outline (include scenario outline)');
  console.log('  --tags "@tag1,@tag2" (custom tags)');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    promptForFeatureDetails();
    process.exit(0);
  }

  const [domain, featureName] = args;
  const options = {};

  // Parse options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--no-background') {
      options.includeBackground = false;
    } else if (arg === '--scenario-outline') {
      options.includeScenarioOutline = true;
    } else if (arg === '--user-type' && args[i + 1]) {
      options.userType = args[++i];
    } else if (arg === '--functionality' && args[i + 1]) {
      options.functionality = args[++i];
    } else if (arg === '--business-value' && args[i + 1]) {
      options.businessValue = args[++i];
    } else if (arg === '--tags' && args[i + 1]) {
      options.tags = args[++i].split(',').map(tag => tag.trim());
    }
  }

  return { domain, featureName, options };
}

/**
 * Show available tags
 */
function showAvailableTags() {
  console.log('\n📋 Available Tags by Category:\n');
  
  Object.entries(TAG_CATEGORIES).forEach(([category, tags]) => {
    console.log(`${category.charAt(0).toUpperCase() + category.slice(1)}:`);
    tags.forEach(tag => console.log(`  ${tag}`));
    console.log('');
  });
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('🧪 OG-38: BDD Feature Template Generator\n');

    // Show help if requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      promptForFeatureDetails();
      showAvailableTags();
      process.exit(0);
    }

    // Show available tags if requested
    if (process.argv.includes('--tags-help')) {
      showAvailableTags();
      process.exit(0);
    }

    const { domain, featureName, options } = parseArgs();
    
    console.log(`📝 Generating feature: ${featureName}`);
    console.log(`📂 Domain: ${domain}`);
    console.log(`🏷️ Tags: ${options.tags || ['@medium', '@regression']}\n`);

    createFeatureFile(domain, featureName, options);

    console.log('\n🎉 Feature file created successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Edit the feature file to add specific scenarios');
    console.log('2. Run validation: npm run validate:bdd');
    console.log('3. Implement step definitions in test/step-definitions/');
    console.log('4. Run BDD tests: npm run test:bdd');
    
  } catch (error) {
    console.error(`❌ Error generating feature: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
export { generateFeatureTemplate, createFeatureFile, DOMAINS, TAG_CATEGORIES };

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('generate-bdd-feature.mjs')) {
  main();
}
