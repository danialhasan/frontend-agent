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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAutomation = void 0;
const playwright_1 = require("playwright");
class BrowserAutomation {
    constructor() {
        this.browser = null;
        this.browserType = 'chromium';
    }
    initialize() {
        return __awaiter(this, arguments, void 0, function* (browserType = 'chromium') {
            this.browserType = browserType;
            switch (browserType) {
                case 'chromium':
                    this.browser = yield playwright_1.chromium.launch();
                    break;
                case 'firefox':
                    this.browser = yield playwright_1.firefox.launch();
                    break;
                case 'webkit':
                    this.browser = yield playwright_1.webkit.launch();
                    break;
            }
        });
    }
    executeStep(step) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                throw new Error('Browser not initialized');
            }
            const startTime = Date.now();
            try {
                const context = yield this.browser.newContext();
                const page = yield context.newPage();
                switch (step.action) {
                    case 'click':
                        if (!step.target)
                            throw new Error('Target required for click action');
                        yield page.click(step.target);
                        break;
                    case 'type':
                        if (!step.target || !step.value)
                            throw new Error('Target and value required for type action');
                        yield page.fill(step.target, step.value);
                        break;
                    case 'hover':
                        if (!step.target)
                            throw new Error('Target required for hover action');
                        yield page.hover(step.target);
                        break;
                    case 'scroll':
                        if (!step.target)
                            throw new Error('Target required for scroll action');
                        yield page.evaluate((selector) => {
                            var _a;
                            (_a = document.querySelector(selector)) === null || _a === void 0 ? void 0 : _a.scrollIntoView();
                        }, step.target);
                        break;
                    case 'wait':
                        yield page.waitForTimeout(step.timeout || 1000);
                        break;
                }
                yield context.close();
                return {
                    status: 'pass',
                    action: step.action,
                    duration: Date.now() - startTime
                };
            }
            catch (error) {
                return {
                    status: 'fail',
                    action: step.action,
                    duration: Date.now() - startTime,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
    captureScreenshot(url, selector) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                throw new Error('Browser not initialized');
            }
            const context = yield this.browser.newContext();
            const page = yield context.newPage();
            yield page.goto(url);
            if (selector) {
                yield page.waitForSelector(selector);
            }
            const screenshot = yield (selector ?
                page.locator(selector).screenshot() :
                page.screenshot());
            yield context.close();
            return screenshot.toString('base64');
        });
    }
    collectMetrics(url) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                throw new Error('Browser not initialized');
            }
            const context = yield this.browser.newContext();
            const page = yield context.newPage();
            const client = yield context.newCDPSession(page);
            yield client.send('Performance.enable');
            const metrics = {
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
            };
            // Collect console logs
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    metrics.console.errors.push(msg.text());
                }
                else if (msg.type() === 'warning') {
                    metrics.console.warnings.push(msg.text());
                }
            });
            // Collect network metrics
            let requestCount = 0;
            let failureCount = 0;
            page.on('request', () => requestCount++);
            page.on('requestfailed', () => failureCount++);
            yield page.goto(url);
            // Collect performance metrics
            const performanceMetrics = yield client.send('Performance.getMetrics');
            const fcpMetric = performanceMetrics.metrics.find(m => m.name === 'FirstContentfulPaint');
            const lcpMetric = yield page.evaluate(() => {
                return new Promise(resolve => {
                    new PerformanceObserver((list) => {
                        var _a;
                        const entries = list.getEntries();
                        resolve(((_a = entries[entries.length - 1]) === null || _a === void 0 ? void 0 : _a.startTime) || 0);
                    }).observe({ entryTypes: ['largest-contentful-paint'] });
                });
            });
            const clsMetric = yield page.evaluate(() => {
                return new Promise(resolve => {
                    let clsValue = 0;
                    new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (!entry.hadRecentInput) {
                                clsValue += entry.value;
                            }
                        }
                        resolve(clsValue);
                    }).observe({ entryTypes: ['layout-shift'] });
                });
            });
            metrics.performance.fcp = (fcpMetric === null || fcpMetric === void 0 ? void 0 : fcpMetric.value) || 0;
            metrics.performance.lcp = lcpMetric;
            metrics.performance.cls = clsMetric;
            metrics.network.requests = requestCount;
            metrics.network.failures = failureCount;
            yield context.close();
            return metrics;
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser) {
                yield this.browser.close();
                this.browser = null;
            }
        });
    }
}
exports.BrowserAutomation = BrowserAutomation;
