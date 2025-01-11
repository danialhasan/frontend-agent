import { TestingSystem, Test, TestResult, SystemMessage, Screenshot } from '../types';
import { BrowserAutomation } from '../services/automation';
import { VisualAnalysis } from '../services/visual';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export class TestOrchestrator {
    private system: TestingSystem;
    private stateFilePath: string;
    private automation: BrowserAutomation;
    private visualAnalysis: VisualAnalysis;

    constructor(stateFilePath: string = './test-state.json') {
        this.stateFilePath = stateFilePath;
        this.system = this.createInitialSystem();
        this.automation = new BrowserAutomation();
        this.visualAnalysis = new VisualAnalysis();
    }

    async initialize(): Promise<void> {
        await this.automation.initialize();
        await this.visualAnalysis.initialize();
        await this.loadState();
    }

    private createInitialSystem(): TestingSystem {
        return {
            orchestrator: {
                testRunner: {
                    queue: {
                        pending: [],
                        running: [],
                        completed: [],
                        failed: []
                    },
                    concurrency: {
                        maxParallel: 1,
                        perBrowser: 1
                    },
                    execution: {
                        timeouts: {
                            visual: 30000,
                            automation: 60000,
                            total: 300000
                        },
                        retries: {
                            count: 3,
                            backoff: "exponential"
                        }
                    }
                },
                state: {
                    current: {
                        phase: "setup",
                        test: null,
                        screenshots: [],
                        results: []
                    },
                    history: {
                        tests: [],
                        analytics: {
                            totalRuns: 0,
                            passRate: 0,
                            averageDuration: 0,
                            commonIssues: []
                        }
                    }
                }
            }
        };
    }

    async loadState(): Promise<void> {
        try {
            const data = await fs.readFile(this.stateFilePath, 'utf-8');
            this.system = JSON.parse(data);
        } catch (error) {
            console.log('No existing state found, using initial state');
            await this.saveState();
        }
    }

    async saveState(): Promise<void> {
        const stateDir = path.dirname(this.stateFilePath);
        await fs.mkdir(stateDir, { recursive: true });
        await fs.writeFile(this.stateFilePath, JSON.stringify(this.system, null, 2));
    }

    async queueTest(test: Test): Promise<void> {
        this.system.orchestrator.testRunner.queue.pending.push(test);
        await this.saveState();
        await this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.system.orchestrator.state.current.phase !== "setup") {
            return; // Already processing
        }

        const nextTest = this.system.orchestrator.testRunner.queue.pending.shift();
        if (!nextTest) {
            return;
        }

        this.system.orchestrator.state.current.phase = "running";
        this.system.orchestrator.state.current.test = nextTest;
        this.system.orchestrator.testRunner.queue.running.push(nextTest);

        await this.saveState();
        await this.runTest(nextTest);
    }

    async runTest(test: Test): Promise<TestResult> {
        console.log(`Running test: ${test.name}`);
        const startTime = Date.now();
        const result: TestResult = {
            id: uuidv4(),
            testId: test.id,
            timestamp: Date.now(),
            duration: 0,
            status: 'error',
            visualAnalysis: {
                observations: [
                    'Placeholder observation: Layout appears to follow design guidelines',
                    'Placeholder observation: Text contrast meets WCAG standards'
                ],
                issues: [],
                metrics: {
                    accessibility: 90,
                    designConsistency: 85,
                    layoutAccuracy: 95
                }
            },
            automationResults: {
                steps: [],
                metrics: {
                    performance: {
                        fcp: 0,
                        lcp: 0,
                        cls: 0
                    },
                    console: {
                        errors: [],
                        warnings: []
                    },
                    network: {
                        requests: 0,
                        failures: 0,
                        timing: {
                            dns: 0,
                            tcp: 0,
                            ttfb: 0
                        }
                    }
                }
            }
        };

        try {
            // Execute each automation step
            for (const step of test.automation.steps) {
                const stepStartTime = Date.now();
                try {
                    await this.automation.executeStep(step, test.target.url);
                    result.automationResults.steps.push({
                        status: 'pass',
                        action: step.action,
                        duration: Date.now() - stepStartTime
                    });
                } catch (error) {
                    const stepResult = {
                        status: 'fail' as const,
                        action: step.action,
                        duration: Date.now() - stepStartTime,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                    result.automationResults.steps.push(stepResult);
                    throw new Error(`Step failed: ${stepResult.error}`);
                }
            }

            // Collect performance metrics if requested
            if (test.automation.assertions.performance) {
                const metrics = await this.automation.collectMetrics(test.target.url);
                result.automationResults.metrics = metrics;
            }

            result.status = 'pass';
        } catch (error) {
            console.error('Test failed:', error);
            result.status = 'fail';
        } finally {
            result.duration = Date.now() - startTime;
            this.updateAnalytics(result);
        }

        return result;
    }

    private updateAnalytics(result: TestResult): void {
        const analytics = this.system.orchestrator.state.history.analytics;
        analytics.totalRuns++;
        
        const totalPassed = this.system.orchestrator.testRunner.queue.completed.length;
        analytics.passRate = (totalPassed / analytics.totalRuns) * 100;
        
        const totalDuration = this.system.orchestrator.state.current.results
            .reduce((sum, r) => sum + r.duration, 0);
        analytics.averageDuration = totalDuration / analytics.totalRuns;

        // Update common issues
        if (result.visualAnalysis.issues.length > 0) {
            for (const issue of result.visualAnalysis.issues) {
                const existingIssue = analytics.commonIssues.find(i => i.type === issue.description);
                if (existingIssue) {
                    existingIssue.count++;
                } else {
                    analytics.commonIssues.push({
                        type: issue.description,
                        count: 1
                    });
                }
            }
        }
    }

    async getSystemState(): Promise<TestingSystem> {
        return this.system;
    }

    async addScreenshot(screenshot: Screenshot): Promise<void> {
        this.system.orchestrator.state.current.screenshots.push(screenshot);
        await this.saveState();
    }

    async broadcastMessage(message: SystemMessage): Promise<void> {
        // In a real implementation, this would handle message passing between components
        console.log('Broadcasting message:', message);
    }

    async cleanup(): Promise<void> {
        await this.automation.cleanup();
        await this.visualAnalysis.cleanup();
    }
} 