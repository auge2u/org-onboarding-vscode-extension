/**
 * Unit tests for the AdvancedMLPredictor
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { AdvancedMLPredictor } from '../../profiling/mlPredictor';
import { EnhancedLanguageProfile, MLPredictionResult } from '../../profiling/types';

describe('AdvancedMLPredictor', () => {
  let predictor: AdvancedMLPredictor;
  const modelsPath = path.join(__dirname, '..', '..', '..', 'test-models');

  before(() => {
    // Create a test models directory
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }
    
    predictor = new AdvancedMLPredictor(modelsPath);
  });

  after(() => {
    // Clean up the test models directory
    fs.rmSync(modelsPath, { recursive: true, force: true });
  });

  it('should predict an optimal configuration', async () => {
    const profile: EnhancedLanguageProfile = {
      primary: ['javascript', 'typescript'],
      secondary: [],
      frameworks: ['react'],
      buildTools: ['webpack'],
      configFiles: {},
      complexity: 'moderate',
      confidence: 0.9,
      languageConfidence: {},
      dialectVersions: {},
      mixedLanguageBreakdown: {},
      domainSpecificLanguages: [],
      frameworkVersions: {},
      architecturePatterns: []
    };
    
    const result = await predictor.predictOptimalConfiguration(profile);
    
    assert.ok(result.configurationSuggestions, 'Should have configuration suggestions');
    assert.ok(result.confidence >= 0, 'Should have a confidence score');
  });

  it('should identify patterns in a repository', async () => {
    const patterns = await predictor.identifyPatterns('');
    
    assert.ok(patterns.languages, 'Should have language patterns');
    assert.ok(patterns.frameworks, 'Should have framework patterns');
  });

  it('should detect anomalies in a repository', async () => {
    const anomalies = await predictor.detectAnomalies('');
    
    assert.ok(anomalies, 'Should return an object of anomalies');
  });

  it('should train a model with new data', async () => {
    const trainingData = [
      {
        features: {
          languages: ['python'],
          frameworks: ['django']
        },
        configuration: {
          linters: {
            pylint: { enabled: true }
          }
        }
      }
    ];
    
    await predictor.trainModel(trainingData);
    
    // Check if the model was updated
    const modelPath = path.join(modelsPath, 'config-predictor.json');
    const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    
    assert.strictEqual(modelData.trainingSize, 1, 'Should have updated training size');
  });
});