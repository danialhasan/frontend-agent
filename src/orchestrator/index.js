"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestOrchestrator = void 0;
const automation_1 = require("../services/automation");
const visual_1 = require("../services/visual");
const uuid_1 = require("uuid");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class TestOrchestrator {
    constructor(stateFilePath = './test-state.json') {
        this.stateFilePath = stateFilePath;
        this.system = this.createInitialSystem();
        this.automation = new automation_1.BrowserAutomation();
        this.visualAnalysis = new visual_1.VisualAnalysis();
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.automation.initialize();
            yield this.visualAnalysis.initialize();
            yield this.loadState();
        });
    }
    createInitialSystem() {
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
    loadState() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield promises_1.default.readFile(this.stateFilePath, 'utf-8');
                this.system = JSON.parse(data);
            }
            catch (error) {
                console.log('No existing state found, using initial state');
                yield this.saveState();
            }
        });
    }
    saveState() {
        return __awaiter(this, void 0, void 0, function* () {
            const stateDir = path_1.default.dirname(this.stateFilePath);
            yield promises_1.default.mkdir(stateDir, { recursive: true });
            yield promises_1.default.writeFile(this.stateFilePath, JSON.stringify(this.system, null, 2));
        });
    }
    queueTest(test) {
        return __awaiter(this, void 0, void 0, function* () {
            this.system.orchestrator.testRunner.queue.pending.push(test);
            yield this.saveState();
            yield this.processQueue();
        });
    }
    processQueue() {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield this.saveState();
            yield this.runTest(nextTest);
        });
    }
    runTest(test) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const result = {
                id: (0, uuid_1.v4)(),
                testId: test.id,
                timestamp: startTime,
                duration: 0,
                status: "running",
                visualAnalysis: {
                    observations: [],
                    issues: [],
                    metrics: {
                        accessibility: 0,
                        designConsistency: 0,
                        layoutAccuracy: 0
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
                // Execute test steps
                for (const step of test.automation.steps) {
                    const stepResult = yield this.automation.executeStep(step);
                    result.automationResults.steps.push(stepResult);
                    if (stepResult.status === "fail") {
                        throw new Error(`Step failed: ${stepResult.error}`);
                    }
                    // Capture screenshot after each step if visual analysis is required
                    if (test.visual && test.automation.assertions.visual) {
                        const screenshot = yield this.automation.captureScreenshot("http://example.com", // TODO: Get actual URL from test config
                        step.target);
                        const screenshotPath = yield this.visualAnalysis.saveScreenshot(screenshot, test.id);
                        const analysis = yield this.visualAnalysis.analyzeScreenshot(screenshotPath, test.visual.instructions, test.visual.expectations);
                        result.visualAnalysis = analysis;
                    }
                }
                // Collect performance metrics if required
                if (test.automation.assertions.performance) {
                    result.automationResults.metrics = yield this.automation.collectMetrics("http://example.com" // TODO: Get actual URL from test config
                    );
                }
                result.status = "pass";
            }
            catch (error) {
                result.status = "fail";
                console.error(`Test ${test.id} failed:`, error);
            }
            finally {
                result.duration = Date.now() - startTime;
                this.system.orchestrator.state.current.results.push(result);
                // Move test to appropriate queue
                const runningIndex = this.system.orchestrator.testRunner.queue.running
                    .findIndex(t => t.id === test.id);
                if (runningIndex !== -1) {
                    this.system.orchestrator.testRunner.queue.running.splice(runningIndex, 1);
                }
                if (result.status === "pass") {
                    this.system.orchestrator.testRunner.queue.completed.push(test);
                }
                else {
                    this.system.orchestrator.testRunner.queue.failed.push(test);
                }
                // Update analytics
                this.updateAnalytics(result);
                // Reset current state
                this.system.orchestrator.state.current.phase = "setup";
                this.system.orchestrator.state.current.test = null;
                yield this.saveState();
                yield this.processQueue(); // Process next test if any
            }
        });
    }
    updateAnalytics(result) {
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
                }
                else {
                    analytics.commonIssues.push({
                        type: issue.description,
                        count: 1
                    });
                }
            }
        }
    }
    getSystemState() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.system;
        });
    }
    addScreenshot(screenshot) {
        return __awaiter(this, void 0, void 0, function* () {
            this.system.orchestrator.state.current.screenshots.push(screenshot);
            yield this.saveState();
        });
    }
    broadcastMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            // In a real implementation, this would handle message passing between components
            console.log('Broadcasting message:', message);
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.automation.cleanup();
            yield this.visualAnalysis.cleanup();
        });
    }
}
exports.TestOrchestrator = TestOrchestrator;
