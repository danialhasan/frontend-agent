# Frontend Testing System Specification v1.0

## Purpose & Problem Statement

This specification outlines a hybrid testing system that combines Claude's advanced visual understanding capabilities with precise browser automation. The system addresses several key challenges in frontend testing:

1. Visual Testing Limitations
   - Traditional automation tools can't truly "understand" UI/UX
   - Pixel-perfect comparison is too rigid
   - Visual bugs often require human judgment

2. Test Maintenance Burden
   - Brittle selectors break tests
   - UI changes require extensive test updates
   - Visual regression tests need constant baseline updates

3. Context Understanding
   - Automation tools can't understand design intent
   - Missing subtle UX issues
   - No understanding of brand guidelines or accessibility

## Solution Overview

We're creating a system that leverages two complementary approaches:

1. Claude's Computer Use API for:
   - Visual analysis and understanding
   - Design consistency checking
   - Accessibility evaluation
   - UX pattern recognition

2. Browser Automation (Playwright) for:
   - Precise interactions
   - Performance measurements
   - Network monitoring
   - Console error tracking

## System Architecture

```typescript
// Core System Definition
interface TestingSystem {
    // Main orchestration layer
    orchestrator: {
        // Manages test execution and coordination
        testRunner: {
            // Queue for managing test execution order
            queue: {
                pending: Test[];
                running: Test[];
                completed: Test[];
                failed: Test[];
            };
            
            // Configuration for parallel execution
            concurrency: {
                maxParallel: number;
                perBrowser: number;
            };
            
            // Test execution settings
            execution: {
                timeouts: {
                    visual: number;    // Time allowed for visual analysis
                    automation: number; // Time for automated actions
                    total: number;     // Overall test timeout
                };
                retries: {
                    count: number;
                    backoff: "linear" | "exponential";
                };
            };
        };

        // State management for test execution
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

// Test Definition Structure
interface Test {
    id: string;
    name: string;
    description: string;
    
    // Visual analysis requirements
    visual: {
        instructions: string;
        expectations: {
            layout: string[];
            design: string[];
            accessibility: string[];
        };
        screenshots: {
            baseline: string;  // Base64 encoded
            tolerance: number;
        };
    };

    // Automated steps
    automation: {
        steps: {
            action: "click" | "type" | "hover" | "scroll" | "wait";
            target?: string;  // CSS selector
            value?: string;   // For input fields
            timeout?: number; // Action-specific timeout
        }[];
        assertions: {
            visual: boolean;
            functional: boolean;
            performance: boolean;
        };
    };
}

// Result Structure
interface TestResult {
    // Basic metadata
    id: string;
    testId: string;
    timestamp: number;
    duration: number;
    status: "pass" | "fail" | "error";

    // Claude's visual analysis
    visualAnalysis: {
        observations: string[];
        issues: {
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
        }[];
        metrics: {
            accessibility: number;  // 0-100
            designConsistency: number;
            layoutAccuracy: number;
        };
    };

    // Automation results
    automationResults: {
        steps: {
            status: "pass" | "fail";
            action: string;
            duration: number;
            error?: string;
        }[];
        metrics: {
            performance: {
                fcp: number;  // First Contentful Paint
                lcp: number;  // Largest Contentful Paint
                cls: number;  // Cumulative Layout Shift
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
        };
    };
}
```

## Communication Protocol

```typescript
// Message passing between components
interface SystemMessage {
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

type MessageType =
    | "TEST_START"
    | "VISUAL_ANALYSIS_REQUEST"
    | "VISUAL_ANALYSIS_RESULT"
    | "AUTOMATION_COMMAND"
    | "AUTOMATION_RESULT"
    | "ERROR"
    | "TEST_COMPLETE";

// Example message flow
const messageFlow = {
    testStart: {
        type: "TEST_START",
        payload: {
            test: Test,
            configuration: TestConfig
        }
    },
    visualAnalysis: {
        request: {
            type: "VISUAL_ANALYSIS_REQUEST",
            payload: {
                screenshot: string,
                instructions: string,
                context: AnalysisContext
            }
        },
        response: {
            type: "VISUAL_ANALYSIS_RESULT",
            payload: {
                observations: string[],
                issues: VisualIssue[],
                recommendations: string[]
            }
        }
    }
};
```

