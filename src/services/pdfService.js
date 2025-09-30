import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE = { WIDTH: 595.28, HEIGHT: 841.89, MARGIN: 30, HEADER_HEIGHT: 50 };
const BOX = { WIDTH: 100, HEIGHT: 25, DOUBLES_HEIGHT: 35, PADDING: 3 };
const SPACING = {
  ROUND: 130,
  VERTICAL_BASE: 40,
  MAX_TEAMS_SINGLE_PAGE: 32,
  TEAMS_PER_DIVISION: 16,
};
const FONT = {
  SIZES: { TITLE: 16, ROUND_LABEL: 10, TEAM_NAME: 8 },
  MAX_TEAM_NAME_LENGTH: 22,
};
const COLORS = {
  BLACK: rgb(0, 0, 0),
  WHITE: rgb(1, 1, 1),
};

export async function createTournamentPDF(
  tournament,
  outputPath = null,
  customTitle = "Fixtures"
) {
  const participants = Array.isArray(tournament.participants)
    ? tournament.participants
    : [];
  const totalParticipants = participants.length;

  if (totalParticipants < 2) {
    throw new Error("At least 2 participants are required");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { date, country, website, winner } = tournament;

  const bracket = createBracketStructure(
    participants,
    tournament.roundWinners || {}
  );
  await createAutoWrappedFixturePage(
    pdfDoc,
    bracket,
    tournament.name || customTitle,
    font,
    boldFont,
    { date, country, website, winner }
  );

  outputPath =
    outputPath ||
    path.join(__dirname, "..", "uploads", `tournament-${Date.now()}.pdf`);
  await fs.writeFile(outputPath, await pdfDoc.save());

  return {
    success: true,
    filePath: outputPath,
    fileName: path.basename(outputPath),
    message: `Tournament bracket PDF generated successfully with ${pdfDoc.getPageCount()} pages`,
  };
}

async function createAutoWrappedFixturePage(
  pdfDoc,
  bracket,
  customTitle,
  font,
  boldFont,
  additionalInfo = {}
) {
  const marginBetweenColumns = 40;
  const columnWidth = BOX.WIDTH + marginBetweenColumns;
  const availableWidth = PAGE.WIDTH - PAGE.MARGIN * 2;
  const roundsTotal = bracket.totalRounds || bracket.rounds.length || 0;

  if (roundsTotal === 0) {
    const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
    page.drawText("No rounds to render", {
      x: PAGE.MARGIN,
      y: PAGE.HEIGHT - PAGE.MARGIN - 20,
      size: 12,
      font,
    });
    return;
  }

  const columnsPerRow = Math.max(1, Math.floor(availableWidth / columnWidth));
  const rowsNeeded = Math.ceil(roundsTotal / columnsPerRow);

  const firstRoundMatches =
    (bracket.rounds && bracket.rounds[0] && bracket.rounds[0].matchCount) || 1;
  const verticalSpacing = Math.max(
    20,
    Math.min(
      SPACING.VERTICAL_BASE,
      (PAGE.HEIGHT - PAGE.HEADER_HEIGHT - 2 * PAGE.MARGIN - 100) /
        firstRoundMatches
    )
  );

  // estimate row height: space needed to render the full vertical list of first round matches
  const perMatchVertical = BOX.HEIGHT * 2 + verticalSpacing;
  const rowContentHeight = firstRoundMatches * perMatchVertical + 120; // 120 for title / paddings per row
  const dynamicPageHeight = Math.max(
    PAGE.HEIGHT,
    PAGE.HEADER_HEIGHT + PAGE.MARGIN * 2 + rowsNeeded * rowContentHeight
  );

  // Create one tall page
  const page = pdfDoc.addPage([PAGE.WIDTH, dynamicPageHeight]);

  // Render title at top centered
  const title = customTitle || "Tournament Bracket";
  const titleWidth = boldFont.widthOfTextAtSize(title, FONT.SIZES.TITLE);
  page.drawText(title, {
    x: (PAGE.WIDTH - titleWidth) / 2,
    y: dynamicPageHeight - PAGE.MARGIN - 25,
    size: FONT.SIZES.TITLE,
    font: boldFont,
  });

  // tournament info row below title
  drawTournamentInfo(
    page,
    additionalInfo,
    font,
    dynamicPageHeight - PAGE.MARGIN - 45
  );

  // For each round, compute its row and column and draw
  for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex++) {
    const round = bracket.rounds[roundIndex];

    const row = Math.floor(roundIndex / columnsPerRow);
    const colInRow = roundIndex % columnsPerRow;

    const x = PAGE.MARGIN + colInRow * columnWidth;

    // startY per row: push down with row offset
    const startY =
      dynamicPageHeight -
      PAGE.HEADER_HEIGHT -
      PAGE.MARGIN -
      row * rowContentHeight -
      40;

    // For connections across rows it's complicated (because connections usually go within same row).
    // We'll only draw connections between rounds that sit in the same row adjacent columns.
    // For rounds that go to next row (wrap), connections are omitted because visual continuity breaks across rows.
    // This matches requirement: keep layout organized and consistent.
    const previousBoxes =
      roundIndex > 0 && Math.floor((roundIndex - 1) / columnsPerRow) === row
        ? undefined // will be set below per-row using collected array
        : null;

    // We'll draw round and collect boxes for that row to enable connections with the previous column in same row.
    // To support connections, we need to maintain per-row arrays.
  }

  // We'll perform a second pass that maintains per-row `allRoundBoxes` so connections are drawn only within same row.
  const rowsAllRoundBoxes = Array.from({ length: rowsNeeded }, () => []);
  let lastRoundBoxes = null;

  for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex++) {
    const round = bracket.rounds[roundIndex];

    const row = Math.floor(roundIndex / columnsPerRow);
    const colInRow = roundIndex % columnsPerRow;

    const x = PAGE.MARGIN + colInRow * columnWidth;
    const startY =
      dynamicPageHeight -
      PAGE.HEADER_HEIGHT -
      PAGE.MARGIN -
      row * rowContentHeight -
      40;

    const prevBoxesForThisRow =
      colInRow > 0 ? rowsAllRoundBoxes[row][colInRow - 1] : null;

    const roundBoxes = drawBracketRound(page, {
      round,
      roundIndex,
      x,
      startY,
      verticalSpacing,
      font,
      boldFont,
      previousBoxes: prevBoxesForThisRow,
      divisionName: "Single",
    });

    rowsAllRoundBoxes[row].push(roundBoxes);

    // draw connections to previous round in same row if possible
    if (prevBoxesForThisRow && roundBoxes) {
      drawBracketConnections(page, prevBoxesForThisRow, roundBoxes);
    }

    lastRoundBoxes = roundBoxes;
  }

  if (additionalInfo?.winner && lastRoundBoxes?.length) {
    const finalBox = lastRoundBoxes[0]; // winner should be in the first/only box of final round
    const winnerText = `Winner: ${additionalInfo.winner}`;
    const fontSize = 14;
    const winnerX = PAGE.MARGIN + 20;
    const textWidth = boldFont.widthOfTextAtSize(winnerText, fontSize);
    const maxWidth = PAGE.WIDTH - (PAGE.MARGIN * 2 + 60);

    let displayWinnerText = winnerText;
    if (textWidth > maxWidth) {
      // Truncate text if too long
      const ratio = maxWidth / textWidth;
      const maxChars = Math.floor(winnerText.length * ratio) - 3;
      displayWinnerText = winnerText.substring(0, maxChars) + "...";
    }

     page.drawText(displayWinnerText, {
      x: winnerX,
      y: finalBox.y - 50, // 100px below the final match box
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0.5, 0),
    });
  }

  // Done with page
}

