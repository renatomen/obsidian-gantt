#!/usr/bin/env node
/**
 * OG-37: BDD Syntax Validation Script
 * 
 * Validates Gherkin syntax in feature files before commits
 * Integrates with Husky pre-commit hooks
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

/**
 * Find all .feature files in the features directory
 */
function findFeatureFiles(dir = 'features') {
  const featureFiles = [];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        featureFiles.push(...findFeatureFiles(fullPath));
      } else if (extname(item) === '.feature') {
        featureFiles.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or is not accessible
    console.log(`📁 No features directory found at: ${dir}`);
  }
  
  return featureFiles;
}

/**
 * Validate a single feature file using regex patterns
 */
function validateFeatureFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(line => line.trim());
    const errors = [];

    // Check for Feature declaration
    const featureLine = lines.find(line => line.startsWith('Feature:'));
    if (!featureLine) {
      errors.push(`No Feature declaration found in ${filePath}`);
      return { valid: false, errors };
    }

    // Check feature has a name
    const featureName = featureLine.replace('Feature:', '').trim();
    if (!featureName) {
      errors.push(`Feature name is missing in ${filePath}`);
    }

    // Find scenarios
    const scenarioLines = lines.filter(line =>
      line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')
    );

    if (scenarioLines.length === 0) {
      errors.push(`No scenarios found in ${filePath}`);
      return { valid: false, errors };
    }

    // Validate each scenario
    for (let i = 0; i < scenarioLines.length; i++) {
      const scenarioLine = scenarioLines[i];
      const scenarioName = scenarioLine.replace(/^Scenario( Outline)?:/, '').trim();

      if (!scenarioName) {
        errors.push(`Scenario ${i + 1} name is missing in ${filePath}`);
        continue;
      }

      // Find the scenario block (from this scenario to the next or end of file)
      const scenarioStartIndex = lines.indexOf(scenarioLine);
      const nextScenarioIndex = i + 1 < scenarioLines.length ?
        lines.indexOf(scenarioLines[i + 1]) : lines.length;

      const scenarioBlock = lines.slice(scenarioStartIndex, nextScenarioIndex);

      // Check for Given-When-Then structure
      const hasGiven = scenarioBlock.some(line => line.startsWith('Given'));
      const hasWhen = scenarioBlock.some(line => line.startsWith('When'));
      const hasThen = scenarioBlock.some(line => line.startsWith('Then'));

      if (!hasGiven) {
        errors.push(`Scenario "${scenarioName}" missing Given step in ${filePath}`);
      }
      if (!hasWhen) {
        errors.push(`Scenario "${scenarioName}" missing When step in ${filePath}`);
      }
      if (!hasThen) {
        errors.push(`Scenario "${scenarioName}" missing Then step in ${filePath}`);
      }

      // Check for empty steps
      const stepLines = scenarioBlock.filter(line =>
        line.startsWith('Given') || line.startsWith('When') ||
        line.startsWith('Then') || line.startsWith('And') || line.startsWith('But')
      );

      if (stepLines.length === 0) {
        errors.push(`Scenario "${scenarioName}" has no steps in ${filePath}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`Gherkin syntax error in ${filePath}: ${error.message}`]
    };
  }
}

/**
 * Validate all feature files
 */
function validateAllFeatureFiles() {
  console.log('🧪 OG-37: Validating BDD feature files...\n');
  
  const featureFiles = findFeatureFiles();
  
  if (featureFiles.length === 0) {
    console.log('📝 No feature files found to validate');
    return true;
  }
  
  console.log(`📋 Found ${featureFiles.length} feature file(s) to validate:`);
  featureFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');
  
  let allValid = true;
  const allErrors = [];
  
  for (const filePath of featureFiles) {
    const result = validateFeatureFile(filePath);
    
    if (result.valid) {
      console.log(`✅ ${filePath} - Valid`);
    } else {
      console.log(`❌ ${filePath} - Invalid`);
      result.errors.forEach(error => {
        console.log(`   └─ ${error}`);
        allErrors.push(error);
      });
      allValid = false;
    }
  }
  
  console.log('');
  
  if (allValid) {
    console.log('🎉 All BDD feature files are valid!');
  } else {
    console.log(`💥 Found ${allErrors.length} validation error(s):`);
    console.log('');
    console.log('🔧 Fix these issues before committing:');
    allErrors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log('');
    console.log('📚 BDD Best Practices:');
    console.log('   - Every feature must have a name and description');
    console.log('   - Every scenario must have Given-When-Then steps');
    console.log('   - Use domain language, avoid technical implementation details');
    console.log('   - Keep scenarios independent and focused');
  }
  
  return allValid;
}

/**
 * Main execution
 */
function main() {
  const isValid = validateAllFeatureFiles();
  
  if (!isValid) {
    console.log('\n❌ BDD validation failed. Commit blocked.');
    process.exit(1);
  }
  
  console.log('\n✅ BDD validation passed. Proceeding with commit.');
  process.exit(0);
}

// Run validation if called directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('validate-bdd-syntax.mjs')) {
  main();
}

export { validateAllFeatureFiles, validateFeatureFile, findFeatureFiles };
