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
}

export default new TournamentController();
