import express from "express";
import tournamentController from "../controllers/tournamentController.js";
import { validate, tournamentValidation } from "../middleware/validation.js";

const router = express.Router();

/**
 * @route   POST /api/tournaments/create-with-pdf
 * @desc    Create tournament and generate PDF in one call
 * @access  Public
 */
router.post(
  "/create-with-pdf",
  validate(tournamentValidation.createTournamentWithPDF),
  tournamentController.createTournamentWithPDF
);

/**
 * @route   POST /api/tournaments/quick-pdf
 * @desc    Create tournament fixture and download PDF immediately (no storage)
 * @access  Public
 */
router.post(
  "/quick-pdf",
  validate(tournamentValidation.quickPDF),
  tournamentController.createAndDownloadPDF
);

export default router;