/* ------------------------
   Existing helper functions
   (kept mostly as-is with no division logic)
   ------------------------ */

function createBracketStructure(participants, roundWinners = {}) {
  const totalParticipants = Array.isArray(participants)
    ? participants.length
    : 0;
  if (totalParticipants === 0) {
    return { rounds: [], totalRounds: 0, totalParticipants: 0 };
  }

  const totalRounds = Math.ceil(Math.log2(totalParticipants));
  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    let roundTeams = [];
    let matchCount = 0;

    if (round === 1) {
      // First round should have all participants
      roundTeams = [...participants];
      // Add null for odd count
      if (roundTeams.length % 2 !== 0) {
        roundTeams.push(null);
      }
      matchCount = Math.ceil(roundTeams.length / 2);
    } else if (
      roundWinners[round] &&
      Array.isArray(roundWinners[round]) &&
      roundWinners[round].length > 0
    ) {
      // Use provided round winners
      roundTeams = [...roundWinners[round]];
      if (roundTeams.length % 2 !== 0) {
        roundTeams.push(null);
      }
      matchCount = Math.ceil(roundTeams.length / 2);
    } else {
      // Calculate expected teams for empty rounds
      const previousRoundCount =
        round === 2
          ? totalParticipants
          : Math.ceil(totalParticipants / Math.pow(2, round - 2));
      const expectedTeams = Math.ceil(previousRoundCount / 2);
      matchCount = Math.max(1, Math.ceil(expectedTeams / 2));
      roundTeams = [];
    }

    rounds.push({
      roundNumber: round,
      matchCount: matchCount,
      teams: roundTeams,
    });
  }

  return { rounds, totalRounds, totalParticipants };
}

