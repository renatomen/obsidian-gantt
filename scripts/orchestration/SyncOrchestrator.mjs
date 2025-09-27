/**
 * Refactored SyncOrchestrator with dependency injection and single responsibility methods
 */

import { SyncOrchestrationError } from '../errors/SyncErrors.mjs';

export class ConsoleLogger {
  constructor(config) {
    this.config = config;
  }

  info(message) {
    console.log(`${this.config.ui.icons.info} ${message}`);
  }

  success(message) {
    console.log(`${this.config.ui.icons.success} ${message}`);
  }

  warning(message) {
    console.log(`${this.config.ui.icons.warning} ${message}`);
  }

  error(message) {
    console.log(`${this.config.ui.icons.error} ${message}`);
  }
}

export class SyncOrchestrator {
  constructor(
    config,
    stagingManager,
    diffManager,
    conflictResolver,
    gherkinValidator,
    logger = null
  ) {
    this.config = config;
    this.stagingManager = stagingManager;
    this.diffManager = diffManager;
    this.conflictResolver = conflictResolver;
    this.gherkinValidator = gherkinValidator;
    this.logger = logger || new ConsoleLogger(config);
  }

  /**
   * Main execution method - orchestrates the sync process
   */
  async execute() {
    try {
      this.logger.info('Starting GitHub ↔ AssertThat sync...');
      
      // Phase 1: Configuration validation
      await this.validateConfigurationPhase();
      
      // Phase 2: Staging area setup
      await this.setupStagingPhase();
      
      // Phase 3: Change detection and validation
      const changes = await this.detectChangesPhase();
      
      // Phase 4: Conflict resolution
      const classified = await this.resolveConflictsPhase(changes);
      
      // Phase 5: Interactive resolution if needed
      const resolutionResults = await this.handleInteractiveResolutionPhase(classified);
      
      // Phase 6: Cleanup
      await this.cleanupPhase();
      
      this.logger.success('Sync process completed');
      
      return {
        success: true,
        phase: 'completed',
        changes,
        classified,
        resolutionResults,
      };
      
    } catch (error) {
      return await this.handleExecutionError(error);
    }
  }

  /**
   * Phase 1: Validate configuration and prerequisites
   */
  async validateConfigurationPhase() {
    try {
      const validation = this.config.validateConfiguration();
      
      if (!validation.isValid) {
        this.logger.warning(`Missing environment variables, using demo mode`);
        this.logger.warning(`Missing: ${validation.missingFields.join(', ')}`);
      }
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Configuration validation failed',
        'configuration',
        { validationError: error.message }
      );
    }
  }

  /**
   * Phase 2: Setup staging area and download features
   */
  async setupStagingPhase() {
    try {
      await this.stagingManager.createStagingArea();
      await this.stagingManager.downloadAssertThatFeatures();
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Staging area setup failed',
        'staging',
        { setupError: error.message }
      );
    }
  }

  /**
   * Phase 3: Detect changes and validate feature files
   */
  async detectChangesPhase() {
    try {
      this.logger.info('Detecting changes between GitHub and AssertThat...');
      const changes = await this.diffManager.detectChanges();
      
      this.logger.info('Validating feature files...');
      await this.validateFeatureFiles(changes);
      
      return changes;
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Change detection failed',
        'detection',
        { detectionError: error.message }
      );
    }
  }

  /**
   * Phase 4: Classify changes and attempt auto-resolution
   */
  async resolveConflictsPhase(changes) {
    try {
      this.logger.info('Classifying changes for conflict resolution...');
      const classified = await this.diffManager.classifyChanges(changes);
      
      this.logClassificationResults(classified);
      
      return classified;
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Conflict resolution failed',
        'resolution',
        { resolutionError: error.message }
      );
    }
  }

  /**
   * Phase 5: Handle interactive resolution for complex conflicts
   */
  async handleInteractiveResolutionPhase(classified) {
    if (classified.complex.length === 0) {
      this.logger.success('All conflicts resolved automatically - sync can proceed');
      return { resolved: [], skipped: [], failed: [] };
    }

    try {
      this.logger.warning('Interactive resolution required for complex conflicts...');
      const resolutionResults = await this.handleInteractiveResolution(classified.complex);
      
      this.logResolutionSummary(resolutionResults);
      
      return resolutionResults;
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Interactive resolution failed',
        'interactive',
        { interactiveError: error.message }
      );
    }
  }

  /**
   * Phase 6: Cleanup staging area
   */
  async cleanupPhase() {
    try {
      await this.stagingManager.cleanStagingArea();
      
    } catch (error) {
      throw new SyncOrchestrationError(
        'Cleanup failed',
        'cleanup',
        { cleanupError: error.message }
      );
    }
  }

  /**
   * Handle execution errors with proper cleanup
   */
  async handleExecutionError(error) {
    this.logger.error(`Sync failed: ${error.message}`);
    
    // Attempt cleanup on error
    try {
      await this.stagingManager.cleanStagingArea();
    } catch (cleanupError) {
      this.logger.error(`Cleanup failed: ${cleanupError.message}`);
    }
    
    return {
      success: false,
      phase: 'error',
      error,
    };
  }

  /**
   * Validate feature files using the Gherkin validator
   */
  async validateFeatureFiles(changes) {
    // Implementation would call gherkinValidator.validateFeatureFiles
    // This is a placeholder for the actual validation logic
  }

  /**
   * Handle interactive resolution for complex files
   */
  async handleInteractiveResolution(complexFiles) {
    // Implementation would handle interactive resolution
    // This is a placeholder for the actual resolution logic
    return { resolved: [], skipped: [], failed: [] };
  }

  /**
   * Log classification results
   */
  logClassificationResults(classified) {
    this.logger.info(`Classification results:`);
    this.logger.success(`Simple: ${classified.simple?.length || 0} files`);
    this.logger.info(`Auto-resolved: ${classified.autoResolved?.length || 0} files`);
    this.logger.warning(`Complex: ${classified.complex?.length || 0} files`);
  }

  /**
   * Log resolution summary
   */
  logResolutionSummary(resolutionResults) {
    this.logger.info('Interactive resolution summary:');
    this.logger.success(`Resolved: ${resolutionResults.resolved.length} files`);
    this.logger.info(`Skipped: ${resolutionResults.skipped.length} files`);
    this.logger.error(`Failed: ${resolutionResults.failed.length} files`);

    if (resolutionResults.skipped.length > 0) {
      this.logger.warning('Skipped files will need manual resolution before next sync:');
      resolutionResults.skipped.forEach(file => 
        console.log(`  - ${file}`)
      );
    }
  }
}
