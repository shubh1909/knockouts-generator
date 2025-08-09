import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createTournamentPDF(
  tournament,
  outputPath = null,
  customTitle = null
) {
  const firstRoundMatchCount = tournament.bracket.filter(
    (m) => m.round === 1
  ).length;
  const margin = 50,
    columnWidth = 140,
    teamBoxHeight = 25,
    bracketPadding = 15;
  const matchHeight = teamBoxHeight * 2 + bracketPadding,
    matchSpacing = matchHeight + 20;
  const contentHeight = margin * 2 + 60 + firstRoundMatchCount * matchSpacing;
  const minHeight = 595,
    pageHeight = Math.max(contentHeight, minHeight);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, pageHeight]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Tournament header
  const title = customTitle || tournament.name || "Tournament Bracket";
  page.drawText(title, {
    x: margin,
    y: height - margin,
    size: 16,
    font: boldFont,
  });

  // Tournament info
  page.drawText(`Status: ${tournament.status.toUpperCase()}`, {
    x: margin,
    y: height - margin - 20,
    size: 10,
    font: font,
    color: tournament.status === "completed" ? rgb(0, 0.6, 0) : rgb(0, 0, 0),
  });

  if (tournament.champion) {
    page.drawText(`Champion: ${tournament.champion.name}`, {
      x: margin + 150,
      y: height - margin - 20,
      size: 10,
      font: boldFont,
      color: rgb(0, 0.6, 0),
    });
  }

  // Round headers
  for (let round = 1; round <= tournament.rounds; round++) {
    page.drawText(getRoundLabel(round, tournament.rounds), {
      x: margin + (round - 1) * columnWidth,
      y: height - margin - 50,
      size: 12,
      font: boldFont,
    });
  }

  // Track positions of each match box for connecting lines
  const matchPositions = {};

  // Center-align matches for each round
  for (let round = 1; round <= tournament.rounds; round++) {
    const roundMatches = tournament.bracket.filter((m) => m.round === round);
    const spacingMultiplier = round === 1 ? 1 : Math.pow(2, round - 1);
    const roundSpacing = matchSpacing * spacingMultiplier;
    const totalMatchesHeight =
      (roundMatches.length - 1) * roundSpacing + matchHeight;
    const startY =
      height - margin - 80 - totalMatchesHeight / 2 + matchHeight / 2;
    roundMatches.forEach((match, index) => {
      const baseY = startY - index * roundSpacing;
      if (round === 1) {
        if (match.participant1?.bye && match.participant2)
          match.winner = match.participant2;
        else if (match.participant2?.bye && match.participant1)
          match.winner = match.participant1;
      }
      drawMatchContainer(page, {
        x: margin + (round - 1) * columnWidth,
        y: baseY,
        width: columnWidth - 20,
        height: matchHeight - bracketPadding,
        match,
        font,
        boldFont,
      });
      // Save position for connecting lines
      matchPositions[match.matchId] = {
        x: margin + (round - 1) * columnWidth,
        y: baseY,
        width: columnWidth - 20,
        height: matchHeight - bracketPadding,
      };
    });
  }

  // Draw connecting lines from each match to its next match
  tournament.bracket.forEach((match) => {
    if (
      match.nextMatchId &&
      matchPositions[match.matchId] &&
      matchPositions[match.nextMatchId]
    ) {
      const from = matchPositions[match.matchId];
      const to = matchPositions[match.nextMatchId];
      // Connect winner's box (center right) to next match's participant box (center left)
      // Determine which participant advances
      let winnerBoxY;
      if (
        match.winner === match.participant1 ||
        (match.participant1 && match.participant1.bye)
      ) {
        winnerBoxY = from.y - from.height / 4;
      } else {
        winnerBoxY = from.y - (3 * from.height) / 4;
      }
      // Target Y is center of next match box
      const targetY = to.y - to.height / 2;
      page.drawLine({
        start: { x: from.x + from.width, y: winnerBoxY },
        end: { x: to.x, y: targetY },
        thickness: 1.5,
        color: rgb(0.2, 0.2, 0.7),
      });
    }
  });

  const pdfBytes = await pdfDoc.save();

  // Generate filename if not provided
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    outputPath = path.join(
      __dirname,
      "..",
      "uploads",
      `tournament-${tournament.id}-${timestamp}.pdf`
    );
  }

  await fs.writeFile(outputPath, pdfBytes);
  return {
    success: true,
    filePath: outputPath,
    fileName: path.basename(outputPath),
    message: "Tournament bracket PDF has been generated successfully",
  };
}

function drawMatchContainer(
  page,
  { x, y, width, height, match, font, boldFont }
) {
  const teamHeight = height / 2;
  const isByeMatch = match.participant1?.bye || match.participant2?.bye;
  const byeWinner = match.participant1?.bye
    ? match.participant2
    : match.participant1;

  drawTeamBox(page, {
    x,
    y,
    width,
    height: teamHeight,
    participant: match.participant1,
    isWinner: isByeMatch
      ? match.participant1 === byeWinner
      : match.winner === match.participant1,
    font,
    boldFont,
    isBye: match.participant1?.bye,
  });

  drawTeamBox(page, {
    x,
    y: y - teamHeight,
    width,
    height: teamHeight,
    participant: match.participant2,
    isWinner: isByeMatch
      ? match.participant2 === byeWinner
      : match.winner === match.participant2,
    font,
    boldFont,
    isBye: match.participant2?.bye,
  });

  // Match ID and status
  page.drawText(match.matchId, {
    x: x + width - 35,
    y: y - height - 12,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Match status indicator
  const statusColor =
    match.status === "completed" ? rgb(0, 0.6, 0) : rgb(0.8, 0.8, 0);
  page.drawCircle({
    x: x + width - 8,
    y: y - height / 2,
    size: 3,
    color: statusColor,
  });
}

function drawTeamBox(
  page,
  { x, y, width, height, participant, isWinner, font, boldFont, isBye }
) {
  const boxColor = isBye
    ? rgb(0.95, 0.95, 0.95)
    : isWinner
    ? rgb(0.9, 1, 0.9)
    : participant
    ? rgb(1, 1, 1)
    : rgb(0.98, 0.98, 0.98);

  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: boxColor,
  });

  let displayText = "";
  let textColor = rgb(0, 0, 0);

  if (participant && participant.bye) {
    displayText = "BYE";
    textColor = rgb(0.5, 0.5, 0.5);
  } else if (participant) {
    displayText = participant.name;
    textColor = isWinner ? rgb(0, 0.5, 0) : rgb(0, 0, 0);
  }

  if (displayText) {
    page.drawText(displayText, {
      x: x + 5,
      y: y - height + height / 2 - 6,
      size: 10,
      font: isWinner ? boldFont : font,
      color: textColor,
    });
  }
}

function getRoundLabel(round, totalRounds) {
  if (round === 1) return "First Round";
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semi-Final";
  if (round === totalRounds - 2) return "Quarter-Final";
  return `Round ${round}`;
}