function createBracketStructureWithMinRounds(
  participants,
  roundWinners = {},
  minRounds = 4
) {
  const totalParticipants = Array.isArray(participants)
    ? participants.length
    : 0;
  if (totalParticipants === 0) {
    return { rounds: [], totalRounds: 0, totalParticipants: 0 };
  }

  const naturalRounds = Math.ceil(Math.log2(totalParticipants));
  const totalRounds = Math.max(naturalRounds, minRounds);
  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    let roundTeams = [];
    let matchCount = 0;

    if (round === 1) {
      roundTeams = [...participants];
      if (roundTeams.length % 2 !== 0) {
        roundTeams.push(null);
      }
      matchCount = Math.ceil(roundTeams.length / 2);
    } else if (
      roundWinners[round] &&
      Array.isArray(roundWinners[round]) &&
      roundWinners[round].length > 0
    ) {
      roundTeams = [...roundWinners[round]];
      if (roundTeams.length % 2 !== 0) {
        roundTeams.push(null);
      }
      matchCount = Math.ceil(roundTeams.length / 2);
    } else {
      const previousRoundTeams =
        round === 2
          ? totalParticipants
          : Math.ceil(totalParticipants / Math.pow(2, round - 2));
      const expectedTeams = Math.ceil(previousRoundTeams / 2);
      matchCount = Math.max(1, Math.ceil(expectedTeams / 2));
      roundTeams = [];
    }

    rounds.push({
      roundNumber: round,
      matchCount: matchCount,
      teams: roundTeams,
    });
  }

  return { rounds, totalRounds, totalParticipants };
}

