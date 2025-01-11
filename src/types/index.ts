export interface TestingSystem {
    orchestrator: {
        testRunner: {
            queue: {
                pending: Test[];
                running: Test[];
                completed: Test[];
                failed: Test[];
            };
            concurrency: {
                maxParallel: number;
                perBrowser: number;
            };
            execution: {
                timeouts: {
                    visual: number;
                    automation: number;
                    total: number;
                };
                retries: {
                    count: number;
                    backoff: "linear" | "exponential";
                };
            };
        };
        state: {
            current: {
                phase: "setup" | "running" | "analysis" | "cleanup";
                test: Test | null;
                screenshots: Screenshot[];
                results: TestResult[];
            };
            history: {
                tests: TestHistory[];
                analytics: TestAnalytics;
            };
        };
    };
}

export interface Test {
    id: string;
    name: string;
    description: string;
    target: {
        url: string;
        baseUrl?: string;
    };
    visual: {
        instructions: string;
        expectations: {
            layout: string[];
            design: string[];
            accessibility: string[];
        };
        screenshots: {
            baseline: string;
            tolerance: number;
        };
    };
    automation: {
        steps: AutomationStep[];
        assertions: {
            visual: boolean;
            functional: boolean;
            performance: boolean;
        };
    };
}

export interface AutomationStep {
    action: "click" | "type" | "hover" | "scroll" | "wait";
    target?: string;
    value?: string;
    timeout?: number;
}

export interface Screenshot {
    id: string;
    testId: string;
    data: string;
    timestamp: number;
    metadata: {
        viewport: {
            width: number;
            height: number;
        };
        browser: string;
    };
}

export interface TestResult {
    id: string;
    testId: string;
    timestamp: number;
    duration: number;
    status: "pass" | "fail" | "error";
    visualAnalysis: {
        observations: string[];
        issues: VisualIssue[];
        metrics: {
            accessibility: number;
            designConsistency: number;
            layoutAccuracy: number;
        };
    };
    automationResults: {
        steps: StepResult[];
        metrics: PerformanceMetrics;
    };
}

export interface VisualIssue {
    severity: "critical" | "major" | "minor";
    description: string;
    location: {
        selector: string;
        screenshot: string;
        coordinates: {
            x: number;
            y: number;
        };
    };
    recommendation: string;
}

export interface StepResult {
    status: "pass" | "fail";
    action: string;
    duration: number;
    error?: string;
}

export interface PerformanceMetrics {
    performance: {
        fcp: number;
        lcp: number;
        cls: number;
    };
    console: {
        errors: string[];
        warnings: string[];
    };
    network: {
        requests: number;
        failures: number;
        timing: {
            dns: number;
            tcp: number;
            ttfb: number;
        };
    };
}

export interface TestHistory {
    testId: string;
    runs: {
        timestamp: number;
        result: TestResult;
    }[];
}

export interface TestAnalytics {
    totalRuns: number;
    passRate: number;
    averageDuration: number;
    commonIssues: {
        type: string;
        count: number;
    }[];
}

export interface SystemMessage {
    id: string;
    timestamp: number;
    type: MessageType;
    payload: any;
    metadata: {
        source: "claude" | "automation" | "orchestrator";
        priority: "high" | "normal" | "low";
        correlationId: string;
    };
}

export type MessageType =
    | "TEST_START"
    | "VISUAL_ANALYSIS_REQUEST"
    | "VISUAL_ANALYSIS_RESULT"
    | "AUTOMATION_COMMAND"
    | "AUTOMATION_RESULT"
    | "ERROR"
    | "TEST_COMPLETE"; 