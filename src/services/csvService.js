import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CSVService {
  /**
   * Convert tournament JSON to CSV format
   * @param {Object} tournamentData - Tournament data object
   * @returns {string} CSV content
   */
  static convertTournamentToCSV(tournamentData) {
    try {
      const csvRows = [];

      // Add tournament info header
      csvRows.push("Tournament Information");
      csvRows.push(
        `Name,"${this.sanitizeCSVValue(tournamentData.name || "N/A")}"`
      );
      csvRows.push(
        `Date,"${this.sanitizeCSVValue(tournamentData.date || "N/A")}"`
      );
      csvRows.push(
        `Country,"${this.sanitizeCSVValue(tournamentData.country || "N/A")}"`
      );
      csvRows.push(
        `Website,"${this.sanitizeCSVValue(tournamentData.website || "N/A")}"`
      );
      csvRows.push(
        `Total Participants,${tournamentData.participants?.length || 0}`
      );
      csvRows.push(
        `Status,"${this.sanitizeCSVValue(tournamentData.status || "N/A")}"`
      );
      csvRows.push(
        `Created At,"${this.sanitizeCSVValue(
          tournamentData.createdAt || "N/A"
        )}"`
      );
      csvRows.push("");

      // Add participants
      if (
        tournamentData.participants &&
        Array.isArray(tournamentData.participants)
      ) {
        csvRows.push("Participants");
        csvRows.push("Position,Team Name");
        tournamentData.participants.forEach((participant, index) => {
          if (participant && typeof participant === "string") {
            csvRows.push(
              `${index + 1},"${this.sanitizeCSVValue(participant)}"`
            );
          }
        });
        csvRows.push("");
      }

      // Add round winners if available
      if (
        tournamentData.roundWinners &&
        typeof tournamentData.roundWinners === "object"
      ) {
        csvRows.push("Round Winners");
        csvRows.push("Round,Teams");
        Object.entries(tournamentData.roundWinners).forEach(
          ([round, teams]) => {
            if (Array.isArray(teams)) {
              const teamsString = teams
                .map((team) => this.sanitizeCSVValue(team || "TBD"))
                .join("; ");
              csvRows.push(`${round},"${teamsString}"`);
            }
          }
        );
        csvRows.push("");
      }

      // Add bracket matches if available
      if (tournamentData.bracket && Array.isArray(tournamentData.bracket)) {
        csvRows.push("Tournament Bracket");
        csvRows.push("Round,Match ID,Team 1,Team 2,Winner");
        tournamentData.bracket.forEach((match) => {
          const team1 = this.sanitizeCSVValue(match.team1 || "TBD");
          const team2 = this.sanitizeCSVValue(match.team2 || "TBD");
          const winner = this.sanitizeCSVValue(match.winner || "Pending");
          csvRows.push(
            `${match.round || "N/A"},"${
              match.matchId || "N/A"
            }","${team1}","${team2}","${winner}"`
          );
        });
      }

      return csvRows.join("\n");
    } catch (error) {
      throw new Error(
        `Failed to convert tournament data to CSV: ${error.message}`
      );
    }
  }

  /**
   * Convert match data to CSV (for PDF-to-JSON results)
   * @param {Object} matchData - Parsed match data from PDF
   * @returns {string} CSV content
   */
  static convertMatchDataToCSV(matchData) {
    try {
      const csvRows = [];

      csvRows.push("Tournament Matches (Parsed from PDF)");
      csvRows.push("Round,Match ID,Team 1,Team 2");

      if (matchData.rounds && typeof matchData.rounds === "object") {
        Object.entries(matchData.rounds).forEach(([roundNum, matches]) => {
          if (Array.isArray(matches)) {
            matches.forEach((match) => {
              const team1 = this.sanitizeCSVValue(
                (match.teams && match.teams[0]) || "N/A"
              );
              const team2 = this.sanitizeCSVValue(
                (match.teams && match.teams[1]) || "N/A"
              );
              const matchId = this.sanitizeCSVValue(match.matchId || "N/A");
              csvRows.push(`${roundNum},"${matchId}","${team1}","${team2}"`);
            });
          }
        });
      } else {
        csvRows.push("No match data available");
      }

      return csvRows.join("\n");
    } catch (error) {
      throw new Error(`Failed to convert match data to CSV: ${error.message}`);
    }
  }

  /**
   * Convert any JSON object to CSV (generic converter)
   * @param {Object} jsonData - Any JSON object
   * @param {string} title - Title for the CSV
   * @returns {string} CSV content
   */
  static convertGenericJSONToCSV(jsonData, title = "JSON Data") {
    try {
      const csvRows = [];
      csvRows.push(title);
      csvRows.push("Key,Value");

      const flattenObject = (obj, prefix = "") => {
        const result = [];
        for (const [key, value] of Object.entries(obj)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === "object" && !Array.isArray(value)) {
            result.push(...flattenObject(value, newKey));
          } else if (Array.isArray(value)) {
            result.push([
              newKey,
              `[${value
                .map((v) => this.sanitizeCSVValue(String(v)))
                .join("; ")}]`,
            ]);
          } else {
            result.push([newKey, this.sanitizeCSVValue(String(value))]);
          }
        }
        return result;
      };

      const flattened = flattenObject(jsonData);
      flattened.forEach(([key, value]) => {
        csvRows.push(`"${this.sanitizeCSVValue(key)}","${value}"`);
      });

      return csvRows.join("\n");
    } catch (error) {
      throw new Error(`Failed to convert JSON to CSV: ${error.message}`);
    }
  }

  /**
   * Sanitize CSV values to handle commas, quotes, and newlines
   * @param {string} value - Value to sanitize
   * @returns {string} Sanitized value
   */
  static sanitizeCSVValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const stringValue = String(value);

    // If the value contains commas, quotes, or newlines, it needs to be escaped
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n") ||
      stringValue.includes("\r")
    ) {
      // Escape quotes by doubling them
      return stringValue.replace(/"/g, '""');
    }

    return stringValue;
  }

  /**
   * Save CSV data to file
   * @param {string} csvContent - CSV content string
   * @param {string} filename - Filename for the CSV
   * @returns {Promise<string>} File path
   */
  static async saveCSVFile(csvContent, filename) {
    try {
      const uploadsDir = path.join(__dirname, "..", "uploads");

      // Ensure uploads directory exists
      await fs.mkdir(uploadsDir, { recursive: true });

      // Ensure filename has .csv extension
      if (!filename.endsWith(".csv")) {
        filename += ".csv";
      }

      const filepath = path.join(uploadsDir, filename);

      // Write file with UTF-8 BOM for better Excel compatibility
      const BOM = "\uFEFF";
      await fs.writeFile(filepath, BOM + csvContent, "utf8");

      return filepath;
    } catch (error) {
      throw new Error(`Failed to save CSV file: ${error.message}`);
    }
  }

  /**
   * Validate CSV filename
   * @param {string} filename - Filename to validate
   * @returns {string} Valid filename
   */
  static validateFilename(filename) {
    if (!filename || typeof filename !== "string") {
      return `export-${Date.now()}.csv`;
    }

    // Remove invalid characters
    const sanitized = filename.replace(/[<>:"/\\|?*]/g, "");

    // Ensure it's not empty after sanitization
    if (!sanitized.trim()) {
      return `export-${Date.now()}.csv`;
    }

    // Ensure .csv extension
    if (!sanitized.endsWith(".csv")) {
      return sanitized.trim() + ".csv";
    }

    return sanitized.trim();
  }
}

export default CSVService;
