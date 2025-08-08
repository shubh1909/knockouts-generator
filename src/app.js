import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Import routes
import tournamentRoutes from "./routes/tournaments.js";

// Import middleware
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    credentials: true,
  })
);

// Logging middleware
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files (for serving generated PDFs, favicon, and app.js)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "..", "public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Knockout Tournament API is running",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Knockout Tournament API - Simplified Version",
    version: "2.0.0",
    description:
      "Streamlined API with only essential tournament creation and PDF generation endpoints",
    endpoints: {
      tournaments: {
        "POST /api/tournaments/create-with-pdf":
          "Create tournament and get PDF in one call",
        "POST /api/tournaments/quick-pdf":
          "Create fixture and download PDF immediately",
      },
    },
    examples: {
      createWithPDF: {
        method: "POST",
        url: "/api/tournaments/create-with-pdf",
        body: {
          name: "Champions League",
          participants: [
            "Real Madrid",
            "Barcelona",
            "Manchester City",
            "Bayern Munich",
          ],
          returnType: "download",
        },
        description:
          "Creates tournament and returns PDF. Options: 'download' (default), 'json', 'url'",
      },
      quickPDF: {
        method: "POST",
        url: "/api/tournaments/quick-pdf",
        body: {
          name: "Quick Tournament",
          participants: ["Team A", "Team B", "Team C", "Team D"],
        },
        description:
          "Creates fixture and downloads PDF without storing tournament",
      },
    },
    features: [
      "✅ Create tournament fixtures from participant arrays",
      "✅ Generate PDF brackets automatically",
      "✅ Download PDFs immediately",
      "✅ Support for 2-128 participants",
      "✅ Automatic bye handling",
      "✅ ES6 modules",
      "✅ Input validation",
      "✅ Error handling",
    ],
  });
});

// Serve the test UI on root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "test-ui-v2.html"));
});

// API Routes
app.use("/api/tournaments", tournamentRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
🚀 Knockout Tournament API v2.0 Started!
📊 Server running on port ${PORT}
🌐 Environment: ${process.env.NODE_ENV || "development"}
📖 API Documentation: http://localhost:${PORT}/api
❤️  Health Check: http://localhost:${PORT}/health

🎯 Simplified API with 2 main endpoints:
• POST   /api/tournaments/create-with-pdf    - Create tournament + PDF
• POST   /api/tournaments/quick-pdf          - Quick PDF download

  `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

export default app;
