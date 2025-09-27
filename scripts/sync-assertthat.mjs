#!/usr/bin/env node

/**
 * GitHub to AssertThat BDD Sync Script
 * Implements staging folder approach for bidirectional sync
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const CONFIG = {
  FEATURES_DIR: 'features',
  STAGING_DIR: 'featureSyncStage',
  SYNC_BRANCH_PREFIX: 'sync/assertthat',
  COMMIT_PREFIX: 'chore/sync',
  ASSERTTHAT_PROJECT_ID: process.env.ASSERTTHAT_PROJECT_ID,
  ASSERTTHAT_ACCESS_KEY: process.env.ASSERTTHAT_ACCESS_KEY,
  ASSERTTHAT_SECRET_KEY: process.env.ASSERTTHAT_SECRET_KEY,
  ASSERTTHAT_TOKEN: process.env.ASSERTTHAT_TOKEN,
  JIRA_SERVER_URL: process.env.JIRA_SERVER_URL
};

/**
 * Staging Area Manager
 * Handles creation, management, and cleanup of the featureSyncStage directory
 */
class StagingAreaManager {
  constructor() {
    this.stagingPath = path.resolve(CONFIG.STAGING_DIR);
    this.featuresPath = path.resolve(CONFIG.FEATURES_DIR);
  }

  /**
   * Creates and initializes the staging directory
   */
  async createStagingArea() {
    try {
      console.log('📁 Creating staging area...');
      
      // Remove existing staging area if it exists
      await this.cleanStagingArea();
      
      // Create new staging directory
      await fs.mkdir(this.stagingPath, { recursive: true });
      
      console.log(`✅ Staging area created at: ${this.stagingPath}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to create staging area:', error.message);
      throw error;
    }
  }

  /**
   * Downloads features from AssertThat to staging area
   */
  async downloadAssertThatFeatures() {
    try {
      console.log('⬇️ Downloading features from AssertThat...');

      // TODO: Implement AssertThat API download
      // For now, create a placeholder structure to test the staging system

      // Create subdirectories to match GitHub structure
      const testDirs = ['bases-integration', 'bdd-framework', 'data-sources'];
      for (const dir of testDirs) {
        await fs.mkdir(path.join(this.stagingPath, dir), { recursive: true });
      }

      // Create some test features in AssertThat format
      const testFeatures = {
        'test-feature.feature': `Feature: Test Feature from AssertThat
  As a user
  I want to test the sync system
  So that I can verify it works

  Scenario: Test scenario
    Given I have a test scenario
    When I run the sync
    Then it should work correctly`,

        'bases-integration/data-mapping.feature': `Feature: Data Mapping (AssertThat Version)
  As a developer
  I want to map data from AssertThat
  So that I can sync with GitHub

  Scenario: Map data correctly
    Given I have AssertThat data
    When I map it to GitHub format
    Then it should be correctly formatted`
      };

      for (const [filePath, content] of Object.entries(testFeatures)) {
        await fs.writeFile(path.join(this.stagingPath, filePath), content);
      }

      console.log('✅ Features downloaded to staging area');
      return true;
    } catch (error) {
      console.error('❌ Failed to download AssertThat features:', error.message);
      throw error;
    }
  }

  /**
   * Cleans up the staging area
   */
  async cleanStagingArea() {
    try {
      await fs.rm(this.stagingPath, { recursive: true, force: true });
      console.log('🧹 Staging area cleaned');
    } catch (error) {
      // Ignore errors if directory doesn't exist
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Warning: Could not clean staging area:', error.message);
      }
    }
  }

  /**
   * Gets list of feature files in staging area (recursively)
   */
  async getStagingFeatures() {
    try {
      const features = [];
      await this._scanDirectory(this.stagingPath, features);
      return features;
    } catch (error) {
      console.error('❌ Failed to read staging area:', error.message);
      return [];
    }
  }

  /**
   * Gets list of feature files in main features directory (recursively)
   */
  async getGitHubFeatures() {
    try {
      const features = [];
      await this._scanDirectory(this.featuresPath, features);
      return features;
    } catch (error) {
      console.error('❌ Failed to read features directory:', error.message);
      return [];
    }
  }

  /**
   * Recursively scans directory for .feature files
   */
  async _scanDirectory(dirPath, features, relativePath = '') {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relPath = relativePath ? path.join(relativePath, item.name) : item.name;

        if (item.isDirectory()) {
          await this._scanDirectory(fullPath, features, relPath);
        } else if (item.name.endsWith('.feature')) {
          features.push(relPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Warning: Could not scan directory ${dirPath}:`, error.message);
    }
  }
}