async function createSinglePageBracket(
  pdfDoc,
  bracket,
  customTitle,
  font,
  boldFont,
  additionalInfo = {}
) {
  // kept for backwards compatibility if needed, but our main flow uses createAutoWrappedFixturePage
  const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  const title = customTitle || "Tournament Bracket";
  const titleWidth = boldFont.widthOfTextAtSize(title, FONT.SIZES.TITLE);
  page.drawText(title, {
    x: (PAGE.WIDTH - titleWidth) / 2,
    y: PAGE.HEIGHT - PAGE.MARGIN - 25,
    size: FONT.SIZES.TITLE,
    font: boldFont,
  });

  drawTournamentInfo(
    page,
    additionalInfo,
    font,
    PAGE.HEIGHT - PAGE.MARGIN - 45
  );

  const availableWidth = PAGE.WIDTH - PAGE.MARGIN * 2;
  const roundSpacing = Math.floor(availableWidth / bracket.totalRounds);
  const availableHeight = PAGE.HEIGHT - PAGE.HEADER_HEIGHT - PAGE.MARGIN * 2;
  const firstRoundMatches = bracket.rounds[0].matchCount;
  const verticalSpacing = Math.max(
    20,
    Math.min(SPACING.VERTICAL_BASE, (availableHeight - 100) / firstRoundMatches)
  );

  const allRoundBoxes = [];
  let currentX = PAGE.MARGIN;

  for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex++) {
    const round = bracket.rounds[roundIndex];
    const previousBoxes = roundIndex > 0 ? allRoundBoxes[roundIndex - 1] : null;

    const roundBoxes = drawBracketRound(page, {
      round,
      roundIndex,
      x: currentX,
      startY: PAGE.HEIGHT - PAGE.HEADER_HEIGHT - 50, // Adjusted for tournament info
      verticalSpacing,
      font,
      boldFont,
      previousBoxes,
      divisionName: "Single",
    });
    allRoundBoxes.push(roundBoxes);
    if (previousBoxes && roundBoxes) {
      drawBracketConnections(page, previousBoxes, roundBoxes);
    }
    currentX += roundSpacing;
  }
}

