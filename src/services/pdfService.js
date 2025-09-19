import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE = { WIDTH: 595.28, HEIGHT: 841.89, MARGIN: 30, HEADER_HEIGHT: 50 };
const BOX = { WIDTH: 100, HEIGHT: 25, PADDING: 3 };
const SPACING = {
  ROUND: 130,
  VERTICAL_BASE: 40,
  MAX_TEAMS_SINGLE_PAGE: 32,
  TEAMS_PER_DIVISION: 16,
};
const FONT = {
  SIZES: { TITLE: 16, ROUND_LABEL: 10, TEAM_NAME: 8 },
  MAX_TEAM_NAME_LENGTH: 14,
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

  if (totalParticipants <= SPACING.MAX_TEAMS_SINGLE_PAGE) {
    const bracket = createBracketStructure(
      participants,
      tournament.roundWinners || {}
    );
    await createSinglePageBracket(
      pdfDoc,
      bracket,
      tournament.name || customTitle,
      font,
      boldFont
    );
  } else {
    await createMultiPageBracketWithCapacityDistribution(
      pdfDoc,
      participants,
      tournament.name || customTitle,
      font,
      boldFont,
      tournament.roundWinners || {}
    );
  }

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

function distributeRoundWinnersByCapacity(roundTeams, divisions) {
  if (!Array.isArray(roundTeams) || roundTeams.length === 0) {
    return divisions.map(() => []);
  }

  const distributedTeams = [];
  let teamIndex = 0;

  for (let divIndex = 0; divIndex < divisions.length; divIndex++) {
    const division = divisions[divIndex];
    const divisionCapacity = Math.ceil(division.teams.length / 2);
    const divisionTeams = [];
    for (
      let i = 0;
      i < divisionCapacity && teamIndex < roundTeams.length;
      i++
    ) {
      divisionTeams.push(roundTeams[teamIndex]);
      teamIndex++;
    }
    distributedTeams.push(divisionTeams);
  }

  return distributedTeams;
}

async function createMultiPageBracketWithCapacityDistribution(
  pdfDoc,
  participants,
  customTitle,
  font,
  boldFont,
  roundWinners
) {
  const teamsPerDivision = SPACING.TEAMS_PER_DIVISION;
  const totalDivisions = Math.ceil(participants.length / teamsPerDivision);

  const divisions = [];
  for (let divIndex = 0; divIndex < totalDivisions; divIndex++) {
    const startIndex = divIndex * teamsPerDivision;
    const endIndex = Math.min(
      startIndex + teamsPerDivision,
      participants.length
    );
    const divisionTeams = participants.slice(startIndex, endIndex);

    divisions.push({
      index: divIndex,
      name: `Division ${String.fromCharCode(65 + divIndex)}`,
      teams: divisionTeams,
    });
  }

  const distributedRoundWinners = {};
  Object.keys(roundWinners).forEach((roundNum) => {
    const roundTeams = roundWinners[roundNum];
    if (Array.isArray(roundTeams) && roundTeams.length > 0) {
      distributedRoundWinners[roundNum] = distributeRoundWinnersByCapacity(
        roundTeams,
        divisions
      );
    }
  });

  const divisionRounds = Math.ceil(Math.log2(SPACING.TEAMS_PER_DIVISION));

  for (let divIndex = 0; divIndex < divisions.length; divIndex++) {
    const division = divisions[divIndex];
    const divisionRoundWinners = { 1: division.teams };

    Object.keys(distributedRoundWinners).forEach((roundNum) => {
      if (distributedRoundWinners[roundNum][divIndex]) {
        divisionRoundWinners[roundNum] =
          distributedRoundWinners[roundNum][divIndex];
      }
    });

    const divisionBracket = createBracketStructureWithMinRounds(
      division.teams,
      divisionRoundWinners,
      divisionRounds
    );

    await createDivisionPageWithDistribution(
      pdfDoc,
      division,
      divisionBracket,
      customTitle,
      font,
      boldFont
    );
  }

  if (totalDivisions > 1) {
    await createChampionshipPageWithCorrectRounds(
      pdfDoc,
      divisions,
      customTitle,
      font,
      boldFont,
      divisionRounds
    );
  }
}

async function createDivisionPageWithDistribution(
  pdfDoc,
  division,
  bracket,
  customTitle,
  font,
  boldFont
) {
  const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  const title = `${customTitle || "Tournament"} - ${division.name}`;
  const titleWidth = boldFont.widthOfTextAtSize(title, FONT.SIZES.TITLE);
  page.drawText(title, {
    x: (PAGE.WIDTH - titleWidth) / 2,
    y: PAGE.HEIGHT - PAGE.MARGIN - 25,
    size: FONT.SIZES.TITLE,
    font: boldFont,
  });

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
      startY: PAGE.HEIGHT - PAGE.HEADER_HEIGHT - 30,
      verticalSpacing,
      font,
      boldFont,
      previousBoxes,
      divisionName: division.name,
    });

    allRoundBoxes.push(roundBoxes);
    if (previousBoxes && roundBoxes) {
      drawBracketConnections(page, previousBoxes, roundBoxes);
    }
    currentX += roundSpacing;
  }
}