/**
 * Gherkin Parser and Validator
 * Handles parsing and validation of .feature files using @cucumber/gherkin
 */
class GherkinValidator {
  constructor() {
    // Initialize the official Cucumber Gherkin parser components
    this.uuidFn = () => Math.random().toString(36).substring(2, 15);
  }

  /**
   * Validates a feature file's Gherkin syntax
   */
  async validateFeatureFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.validateFeatureContent(content, filePath);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to read file: ${error.message}`],
        warnings: [],
        metadata: null
      };
    }
  }

  /**
   * Validates Gherkin content string using @cucumber/gherkin AST parser
   */
  async validateFeatureContent(content, sourcePath = 'unknown') {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: null
    };

    try {
      // Import Gherkin components dynamically
      const gherkin = await import('@cucumber/gherkin');
      const { generateMessages, makeSourceEnvelope } = gherkin;

      // Create source envelope and parse the feature file
      const sourceEnvelope = makeSourceEnvelope(content, sourcePath);
      const messages = generateMessages(
        sourceEnvelope.source.data,
        sourceEnvelope.source.uri,
        sourceEnvelope.source.mediaType,
        {
          includeSource: false,
          includeGherkinDocument: true,
          newId: this.uuidFn
        }
      );

      // Find the GherkinDocument message
      const gherkinDocumentMessage = messages.find(message => message.gherkinDocument);
      const gherkinDocument = gherkinDocumentMessage?.gherkinDocument;

      // Extract feature information from AST
      if (gherkinDocument && gherkinDocument.feature) {
        result.metadata = this.extractFeatureDataFromAST(gherkinDocument.feature);

        // Validate feature structure
        this.validateFeatureStructure(gherkinDocument.feature, result);
      } else {
        result.isValid = false;
        result.errors.push('No valid feature found in file');
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Gherkin parse error: ${error.message}`);
    }

    return result;
  }

  /**
   * Extracts feature data from Gherkin AST
   */
  extractFeatureDataFromAST(feature) {
    const metadata = {
      name: feature.name || '',
      description: feature.description || '',
      tags: feature.tags ? feature.tags.map(tag => tag.name) : [],
      scenarios: [],
      language: feature.language || 'en'
    };

    // Extract scenarios from AST
    if (feature.children) {
      feature.children.forEach(child => {
        if (child.scenario) {
          const scenario = child.scenario;
          metadata.scenarios.push({
            name: scenario.name || '',
            tags: scenario.tags ? scenario.tags.map(tag => tag.name) : [],
            steps: scenario.steps ? scenario.steps.length : 0,
            type: 'scenario'
          });
        } else if (child.rule) {
          // Handle rules containing scenarios
          const rule = child.rule;
          if (rule.children) {
            rule.children.forEach(ruleChild => {
              if (ruleChild.scenario) {
                const scenario = ruleChild.scenario;
                metadata.scenarios.push({
                  name: scenario.name || '',
                  tags: scenario.tags ? scenario.tags.map(tag => tag.name) : [],
                  steps: scenario.steps ? scenario.steps.length : 0,
                  type: 'scenario',
                  rule: rule.name
                });
              }
            });
          }
        }
      });
    }

    return metadata;
  }

  /**
   * Validates feature structure from AST
   */
  validateFeatureStructure(feature, result) {
    // Check if feature has a name
    if (!feature.name || feature.name.trim() === '') {
      result.warnings.push('Feature should have a descriptive name');
    }

    // Check for scenarios
    let scenarioCount = 0;
    if (feature.children) {
      feature.children.forEach(child => {
        if (child.scenario) {
          scenarioCount++;
          this.validateScenarioFromAST(child.scenario, result);
        } else if (child.rule && child.rule.children) {
          child.rule.children.forEach(ruleChild => {
            if (ruleChild.scenario) {
              scenarioCount++;
              this.validateScenarioFromAST(ruleChild.scenario, result);
            }
          });
        }
      });
    }

    if (scenarioCount === 0) {
      result.warnings.push('Feature should contain at least one scenario');
    }
  }

  /**
   * Validates a scenario from AST
   */
  validateScenarioFromAST(scenario, result) {
    // Check if scenario has a name
    if (!scenario.name || scenario.name.trim() === '') {
      result.warnings.push('Scenario should have a descriptive name');
    }

    // Check if scenario has steps
    if (!scenario.steps || scenario.steps.length === 0) {
      result.warnings.push(`Scenario "${scenario.name}" has no steps`);
    } else {
      // Validate step structure
      const stepKeywords = scenario.steps.map(step => step.keyword.trim());
      this.validateStepFlow(stepKeywords, scenario.name, result);
    }
  }

  /**
   * Validates the Given-When-Then flow in steps
   */
  validateStepFlow(stepKeywords, scenarioName, result) {
    const hasGiven = stepKeywords.some(keyword => keyword.startsWith('Given'));
    const hasWhen = stepKeywords.some(keyword => keyword.startsWith('When'));
    const hasThen = stepKeywords.some(keyword => keyword.startsWith('Then'));

    if (!hasGiven) {
      result.warnings.push(`Scenario "${scenarioName}" should have at least one Given step`);
    }
    if (!hasWhen) {
      result.warnings.push(`Scenario "${scenarioName}" should have at least one When step`);
    }
    if (!hasThen) {
      result.warnings.push(`Scenario "${scenarioName}" should have at least one Then step`);
    }
  }

  /**
   * Transforms parsed Gherkin data into AssertThat API-compatible format
   */
  transformToAssertThatFormat(metadata, filePath) {
    if (!metadata) {
      return null;
    }

    const assertThatFeature = {
      name: metadata.name,
      description: metadata.description,
      tags: metadata.tags,
      scenarios: metadata.scenarios.map(scenario => ({
        name: scenario.name,
        tags: scenario.tags,
        steps: [], // Steps would be extracted from AST if needed
        type: scenario.type || 'scenario',
        rule: scenario.rule || null
      })),
      source: {
        file: filePath,
        type: 'github'
      }
    };

    return assertThatFeature;
  }

  /**
   * Processes multiple feature files efficiently (batch processing)
   */
  async processMultipleFiles(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        const validationResult = await this.validateFeatureFile(filePath);

        if (validationResult.isValid && validationResult.metadata) {
          const transformedData = this.transformToAssertThatFormat(
            validationResult.metadata,
            filePath
          );

          results.push({
            filePath,
            valid: true,
            data: transformedData,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          });
        } else {
          results.push({
            filePath,
            valid: false,
            data: null,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          });
        }
      } catch (error) {
        results.push({
          filePath,
          valid: false,
          data: null,
          errors: [`Processing error: ${error.message}`],
          warnings: []
        });
      }
    }

    return results;
  }

  /**
   * Provides clear error messages for invalid or malformed feature files
   */
  formatErrorReport(validationResult) {
    const report = {
      file: validationResult.filePath || 'unknown',
      status: validationResult.isValid ? 'VALID' : 'INVALID',
      summary: '',
      details: []
    };

    if (validationResult.errors.length > 0) {
      report.summary = `${validationResult.errors.length} error(s) found`;
      report.details.push(...validationResult.errors.map(error => ({ type: 'ERROR', message: error })));
    }

    if (validationResult.warnings.length > 0) {
      if (report.summary) {
        report.summary += `, ${validationResult.warnings.length} warning(s)`;
      } else {
        report.summary = `${validationResult.warnings.length} warning(s) found`;
      }
      report.details.push(...validationResult.warnings.map(warning => ({ type: 'WARNING', message: warning })));
    }

    if (validationResult.isValid && validationResult.errors.length === 0 && validationResult.warnings.length === 0) {
      report.summary = 'Feature file is valid';
    }

    return report;
  }

  /**
   * Validates multiple feature files and returns summary (batch processing)
   */
  async validateFeatureFiles(filePaths) {
    const results = {
      totalFiles: filePaths.length,
      validFiles: 0,
      invalidFiles: 0,
      totalErrors: 0,
      totalWarnings: 0,
      details: []
    };

    // Use batch processing for efficiency
    const batchResults = await this.processMultipleFiles(filePaths);

    for (const result of batchResults) {
      const formattedReport = this.formatErrorReport({
        filePath: result.filePath,
        isValid: result.valid,
        errors: result.errors,
        warnings: result.warnings
      });

      results.details.push({
        file: result.filePath,
        isValid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        metadata: result.data,
        report: formattedReport
      });

      if (result.valid) {
        results.validFiles++;
      } else {
        results.invalidFiles++;
      }

      results.totalErrors += result.errors.length;
      results.totalWarnings += result.warnings.length;
    }

    return results;
  }
}

