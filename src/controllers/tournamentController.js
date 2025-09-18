import PDFParser from "pdf2json";
import { createTournamentPDF } from "../services/pdfService.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TournamentController {
  constructor() {
    this.createTournamentWithPDF = this.createTournamentWithPDF.bind(this);
    this.pdfToJson = this.pdfToJson.bind(this);
  }

  async createTournamentWithPDF(req, res) {
    if (!req || !req.body) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body"
      });
    }
    
    try {
      const {
        participants,
        rounds = [],
        name,
        returnType = "download",
        pdfTitle,
      } = req.body;

      if (!participants || !Array.isArray(participants) || participants.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 participants are required",
        });
      }

      const roundWinners = this.processRoundWinners(participants, rounds);

      const tournament = {
        id: Date.now().toString(),
        name: name || "Tournament",
        status: "in_progress", 
        createdAt: new Date(),
        participants: participants.filter(p => p && p.trim()),
        roundWinners: roundWinners,
        totalRounds: Math.ceil(Math.log2(participants.length))
      };

      const pdfResult = await createTournamentPDF(tournament, null, pdfTitle);

      if (returnType === "download") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${pdfResult.fileName}"`
        );
        res.sendFile(path.resolve(pdfResult.filePath));
      } else if (returnType === "json") {
        res.status(201).json({
          success: true,
          message: "Tournament created and PDF generated successfully",
          data: {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              status: tournament.status,
              roundWinners: tournament.roundWinners,
              totalRounds: tournament.totalRounds,
              participantCount: tournament.participants.length,
              createdAt: tournament.createdAt,
            },
            pdf: {
              fileName: pdfResult.fileName,
              filePath: pdfResult.filePath,
              message: pdfResult.message,
            },
          },
        });
      } else {
        res.status(201).json({
          success: true,
          message: "Tournament created and PDF generated successfully",
          data: {
            tournament: {
              id: tournament.id,
              name: tournament.name,
              status: tournament.status,
              roundWinners: tournament.roundWinners,
              totalRounds: tournament.totalRounds,
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

  processRoundWinners(participants, rounds) {
    const processedRounds = {};
    
    if (Array.isArray(participants) && participants.length > 0) {
      processedRounds[1] = participants
        .filter(team => team && team.trim())
        .map(team => team.trim());
    }
    
    if (Array.isArray(rounds)) {
      for (let i = 0; i < rounds.length; i++) {
        const roundNumber = i + 2; 
        const roundTeams = rounds[i];
        
        if (Array.isArray(roundTeams)) {
          processedRounds[roundNumber] = roundTeams
            .filter(team => team && team.trim())
            .map(team => team.trim());
        } else {
          processedRounds[roundNumber] = [];
        }
      }
    }
    
    return processedRounds;
  }

  async createAndDownloadPDF(req, res) {
    try {
      const { participants, name, pdfTitle } = req.body;

      if (!participants || !Array.isArray(participants) || participants.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 participants are required",
        });
      }

      const validParticipants = participants
        .filter(participant => participant && participant.trim())
        .map(participant => {
          if (typeof participant === "string") {
            return participant.trim();
          } else if (participant && participant.name) {
            return participant.name.trim();
          } else {
            return null;
          }
        })
        .filter(p => p);

      const tournament = {
        id: Date.now().toString(),
        name: name || "Tournament",
        participants: validParticipants,
        roundWinners: { 1: validParticipants },
        totalRounds: Math.ceil(Math.log2(validParticipants.length))
      };

      const pdfResult = await createTournamentPDF(tournament, null, pdfTitle);

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
      const pdfPath = req.file?.path;
      if (!pdfPath) {
        return res.status(400).json({ success: false, message: "No PDF file uploaded." });
      }

      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => {
        return res.status(500).json({
          success: false,
          message: "PDF parsing error",
          error: errData.parserError,
        });
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          const page = pdfData?.Pages?.[0];
          const texts = page?.Texts || [];
          const decode = (t) => decodeURIComponent(t);
          const matchTexts = texts.filter((txt) =>
            txt.R[0].T.match(/^R\d+M\d+$/)
          );
          const teamTexts = texts.filter((txt) => {
            const t = txt.R[0].T;
            return (
              !t.match(/^R\d+M\d+$/) &&
              !t.match(/Round|Final|Semi-Final|Quarter-Final|Status|Champions/)
            );
          });
          teamTexts.sort((a, b) => a.y - b.y);
          const rounds = {};
          for (let i = 0; i < matchTexts.length; i++) {
            const matchId = decode(matchTexts[i].R[0].T);
            const roundMatch = matchId.match(/^R(\d+)M(\d+)$/);
            const roundNum = roundMatch ? parseInt(roundMatch[1]) : 1;
            const teams = teamTexts
              .filter((t) => t.y < matchTexts[i].y)
              .slice(-2)
              .map((t) => decode(t.R[0].T));
            if (!rounds[roundNum]) rounds[roundNum] = [];
            rounds[roundNum].push({ matchId, teams });
          }
          return res.json({ success: true, rounds });
        } catch (parseErr) {
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
        return res.status(500).json({
          success: false,
          message: "Error loading PDF",
          error: loadErr.message,
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
  }
}

export default new TournamentController();