async function createChampionshipPageWithCorrectRounds(
  pdfDoc,
  divisions,
  customTitle,
  font,
  boldFont,
  divisionRounds
) {
  const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  const title = `${customTitle || "Tournament"} - Championship Rounds`;
  const titleWidth = boldFont.widthOfTextAtSize(title, FONT.SIZES.TITLE);
  page.drawText(title, {
    x: (PAGE.WIDTH - titleWidth) / 2,
    y: PAGE.HEIGHT - PAGE.MARGIN - 25,
    size: FONT.SIZES.TITLE,
    font: boldFont,
  });

  const emptyParticipants = Array(divisions.length).fill(null);
  const championshipBracket = createChampionshipBracketStructure(
    emptyParticipants,
    divisionRounds
  );

  const availableWidth = PAGE.WIDTH - PAGE.MARGIN * 2;
  const roundSpacing = Math.floor(
    availableWidth / championshipBracket.totalRounds
  );
  const verticalSpacing = 60;

  const allRoundBoxes = [];
  let currentX = PAGE.MARGIN;

  for (
    let roundIndex = 0;
    roundIndex < championshipBracket.rounds.length;
    roundIndex++
  ) {
    const round = championshipBracket.rounds[roundIndex];
    const previousBoxes = roundIndex > 0 ? allRoundBoxes[roundIndex - 1] : null;

    const roundBoxes = drawBracketRound(page, {
      round,
      roundIndex,
      x: currentX,
      startY: PAGE.HEIGHT - PAGE.HEADER_HEIGHT - 60,
      verticalSpacing,
      font,
      boldFont,
      previousBoxes,
      divisionName: "Championship",
    });

    allRoundBoxes.push(roundBoxes);
    if (previousBoxes && roundBoxes) {
      drawBracketConnections(page, previousBoxes, roundBoxes);
    }
    currentX += roundSpacing;
  }
}

function createChampionshipBracketStructure(participants, startingRound) {
  const totalParticipants = participants.length;
  const totalRounds = Math.ceil(Math.log2(totalParticipants));
  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    const actualRoundNumber = startingRound + round;
    let matchCount = Math.ceil(Math.pow(2, totalRounds - round + 1) / 2);
    rounds.push({
      roundNumber: actualRoundNumber,
      matchCount: matchCount,
      teams: [],
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
      matchCount = Math.ceil(roundTeams.length / 2);
    } else if (
      roundWinners[round] &&
      Array.isArray(roundWinners[round]) &&
      roundWinners[round].length > 0
    ) {
      roundTeams = [...roundWinners[round]];
      matchCount = Math.ceil(roundTeams.length / 2);
    } else {
      matchCount = Math.ceil(totalParticipants / Math.pow(2, round));
      if (matchCount < 1) matchCount = 1;
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

function createBracketStructure(participants, roundWinners = {}) {
  return createBracketStructureWithMinRounds(participants, roundWinners, 0);
}

async function createSinglePageBracket(
  pdfDoc,
  bracket,
  customTitle,
  font,
  boldFont
) {
  const page = pdfDoc.addPage([PAGE.WIDTH, PAGE.HEIGHT]);
  const title = customTitle || "Tournament Bracket";
  const titleWidth = boldFont.widthOfTextAtSize(title, FONT.SIZES.TITLE);
  page.drawText(title, {
    x: (PAGE.WIDTH - titleWidth) / 2,
    y: PAGE.HEIGHT - PAGE.MARGIN - 25,
    size: FONT.SIZES.TITLE,
    font: boldFont,
  });

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
      startY: PAGE.HEIGHT - PAGE.HEADER_HEIGHT - 30,
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
    let currentY = startY - 35;
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
  } else if (round.teams.length > 0) {
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
  page.drawRectangle({
    x,
    y,
    width: BOX.WIDTH,
    height: BOX.HEIGHT,
    borderWidth: 0.5,
    borderColor: COLORS.BLACK,
    color: COLORS.WHITE,
  });

  if (
    teamName &&
    teamName !== "BYE" &&
    teamName !== null &&
    teamName !== undefined
  ) {
    let displayName = typeof teamName === "string" ? teamName.trim() : "";

    if (
      displayName &&
      displayName !== "undefined" &&
      displayName !== "null" &&
      displayName !== ""
    ) {
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