/**
 * Git Diff Manager
 * Handles git diff operations and change detection
 */
class GitDiffManager {
  constructor(stagingManager) {
    this.stagingManager = stagingManager;
  }

  /**
   * Detects changes between GitHub features and AssertThat staging area
   */
  async detectChanges() {
    try {
      console.log('🔍 Detecting changes between GitHub and AssertThat...');
      
      const stagingFeatures = await this.stagingManager.getStagingFeatures();
      const githubFeatures = await this.stagingManager.getGitHubFeatures();
      
      const changes = {
        additions: [],      // Files in GitHub but not in AssertThat
        modifications: [],  // Files that exist in both but differ
        deletions: [],      // Files in AssertThat but not in GitHub
        conflicts: []       // Files that have been modified in both places
      };

      // Check for additions and modifications
      for (const githubFile of githubFeatures) {
        if (!stagingFeatures.includes(githubFile)) {
          changes.additions.push(githubFile);
        } else {
          // File exists in both, check if they differ
          const isDifferent = await this.compareFiles(githubFile);
          if (isDifferent) {
            changes.modifications.push(githubFile);
          }
        }
      }

      // Check for deletions
      for (const stagingFile of stagingFeatures) {
        if (!githubFeatures.includes(stagingFile)) {
          changes.deletions.push(stagingFile);
        }
      }

      console.log('📊 Change detection results:');
      console.log(`  Additions: ${changes.additions.length}`);
      console.log(`  Modifications: ${changes.modifications.length}`);
      console.log(`  Deletions: ${changes.deletions.length}`);

      return changes;
    } catch (error) {
      console.error('❌ Failed to detect changes:', error.message);
      throw error;
    }
  }

