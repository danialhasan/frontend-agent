import { Browser, chromium, firefox, webkit, Page } from 'playwright';
import { AutomationStep, PerformanceMetrics, StepResult } from '../types';

interface LayoutShiftEntry extends PerformanceEntry {
    hadRecentInput: boolean;
    value: number;
}

export class BrowserAutomation {
    private browser: Browser | null = null;
    private browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium';

    async initialize(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium') {
        this.browserType = browserType;
        
        switch (browserType) {
            case 'chromium':
                this.browser = await chromium.launch();
                break;
            case 'firefox':
                this.browser = await firefox.launch();
                break;
            case 'webkit':
                this.browser = await webkit.launch();
                break;
        }
    }

    async executeStep(step: AutomationStep, url: string): Promise<void> {
        if (!this.browser) {
            await this.initialize();
        }

        const page = await this.browser!.newPage();
        
        try {
            // Enhanced navigation with retry logic
            let navigationSuccess = false;
            for (let attempt = 0; attempt < 3 && !navigationSuccess; attempt++) {
                try {
                    await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(3000); // Wait for dynamic content
                    navigationSuccess = true;
                } catch (err) {
                    console.log(`Navigation attempt ${attempt + 1} failed, retrying...`);
                    if (attempt === 2) throw err;
                }
            }

            // Execute the step with enhanced waiting and retry logic
            switch (step.action) {
                case 'click': {
                    if (!step.target) throw new Error('Target selector is required for click action');
                    const selector = step.target;
                    await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
                    await page.waitForTimeout(1000); // Additional wait for stability
                    await page.click(selector);
                    await page.waitForTimeout(2000); // Wait for any post-click changes
                    break;
                }
                case 'type': {
                    if (!step.target) throw new Error('Target selector is required for type action');
                    if (!step.value) throw new Error('Value is required for type action');
                    const selector = step.target;
                    await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
                    await page.waitForTimeout(1000); // Additional wait for stability
                    
                    // Clear the field first
                    await page.click(selector, { clickCount: 3 }); // Triple click to select all
                    await page.keyboard.press('Backspace');
                    
                    // Type the value with a small delay between characters
                    for (const char of step.value) {
                        await page.type(selector, char, { delay: 100 });
                    }
                    await page.waitForTimeout(1000); // Wait after typing
                    break;
                }
                case 'wait': {
                    const timeout = step.timeout ?? 1000; // Default to 1 second if not specified
                    await page.waitForTimeout(timeout);
                    break;
                }
                // ... existing code for other actions ...
            }
        } catch (error) {
            console.error(`Step failed: ${step.action}`, error);
            throw error;
        } finally {
            await page.close();
        }
    }

    async captureScreenshot(url: string, selector?: string): Promise<string> {
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        const context = await this.browser.newContext();
        const page = await context.newPage();

        await page.goto(url);

        if (selector) {
            await page.waitForSelector(selector);
        }

        const screenshot = await (selector ? 
            page.locator(selector).screenshot() :
            page.screenshot());

        await context.close();

        return screenshot.toString('base64');
    }

    async collectMetrics(url: string): Promise<PerformanceMetrics> {
        console.log('Collecting performance metrics with timeout');
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }

        let page: Page | undefined;
        try {
            page = await this.browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            // Set a timeout for metrics collection
            const metricsPromise = Promise.race([
                this._collectMetricsInternal(page),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Metrics collection timeout')), 10000)
                )
            ]);

            const metrics = await metricsPromise;
            return metrics;
        } catch (error: unknown) {
            console.error('Error collecting metrics:', error);
            // Return default metrics on failure
            return {
                performance: {
                    fcp: 0,
                    lcp: 0,
                    cls: 0
                },
                console: {
                    errors: [`Metrics collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                    warnings: []
                },
                network: {
                    requests: 0,
                    failures: 1,
                    timing: {
                        dns: 0,
                        tcp: 0,
                        ttfb: 0
                    }
                }
            };
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    private async _collectMetricsInternal(page: Page): Promise<PerformanceMetrics> {
        // Get performance metrics
        const fcpMetric = await page.evaluate(() => {
            const entries = performance.getEntriesByName('first-contentful-paint');
            return entries.length > 0 ? entries[0].startTime : 0;
        });

        const lcpMetric = await page.evaluate(() => {
            const entries = performance.getEntriesByName('largest-contentful-paint');
            return entries.length > 0 ? entries[0].startTime : 0;
        });

        const clsMetric = await page.evaluate(() => {
            let cls = 0;
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries() as LayoutShiftEntry[]) {
                    if (!entry.hadRecentInput) {
                        cls += entry.value;
                    }
                }
            }).observe({ type: 'layout-shift', buffered: true });
            return cls;
        });

        // Get console logs
        const consoleMessages = {
            errors: [] as string[],
            warnings: [] as string[]
        };

        page.on('console', (msg: { type: () => string; text: () => string }) => {
            if (msg.type() === 'error') {
                consoleMessages.errors.push(msg.text());
            } else if (msg.type() === 'warning') {
                consoleMessages.warnings.push(msg.text());
            }
        });

        // Get network metrics
        const networkMetrics = {
            requests: 0,
            failures: 0,
            timing: {
                dns: 0,
                tcp: 0,
                ttfb: 0
            }
        };

        // Use Playwright's request event instead of CDP
        page.on('request', () => networkMetrics.requests++);
        page.on('requestfailed', () => networkMetrics.failures++);

        const timing = await page.evaluate(() => {
            const t = performance.timing || { 
                domainLookupEnd: 0, 
                domainLookupStart: 0,
                connectEnd: 0,
                connectStart: 0,
                responseStart: 0,
                requestStart: 0
            };
            return {
                dns: t.domainLookupEnd - t.domainLookupStart,
                tcp: t.connectEnd - t.connectStart,
                ttfb: t.responseStart - t.requestStart
            };
        });

        networkMetrics.timing = timing;

        return {
            performance: {
                fcp: fcpMetric,
                lcp: lcpMetric,
                cls: clsMetric
            },
            console: consoleMessages,
            network: networkMetrics
        };
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
} 