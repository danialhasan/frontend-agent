import express from 'express';
import { TestOrchestrator } from './orchestrator';
import { Test, SystemMessage, Screenshot } from './types';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 3001;

// Initialize the test orchestrator
const orchestrator = new TestOrchestrator();

// Middleware
app.use(express.json({ limit: '50mb' }));

// Initialize orchestrator and handle cleanup
orchestrator.initialize().catch(console.error);

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Cleaning up...');
    await orchestrator.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT. Cleaning up...');
    await orchestrator.cleanup();
    process.exit(0);
});

// Validate test data against our spec
function validateTest(data: any): data is Omit<Test, 'id'> {
    if (!data.name || typeof data.name !== 'string') return false;
    if (!data.description || typeof data.description !== 'string') return false;
    if (!data.target?.url || typeof data.target.url !== 'string') return false;
    
    // Validate visual requirements
    if (!data.visual || typeof data.visual !== 'object') return false;
    if (!data.visual.instructions || typeof data.visual.instructions !== 'string') return false;
    if (!data.visual.expectations || typeof data.visual.expectations !== 'object') return false;
    if (!Array.isArray(data.visual.expectations.layout)) return false;
    if (!Array.isArray(data.visual.expectations.design)) return false;
    if (!Array.isArray(data.visual.expectations.accessibility)) return false;
    
    // Validate automation steps
    if (!data.automation || typeof data.automation !== 'object') return false;
    if (!Array.isArray(data.automation.steps)) return false;
    if (!data.automation.assertions || typeof data.automation.assertions !== 'object') return false;
    
    return true;
}

// Routes
app.post('/test', async (req, res) => {
    try {
        if (!validateTest(req.body)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid test data format. Please check the specification.' 
            });
        }

        const test: Test = {
            id: uuidv4(),
            name: req.body.name,
            description: req.body.description,
            target: {
                url: req.body.target.url,
                baseUrl: req.body.target.baseUrl
            },
            visual: {
                instructions: req.body.visual.instructions,
                expectations: {
                    layout: req.body.visual.expectations.layout,
                    design: req.body.visual.expectations.design,
                    accessibility: req.body.visual.expectations.accessibility
                },
                screenshots: {
                    baseline: req.body.visual.screenshots?.baseline || '',
                    tolerance: req.body.visual.screenshots?.tolerance || 0.1
                }
            },
            automation: {
                steps: req.body.automation.steps.map((step: any) => ({
                    action: step.action,
                    target: step.target,
                    value: step.value,
                    timeout: step.timeout
                })),
                assertions: {
                    visual: !!req.body.automation.assertions.visual,
                    functional: !!req.body.automation.assertions.functional,
                    performance: !!req.body.automation.assertions.performance
                }
            }
        };

        console.log(`Queueing test: ${test.name} (${test.id})`);
        await orchestrator.queueTest(test);
        res.json({ success: true, testId: test.id });
    } catch (error) {
        console.error('Error queueing test:', error);
        res.status(500).json({ success: false, error: 'Failed to queue test' });
    }
});

app.get('/state', async (req, res) => {
    try {
        const state = await orchestrator.getSystemState();
        res.json(state);
    } catch (error) {
        console.error('Error getting state:', error);
        res.status(500).json({ success: false, error: 'Failed to get state' });
    }
});

app.post('/screenshot', async (req, res) => {
    try {
        const screenshot: Screenshot = {
            id: uuidv4(),
            ...req.body
        };
        await orchestrator.addScreenshot(screenshot);
        res.json({ success: true, screenshotId: screenshot.id });
    } catch (error) {
        console.error('Error adding screenshot:', error);
        res.status(500).json({ success: false, error: 'Failed to add screenshot' });
    }
});

app.post('/message', async (req, res) => {
    try {
        const message: SystemMessage = {
            id: uuidv4(),
            timestamp: Date.now(),
            ...req.body
        };
        await orchestrator.broadcastMessage(message);
        res.json({ success: true, messageId: message.id });
    } catch (error) {
        console.error('Error broadcasting message:', error);
        res.status(500).json({ success: false, error: 'Failed to broadcast message' });
    }
});

app.listen(port, () => {
    console.log(`Testing system server running at http://localhost:${port}`);
}); 