function drawBracketRound(
  page,
  {
    round,
    roundIndex,
    x,
    startY,
    verticalSpacing,
    font,
    boldFont,
    previousBoxes,
    divisionName = "",
  }
) {
  const roundBoxes = [];
  const roundLabel = `Round ${round.roundNumber}`;
  const labelWidth = boldFont.widthOfTextAtSize(
    roundLabel,
    FONT.SIZES.ROUND_LABEL
  );
  page.drawText(roundLabel, {
    x: x + (BOX.WIDTH - labelWidth) / 2,
    y: startY,
    size: FONT.SIZES.ROUND_LABEL,
    font: boldFont,
  });

  if (roundIndex === 0) {
    let currentY = startY - 45;
    for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex++) {
      const team1 = round.teams[matchIndex * 2] || null;
      const team2 = round.teams[matchIndex * 2 + 1] || null;

      const box1 = drawTeamBox(page, { x, y: currentY, teamName: team1, font });
      roundBoxes.push(box1);

      const box2 = drawTeamBox(page, {
        x,
        y: currentY - BOX.HEIGHT - 3,
        teamName: team2,
        font,
      });
      roundBoxes.push(box2);

      currentY -= BOX.HEIGHT * 2 + verticalSpacing;
    }
  } else if (round.teams && round.teams.length > 0) {
    if (previousBoxes && previousBoxes.length > 0) {
      for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex++) {
        const boxesPerMatch = 2;
        const matchesPerNewMatch = 2;
        const prevMatch1StartIndex =
          matchIndex * matchesPerNewMatch * boxesPerMatch;
        const prevMatch2StartIndex = prevMatch1StartIndex + boxesPerMatch;
        const hasPrevMatch1 = prevMatch1StartIndex + 1 < previousBoxes.length;
        const hasPrevMatch2 = prevMatch2StartIndex + 1 < previousBoxes.length;

        if (hasPrevMatch1 && hasPrevMatch2) {
          const prevBox1 = previousBoxes[prevMatch1StartIndex];
          const prevBox2 = previousBoxes[prevMatch1StartIndex + 1];
          const prevBox3 = previousBoxes[prevMatch2StartIndex];
          const prevBox4 = previousBoxes[prevMatch2StartIndex + 1];
          const match1CenterY = (prevBox1.y + prevBox2.y) / 2;
          const match2CenterY = (prevBox3.y + prevBox4.y) / 2;
          const overallCenterY = (match1CenterY + match2CenterY) / 2;
          const box1Y = overallCenterY + BOX.HEIGHT / 2 + 1.5;
          const box2Y = overallCenterY - BOX.HEIGHT / 2 - 1.5;

          const team1 = round.teams[matchIndex * 2] || null;
          const team2 = round.teams[matchIndex * 2 + 1] || null;

          const box1 = drawTeamBox(page, {
            x,
            y: box1Y,
            teamName: team1,
            font,
          });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, {
            x,
            y: box2Y,
            teamName: team2,
            font,
          });
          roundBoxes.push(box2);
        } else if (hasPrevMatch1 && !hasPrevMatch2) {
          const prevBox1 = previousBoxes[prevMatch1StartIndex];
          const prevBox2 = previousBoxes[prevMatch1StartIndex + 1];
          const matchCenterY = (prevBox1.y + prevBox2.y) / 2;
          const overallCenterY = matchCenterY;
          const box1Y = overallCenterY + BOX.HEIGHT / 2 + 1.5;
          const box2Y = overallCenterY - BOX.HEIGHT / 2 - 1.5;

          const team1 = round.teams[matchIndex * 2] || null;
          const team2 = round.teams[matchIndex * 2 + 1] || null;

          const box1 = drawTeamBox(page, {
            x,
            y: box1Y,
            teamName: team1,
            font,
          });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, {
            x,
            y: box2Y,
            teamName: team2,
            font,
          });
          roundBoxes.push(box2);
        } else {
          const minDistanceFromTitle = 60;
          const fallbackStartY = startY - minDistanceFromTitle;
          const fallbackY =
            fallbackStartY - matchIndex * (BOX.HEIGHT * 2 + verticalSpacing);

          const team1 = round.teams[matchIndex * 2] || null;
          const team2 = round.teams[matchIndex * 2 + 1] || null;

          const box1 = drawTeamBox(page, {
            x,
            y: fallbackY,
            teamName: team1,
            font,
          });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, {
            x,
            y: fallbackY - BOX.HEIGHT - 3,
            teamName: team2,
            font,
          });
          roundBoxes.push(box2);
        }
      }
    } else {
      let currentY = startY - 60;
      for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex++) {
        const team1 = round.teams[matchIndex * 2] || null;
        const team2 = round.teams[matchIndex * 2 + 1] || null;

        const box1 = drawTeamBox(page, {
          x,
          y: currentY,
          teamName: team1,
          font,
        });
        roundBoxes.push(box1);

        const box2 = drawTeamBox(page, {
          x,
          y: currentY - BOX.HEIGHT - 3,
          teamName: team2,
          font,
        });
        roundBoxes.push(box2);

        currentY -= BOX.HEIGHT * 2 + verticalSpacing;
      }
    }
  } else {
    if (previousBoxes && previousBoxes.length > 0) {
      for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex++) {
        const boxesPerMatch = 2;
        const matchesPerNewMatch = 2;

        const prevMatch1StartIndex =
          matchIndex * matchesPerNewMatch * boxesPerMatch;
        const prevMatch2StartIndex = prevMatch1StartIndex + boxesPerMatch;

        const hasPrevMatch1 = prevMatch1StartIndex + 1 < previousBoxes.length;
        const hasPrevMatch2 = prevMatch2StartIndex + 1 < previousBoxes.length;

        if (hasPrevMatch1 && hasPrevMatch2) {
          const prevBox1 = previousBoxes[prevMatch1StartIndex];
          const prevBox2 = previousBoxes[prevMatch1StartIndex + 1];
          const prevBox3 = previousBoxes[prevMatch2StartIndex];
          const prevBox4 = previousBoxes[prevMatch2StartIndex + 1];

          const match1CenterY = (prevBox1.y + prevBox2.y) / 2;
          const match2CenterY = (prevBox3.y + prevBox4.y) / 2;
          const overallCenterY = (match1CenterY + match2CenterY) / 2;

          const box1Y = overallCenterY + BOX.HEIGHT / 2 + 1.5;
          const box2Y = overallCenterY - BOX.HEIGHT / 2 - 1.5;

          const box1 = drawTeamBox(page, { x, y: box1Y, teamName: null, font });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, { x, y: box2Y, teamName: null, font });
          roundBoxes.push(box2);
        } else if (hasPrevMatch1 && !hasPrevMatch2) {
          const prevBox1 = previousBoxes[prevMatch1StartIndex];
          const prevBox2 = previousBoxes[prevMatch1StartIndex + 1];

          const matchCenterY = (prevBox1.y + prevBox2.y) / 2;
          const overallCenterY = matchCenterY;

          const box1Y = overallCenterY + BOX.HEIGHT / 2 + 1.5;
          const box2Y = overallCenterY - BOX.HEIGHT / 2 - 1.5;

          const box1 = drawTeamBox(page, { x, y: box1Y, teamName: null, font });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, { x, y: box2Y, teamName: null, font });
          roundBoxes.push(box2);
        } else {
          const minDistanceFromTitle = 60;
          const fallbackStartY = startY - minDistanceFromTitle;
          const fallbackY =
            fallbackStartY -
            matchIndex * (BOX.HEIGHT * 2 + Math.max(verticalSpacing, 30));

          const finalY = Math.min(fallbackY, startY - minDistanceFromTitle);

          const box1 = drawTeamBox(page, {
            x,
            y: finalY,
            teamName: null,
            font,
          });
          roundBoxes.push(box1);

          const box2 = drawTeamBox(page, {
            x,
            y: finalY - BOX.HEIGHT - 3,
            teamName: null,
            font,
          });
          roundBoxes.push(box2);
        }
      }
    } else {
      const minDistanceFromTitle = 60;
      let currentY = startY - minDistanceFromTitle;

      for (let matchIndex = 0; matchIndex < round.matchCount; matchIndex++) {
        const box1 = drawTeamBox(page, {
          x,
          y: currentY,
          teamName: null,
          font,
        });
        roundBoxes.push(box1);

        const box2 = drawTeamBox(page, {
          x,
          y: currentY - BOX.HEIGHT - 3,
          teamName: null,
          font,
        });
        roundBoxes.push(box2);

        currentY -= BOX.HEIGHT * 2 + Math.max(verticalSpacing, 30);
      }
    }
  }

  return roundBoxes;
}