  /**
   * Compares a feature file between GitHub and staging area
   */
  async compareFiles(filename) {
    try {
      const githubPath = path.join(this.stagingManager.featuresPath, filename);
      const stagingPath = path.join(this.stagingManager.stagingPath, filename);

      const githubContent = await fs.readFile(githubPath, 'utf8');
      const stagingContent = await fs.readFile(stagingPath, 'utf8');

      return githubContent.trim() !== stagingContent.trim();
    } catch (error) {
      console.error(`❌ Failed to compare file ${filename}:`, error.message);
      return true; // Assume different if we can't compare
    }
  }

  /**
   * Uses git diff to show differences between files
   */
  async showDiff(filename) {
    try {
      const githubPath = path.join(CONFIG.FEATURES_DIR, filename);
      const stagingPath = path.join(CONFIG.STAGING_DIR, filename);

      console.log(`\n📋 Diff for ${filename}:`);
      console.log('─'.repeat(50));

      try {
        const diffOutput = execSync(
          `git diff --no-index --color=never "${stagingPath}" "${githubPath}"`,
          { encoding: 'utf8' }
        );
        console.log(diffOutput);
      } catch (error) {
        // git diff returns non-zero exit code when files differ
        if (error.stdout) {
          console.log(error.stdout);
        } else {
          console.log('Files are different but diff could not be generated');
        }
      }

      console.log('─'.repeat(50));
    } catch (error) {
      console.error(`❌ Failed to show diff for ${filename}:`, error.message);
    }
  }

