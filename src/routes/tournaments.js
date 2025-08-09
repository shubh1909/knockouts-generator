import express from "express";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import tournamentController from "../controllers/tournamentController.js";
import { validate, tournamentValidation } from "../middleware/validation.js";

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF files are allowed!"));
  },
});

const router = express.Router();

// Routes

// Convert PDF to JSON
router.post(
  "/pdf-to-json",
  upload.single("pdf"),
  tournamentController.pdfToJson
);

// Create tournament and generate PDF
router.post(
  "/create-with-pdf",
  validate(tournamentValidation.createTournamentWithPDF),
  tournamentController.createTournamentWithPDF
);

// Quick PDF download (no storage)
router.post(
  "/quick-pdf",
  validate(tournamentValidation.quickPDF),
  tournamentController.createAndDownloadPDF
);

export default router;