## Implementation Guidelines

1. Visual Analysis Pipeline:
   - Capture baseline screenshots
   - Send to Claude with context
   - Process visual analysis results
   - Compare with automation results

2. Test Execution Flow:
   - Initialize test environment
   - Execute visual analysis
   - Run automated steps
   - Collect and correlate results
   - Generate comprehensive report

3. Error Handling:
   - Retry failed visual analyses
   - Fall back to automation-only if needed
   - Maintain test stability
   - Report detailed error context

4. Performance Considerations:
   - Cache screenshots when possible
   - Optimize Claude API calls
   - Parallel test execution
   - Resource cleanup

## Agent Architecture

This system operates as a specialized Testing Agent that works in conjunction with the Cursor Composer Agent. Here's how the agents interact:

### Testing Agent (This System)
Responsibilities:
- Execute browser automation via Playwright
- Capture and analyze screenshots
- Collect performance metrics
- Maintain test state and history
- Provide standardized test results

Capabilities:
- Browser control and automation
- Visual analysis and comparison
- Performance measurement
- State persistence
- Result aggregation

### Cursor Composer Agent (External)
Responsibilities:
- Code generation and modification
- Test interpretation and decision making
- Issue resolution
- Development orchestration

Capabilities:
- Code understanding and generation
- Multi-file editing
- Development workflow management
- Test result interpretation

### Inter-Agent Communication

The Testing Agent exposes its capabilities through:

1. HTTP API Endpoints:
   - `/test` - Queue and execute tests
   - `/state` - Get current system state
   - `/screenshot` - Submit screenshots for analysis
   - `/message` - System event communication

2. File-Based Communication:
   - Test artifacts (screenshots, logs)
   - State persistence
   - Result reporting

3. Message Protocol:
```typescript
interface AgentMessage {
    id: string;
    timestamp: number;
    type: MessageType;
    payload: any;
    metadata: {
        source: "testing_agent" | "composer_agent";
        priority: "high" | "normal" | "low";
        correlationId: string;
    };
}

type MessageType =
    | "TEST_START"
    | "VISUAL_ANALYSIS_REQUEST"
    | "VISUAL_ANALYSIS_RESULT"
    | "AUTOMATION_COMMAND"
    | "AUTOMATION_RESULT"
    | "ERROR"
    | "TEST_COMPLETE";
```

### Integration Flow

1. Test Initiation:
```typescript
// Composer Agent initiates a test
await fetch('http://localhost:3001/test', {
    method: 'POST',
    body: JSON.stringify({
        name: "Feature Test",
        description: "Testing new feature implementation",
        visual: {
            instructions: "Verify layout and styling",
            expectations: {
                layout: ["Component positioning", "Responsive behavior"],
                design: ["Brand compliance", "Style consistency"],
                accessibility: ["WCAG compliance"]
            }
        },
        automation: {
            steps: [/* test steps */]
        }
    })
});
```

2. Result Processing:
```typescript
// Testing Agent provides results
const testResult = {
    status: "completed",
    visualAnalysis: {
        observations: ["Button misaligned", "Incorrect font"],
        issues: [{
            severity: "major",
            description: "Primary button color doesn't match brand guide",
            location: { /* ... */ }
        }]
    },
    metrics: {
        performance: { /* ... */ },
        accessibility: 85
    }
};

// Composer Agent consumes results for decision making
if (testResult.issues.length > 0) {
    await generateFixes(testResult.issues);
}
```

3. Continuous Monitoring:
```typescript
// Testing Agent broadcasts state changes
websocket.send({
    type: "STATE_UPDATE",
    payload: {
        phase: "running",
        progress: 0.75,
        currentStep: "visual_analysis"
    }
});

// Composer Agent monitors progress
websocket.onmessage = (event) => {
    const update = JSON.parse(event.data);
    updateDevelopmentState(update);
};
```

This architecture enables:
1. Clear separation of concerns between testing and development
2. Standardized communication protocol
3. Independent operation of each agent
4. Flexible integration patterns
5. Scalable test execution
6. Comprehensive result reporting


