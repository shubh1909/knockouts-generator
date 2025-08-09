import PDFParser from "pdf2json";

import { createKnockoutFixture } from "../services/tournamentService.js";
import { createTournamentPDF } from "../services/pdfService.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TournamentController {
  // Create tournament and return PDF in one call
  async createTournamentWithPDF(req, res) {
    try {
      const {
        participants,
        name,
        returnType = "download",
        pdfTitle,
      } = req.body;

      if (
        !participants ||
        !Array.isArray(participants) ||
        participants.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message: "At least 2 participants are required",
        });
      }

      // Validate participants structure
      const validParticipants = participants.map((participant, index) => {
        if (typeof participant === "string") {
          return { id: index + 1, name: participant };
        } else if (participant.name) {
          return { id: participant.id || index + 1, name: participant.name };
        } else {
          throw new Error("Invalid participant format");
        }
      });

      // Create tournament
      const tournament = createKnockoutFixture(validParticipants);
      if (name) {
        tournament.name = name;
      }

      // Generate PDF
      const pdfResult = await createTournamentPDF(tournament, null, pdfTitle);

      // Return based on requested type
      if (returnType === "download") {
        // Stream the PDF directly to the response
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${pdfResult.fileName}"`
        );
        res.sendFile(path.resolve(pdfResult.filePath));
      } else if (returnType === "json") {
        // Return JSON response with tournament data and PDF info
        res.status(201).json({
          success: true,
          message: "Tournament created and PDF generated successfully",
          data: {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              status: tournament.status,
              rounds: tournament.rounds,
              currentRound: tournament.currentRound,
              participantCount: tournament.participants.length,
              createdAt: tournament.createdAt,
              bracket: tournament.bracket,
            },
            pdf: {
              fileName: pdfResult.fileName,
              filePath: pdfResult.filePath,
              message: pdfResult.message,
            },
          },
        });
      } else {
        // Return PDF info for separate download
        res.status(201).json({
          success: true,
          message: "Tournament created and PDF generated successfully",
          data: {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              status: tournament.status,
              rounds: tournament.rounds,
              currentRound: tournament.currentRound,
              participantCount: tournament.participants.length,
              createdAt: tournament.createdAt,
            },
            pdf: {
              fileName: pdfResult.fileName,
              filePath: pdfResult.filePath,
            },
          },
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Quick PDF download without storing tournament
  async createAndDownloadPDF(req, res) {
    try {
      const { participants, name, pdfTitle } = req.body;

      if (
        !participants ||
        !Array.isArray(participants) ||
        participants.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message: "At least 2 participants are required",
        });
      }

      // Validate participants structure
      const validParticipants = participants.map((participant, index) => {
        if (typeof participant === "string") {
          return { id: index + 1, name: participant };
        } else if (participant.name) {
          return { id: participant.id || index + 1, name: participant.name };
        } else {
          throw new Error("Invalid participant format");
        }
      });

      // Create tournament (temporary, not stored)
      const tournament = createKnockoutFixture(validParticipants);
      if (name) {
        tournament.name = name;
      }

      // Generate PDF
      const pdfResult = await createTournamentPDF(tournament, null, pdfTitle);

      // Stream the PDF directly to the response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${pdfResult.fileName}"`
      );
      res.sendFile(path.resolve(pdfResult.filePath));
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async pdfToJson(req, res) {
    try {
      // Assuming file is uploaded via multer and available as req.file.path
      const pdfPath = req.file?.path;
      if (!pdfPath) {
        console.error("No PDF file uploaded.");
        return res
          .status(400)
          .json({ success: false, message: "No PDF file uploaded." });
      }

      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => {
        console.error("PDF parsing error:", errData.parserError);
        return res.status(500).json({
          success: false,
          message: "PDF parsing error",
          error: errData.parserError,
        });
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        console.log("PDF parsed successfully.");
        try {
          // Extract matches from pdfData
          const page = pdfData?.Pages?.[0];
          const texts = page?.Texts || [];
          const decode = (t) => decodeURIComponent(t);
          // Find all match IDs and their positions
          const matchTexts = texts.filter((txt) =>
            txt.R[0].T.match(/^R\d+M\d+$/)
          );
          // Find all team names (exclude match IDs and round headers)
          const teamTexts = texts.filter((txt) => {
            const t = txt.R[0].T;
            return (
              !t.match(/^R\d+M\d+$/) &&
              !t.match(/Round|Final|Semi-Final|Quarter-Final|Status|Champions/)
            );
          });
          teamTexts.sort((a, b) => a.y - b.y);
          // Group matches by round
          const rounds = {};
          for (let i = 0; i < matchTexts.length; i++) {
            const matchId = decode(matchTexts[i].R[0].T);
            const roundMatch = matchId.match(/^R(\d+)M(\d+)$/);
            const roundNum = roundMatch ? parseInt(roundMatch[1]) : 1;
            // Find two closest teams above this matchId (by y position)
            const teams = teamTexts
              .filter((t) => t.y < matchTexts[i].y)
              .slice(-2)
              .map((t) => decode(t.R[0].T));
            if (!rounds[roundNum]) rounds[roundNum] = [];
            rounds[roundNum].push({ matchId, teams });
          }
          return res.json({ success: true, rounds });
        } catch (parseErr) {
          console.error("Error parsing PDF to JSON:", parseErr);
          return res.status(500).json({
            success: false,
            message: "Error parsing PDF to JSON",
            error: parseErr.message,
          });
        }
      });

      try {
        pdfParser.loadPDF(pdfPath);
      } catch (loadErr) {
        console.error("Error loading PDF:", loadErr);
        return res.status(500).json({
          success: false,
          message: "Error loading PDF",
          error: loadErr.message,
        });
      }
    } catch (err) {
      console.error("Server error in pdfToJson:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error", error: err.message });
    }
  }
}

export default new TournamentController();
