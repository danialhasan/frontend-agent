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
const express_1 = __importDefault(require("express"));
const orchestrator_1 = require("./orchestrator");
const uuid_1 = require("uuid");
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Initialize the test orchestrator
const orchestrator = new orchestrator_1.TestOrchestrator();
// Middleware
app.use(express_1.default.json({ limit: '50mb' }));
// Initialize orchestrator and handle cleanup
orchestrator.initialize().catch(console.error);
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Received SIGTERM. Cleaning up...');
    yield orchestrator.cleanup();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Received SIGINT. Cleaning up...');
    yield orchestrator.cleanup();
    process.exit(0);
}));
// Routes
app.post('/test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const test = Object.assign({ id: (0, uuid_1.v4)() }, req.body);
        yield orchestrator.queueTest(test);
        res.json({ success: true, testId: test.id });
    }
    catch (error) {
        console.error('Error queueing test:', error);
        res.status(500).json({ success: false, error: 'Failed to queue test' });
    }
}));
app.get('/state', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const state = yield orchestrator.getSystemState();
        res.json(state);
    }
    catch (error) {
        console.error('Error getting state:', error);
        res.status(500).json({ success: false, error: 'Failed to get state' });
    }
}));
app.post('/screenshot', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const screenshot = Object.assign(Object.assign({ id: (0, uuid_1.v4)() }, req.body), { timestamp: Date.now() });
        yield orchestrator.addScreenshot(screenshot);
        res.json({ success: true, screenshotId: screenshot.id });
    }
    catch (error) {
        console.error('Error adding screenshot:', error);
        res.status(500).json({ success: false, error: 'Failed to add screenshot' });
    }
}));
app.post('/message', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const message = Object.assign({ id: (0, uuid_1.v4)(), timestamp: Date.now() }, req.body);
        yield orchestrator.broadcastMessage(message);
        res.json({ success: true, messageId: message.id });
    }
    catch (error) {
        console.error('Error broadcasting message:', error);
        res.status(500).json({ success: false, error: 'Failed to broadcast message' });
    }
}));
// Start server
app.listen(port, () => {
    console.log(`Testing system server running at http://localhost:${port}`);
});