  /**
   * Classifies changes as simple or complex
   */
  async classifyChanges(changes) {
    const classified = {
      simple: [],    // Auto-resolvable changes
      complex: []    // Require manual resolution
    };

    // For now, treat all changes as complex requiring manual review
    // TODO: Implement auto-resolution logic for whitespace, comments, etc.
    classified.complex = [
      ...changes.additions,
      ...changes.modifications,
      ...changes.deletions
    ];

    return classified;
  }
}

/**
 * Main sync orchestrator
 */
class SyncOrchestrator {
  constructor() {
    this.stagingManager = new StagingAreaManager();
    this.diffManager = new GitDiffManager(this.stagingManager);
    this.gherkinValidator = new GherkinValidator();
  }

  /**
   * Validates configuration and prerequisites
   */
  validateConfig() {
    console.log('🔧 Debug: Validating configuration...');

    // Log all environment variables for debugging
    const envVars = [
      'ASSERTTHAT_PROJECT_ID',
      'ASSERTTHAT_ACCESS_KEY',
      'ASSERTTHAT_SECRET_KEY',
      'ASSERTTHAT_TOKEN',
      'JIRA_SERVER_URL'
    ];

    envVars.forEach(varName => {
      const value = CONFIG[varName];
      console.log(`🔧 Debug: CONFIG.${varName}:`, value ? '[SET]' : '[NOT SET]');
    });

    // Validate required environment variables
    const missingVars = [];

    if (!CONFIG.ASSERTTHAT_PROJECT_ID) {
      missingVars.push('ASSERTTHAT_PROJECT_ID');
    }

    // Either access/secret key pair OR token is required
    const hasAccessKeyPair = CONFIG.ASSERTTHAT_ACCESS_KEY && CONFIG.ASSERTTHAT_SECRET_KEY;
    const hasToken = CONFIG.ASSERTTHAT_TOKEN;

    if (!hasAccessKeyPair && !hasToken) {
      missingVars.push('ASSERTTHAT_ACCESS_KEY & ASSERTTHAT_SECRET_KEY (or ASSERTTHAT_TOKEN)');
    }

    // For production mode, require all variables
    if (process.env.NODE_ENV === 'production' && missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // For development/testing, allow demo mode with warnings
    if (missingVars.length > 0) {
      console.log('⚠️ Warning: Missing environment variables, using demo mode');
      console.log('⚠️ Missing:', missingVars.join(', '));

      // Set demo values
      if (!CONFIG.ASSERTTHAT_PROJECT_ID) {
        CONFIG.ASSERTTHAT_PROJECT_ID = 'DEMO';
      }
      if (!hasAccessKeyPair && !hasToken) {
        CONFIG.ASSERTTHAT_ACCESS_KEY = 'DEMO';
        CONFIG.ASSERTTHAT_SECRET_KEY = 'DEMO';
      }
    }
  }

  /**
   * Validates feature files involved in the sync
   */
  async validateFeatureFiles(changes) {
    try {
      console.log('🔍 Validating feature files...');

      // Collect all files that need validation
      const filesToValidate = [
        ...changes.additions,
        ...changes.modifications
      ];

      if (filesToValidate.length === 0) {
        console.log('✅ No files to validate');
        return;
      }

      // Validate GitHub features
      console.log('📝 Validating GitHub features...');
      const githubFiles = filesToValidate.map(file =>
        path.join(this.stagingManager.featuresPath, file)
      );
      const githubValidation = await this.gherkinValidator.validateFeatureFiles(githubFiles);

      // Validate staging features (AssertThat)
      console.log('📝 Validating AssertThat features...');
      const stagingFiles = filesToValidate
        .filter(file => !changes.additions.includes(file)) // Only files that exist in staging
        .map(file => path.join(this.stagingManager.stagingPath, file));
      const stagingValidation = await this.gherkinValidator.validateFeatureFiles(stagingFiles);

      // Report validation results
      this.reportValidationResults('GitHub', githubValidation);
      this.reportValidationResults('AssertThat', stagingValidation);

      // Check if we should proceed with invalid files
      const totalErrors = githubValidation.totalErrors + stagingValidation.totalErrors;
      if (totalErrors > 0) {
        console.log('⚠️ Warning: Found validation errors. Sync may fail.');
        // TODO: Add interactive prompt to continue or abort
      }

    } catch (error) {
      console.error('❌ Feature validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Reports validation results in a formatted way
   */
  reportValidationResults(source, validation) {
    console.log(`\n📊 ${source} Validation Results:`);
    console.log(`  Total files: ${validation.totalFiles}`);
    console.log(`  Valid files: ${validation.validFiles}`);
    console.log(`  Invalid files: ${validation.invalidFiles}`);
    console.log(`  Total errors: ${validation.totalErrors}`);
    console.log(`  Total warnings: ${validation.totalWarnings}`);

    // Show details for invalid files
    const invalidFiles = validation.details.filter(detail => !detail.isValid);
    if (invalidFiles.length > 0) {
      console.log(`\n❌ Invalid files in ${source}:`);
      invalidFiles.forEach(detail => {
        console.log(`  📄 ${detail.file}:`);
        detail.errors.forEach(error => console.log(`    ❌ ${error}`));
        detail.warnings.forEach(warning => console.log(`    ⚠️ ${warning}`));
      });
    }

    // Show warnings for valid files
    const filesWithWarnings = validation.details.filter(detail =>
      detail.isValid && detail.warnings.length > 0
    );
    if (filesWithWarnings.length > 0) {
      console.log(`\n⚠️ Valid files with warnings in ${source}:`);
      filesWithWarnings.forEach(detail => {
        console.log(`  📄 ${detail.file}:`);
        detail.warnings.forEach(warning => console.log(`    ⚠️ ${warning}`));
      });
    }
  }

  /**
   * Main sync execution
   */
  async execute() {
    try {
      console.log('🚀 Starting GitHub ↔ AssertThat sync...');
      
      // Validate configuration
      this.validateConfig();
      
      // Create staging area and download AssertThat features
      await this.stagingManager.createStagingArea();
      await this.stagingManager.downloadAssertThatFeatures();
      
      // Detect changes
      const changes = await this.diffManager.detectChanges();

      // Validate feature files before proceeding
      await this.validateFeatureFiles(changes);

      // Classify changes
      const classified = await this.diffManager.classifyChanges(changes);
      
      if (classified.complex.length === 0) {
        console.log('✅ No conflicts detected - sync can proceed automatically');
        // TODO: Implement automatic sync
      } else {
        console.log('⚠️ Manual review required for the following files:');
        classified.complex.forEach(file => console.log(`  - ${file}`));
        
        // Show diffs for complex changes
        for (const file of classified.complex.slice(0, 3)) { // Limit to first 3 for demo
          await this.diffManager.showDiff(file);
        }
      }
      
      // Clean up staging area
      await this.stagingManager.cleanStagingArea();
      
      console.log('✅ Sync process completed');
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      
      // Clean up on error
      try {
        await this.stagingManager.cleanStagingArea();
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message);
      }
      
      process.exit(1);
    }
  }
}

// Main execution
console.log('🔧 Debug: Script loaded...');
console.log('🔧 Debug: import.meta.url:', import.meta.url);
console.log('🔧 Debug: process.argv[1]:', process.argv[1]);

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  console.log('🔧 Debug: Script starting...');
  const orchestrator = new SyncOrchestrator();
  orchestrator.execute().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
} else {
  console.log('🔧 Debug: Script imported as module');
}

export { StagingAreaManager, GitDiffManager, SyncOrchestrator };