function drawTeamBox(page, { x, y, teamName, font }) {
  const isDoubles = teamName && teamName.includes(",");
  const boxHeight = isDoubles ? BOX.DOUBLES_HEIGHT : BOX.HEIGHT;

  page.drawRectangle({
    x,
    y,
    width: BOX.WIDTH,
    height: boxHeight,
    borderWidth: 0.5,
    borderColor: COLORS.BLACK,
    color: COLORS.WHITE,
  });

  if (teamName && teamName !== null && teamName !== undefined) {
    let displayName = typeof teamName === "string" ? teamName.trim() : "";

    if (
      displayName &&
      displayName !== "undefined" &&
      displayName !== "null" &&
      displayName !== ""
    )
      if (isDoubles) {
        // Split team names and handle each separately
        const [team1, team2] = displayName.split(",").map((t) => t.trim());

        // Draw first team name
        const displayTeam1 =
          team1.length > FONT.MAX_TEAM_NAME_LENGTH
            ? team1.substring(0, FONT.MAX_TEAM_NAME_LENGTH - 2) + ".."
            : team1;

        page.drawText(displayTeam1, {
          x: x + BOX.PADDING,
          y: y + boxHeight - 12, // Position for first team
          size: FONT.SIZES.TEAM_NAME,
          font,
        });

        // Draw second team name
        const displayTeam2 =
          team2.length > FONT.MAX_TEAM_NAME_LENGTH
            ? team2.substring(0, FONT.MAX_TEAM_NAME_LENGTH - 2) + ".."
            : team2;

        page.drawText(displayTeam2, {
          x: x + BOX.PADDING,
          y: y + boxHeight - 24, // Position for second team
          size: FONT.SIZES.TEAM_NAME,
          font,
        });
      } else {
        if (displayName.length > FONT.MAX_TEAM_NAME_LENGTH) {
          displayName =
            displayName.substring(0, FONT.MAX_TEAM_NAME_LENGTH - 2) + "..";
        }

        page.drawText(displayName, {
          x: x + BOX.PADDING,
          y: y + BOX.HEIGHT / 2 - 3,
          size: FONT.SIZES.TEAM_NAME,
          font,
        });
      }
  }
  return { x, y, width: BOX.WIDTH, height: BOX.HEIGHT };
}

function drawTournamentInfo(page, additionalInfo, font, yPosition) {
  const { date, country, website } = additionalInfo;
  const infoItems = [];

  if (date) {
    infoItems.push(`Date: ${date}`);
  }
  if (country) {
    infoItems.push(`Country: ${country}`);
  }
  if (website) {
    infoItems.push(`Website: ${website}`);
  }

  if (infoItems.length > 0) {
    const infoText = infoItems.join(" | ");
    const textWidth = font.widthOfTextAtSize(infoText, 10);
    page.drawText(infoText, {
      x: (PAGE.WIDTH - textWidth) / 2,
      y: yPosition,
      size: 10,
      font: font,
      color: COLORS.BLACK,
    });
  }
}

function drawBracketConnections(page, fromBoxes, toBoxes) {
  if (!fromBoxes || !toBoxes || fromBoxes.length === 0) return;

  for (let i = 0; i < fromBoxes.length; i += 4) {
    const box1 = fromBoxes[i],
      box2 = fromBoxes[i + 1],
      box3 = fromBoxes[i + 2],
      box4 = fromBoxes[i + 3];

    const targetMatchIndex = Math.floor(i / 4);
    const targetBoxIndex = targetMatchIndex * 2;

    if (targetBoxIndex >= toBoxes.length) continue;

    const targetBox = toBoxes[targetBoxIndex];
    if (!box1 || !box2 || !targetBox) continue;

    const startX = box1.x + BOX.WIDTH;
    const endX = targetBox.x;
    const midX = startX + (endX - startX) / 3;

    const y1 = box1.y + BOX.HEIGHT / 2;
    const y2 = box2.y + BOX.HEIGHT / 2;
    const midY12 = (y1 + y2) / 2;

    page.drawLine({
      start: { x: startX, y: y1 },
      end: { x: midX, y: y1 },
      thickness: 0.5,
      color: COLORS.BLACK,
    });
    page.drawLine({
      start: { x: startX, y: y2 },
      end: { x: midX, y: y2 },
      thickness: 0.5,
      color: COLORS.BLACK,
    });
    page.drawLine({
      start: { x: midX, y: y1 },
      end: { x: midX, y: y2 },
      thickness: 0.5,
      color: COLORS.BLACK,
    });

    if (box3 && box4) {
      const y3 = box3.y + BOX.HEIGHT / 2,
        y4 = box4.y + BOX.HEIGHT / 2,
        midY34 = (y3 + y4) / 2;

      page.drawLine({
        start: { x: startX, y: y3 },
        end: { x: midX, y: y3 },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
      page.drawLine({
        start: { x: startX, y: y4 },
        end: { x: midX, y: y4 },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
      page.drawLine({
        start: { x: midX, y: y3 },
        end: { x: midX, y: y4 },
        thickness: 0.5,
        color: COLORS.BLACK,
      });

      const finalMidY = (midY12 + midY34) / 2;
      page.drawLine({
        start: { x: midX, y: midY12 },
        end: { x: midX, y: finalMidY },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
      page.drawLine({
        start: { x: midX, y: midY34 },
        end: { x: midX, y: finalMidY },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
      page.drawLine({
        start: { x: midX, y: finalMidY },
        end: { x: endX, y: targetBox.y + BOX.HEIGHT / 2 },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
    } else {
      const targetY = targetBox.y + BOX.HEIGHT / 2;
      page.drawLine({
        start: { x: midX, y: midY12 },
        end: { x: endX, y: targetY },
        thickness: 0.5,
        color: COLORS.BLACK,
      });
    }
  }
}

export default { createTournamentPDF };
