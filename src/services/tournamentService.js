export function createKnockoutFixture(participants) {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error("At least 2 participants are required");
  }

  const totalTeams = participants.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
  const rounds = Math.ceil(Math.log2(nextPowerOf2));

  const tournament = {
    id: generateTournamentId(),
    rounds,
    bracket: [],
    participants,
  };

  // Step 1: Assign positions to teams and BYEs (no BYE vs BYE)
  const { teams, byes } = calculatePositions(totalTeams, nextPowerOf2);

  // Step 2: Fill Round 1 matches (with BYEs)
  const round1Matches = [];
  for (let i = 0; i < nextPowerOf2; i += 2) {
    const pos1 = i + 1;
    const pos2 = i + 2;
    const participant1 = byes.includes(pos1)
      ? { bye: true }
      : participants[teams.indexOf(pos1)];
    const participant2 = byes.includes(pos2)
      ? { bye: true }
      : participants[teams.indexOf(pos2)];

    round1Matches.push({
      matchId: `R1M${i / 2 + 1}`,
      round: 1,
      participant1,
      participant2,
      winner: participant1.bye
        ? participant2
        : participant2.bye
        ? participant1
        : null,
      status: participant1.bye || participant2.bye ? "completed" : "pending",
      nextMatchId: `R2M${Math.floor(i / 4) + 1}`,
    });
  }
  tournament.bracket = round1Matches;

  // Step 3: Pre-fill Round 2 BYEs (if any)
  const round2Matches = [];
  const round1Winners = round1Matches.map((m) => m.winner);
  for (let i = 0; i < round1Winners.length; i += 2) {
    const winner1 = round1Winners[i];
    const winner2 = round1Winners[i + 1];

    round2Matches.push({
      matchId: `R2M${i / 2 + 1}`,
      round: 2,
      participant1: winner1,
      participant2: winner2,
      winner: null,
      status: "pending",
      nextMatchId: rounds > 2 ? `R3M${Math.floor(i / 4) + 1}` : null,
    });
  }
  tournament.bracket.push(...round2Matches);

  // Step 4: Create empty structure for remaining rounds
  for (let round = 3; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    for (let match = 1; match <= matchesInRound; match++) {
      tournament.bracket.push({
        matchId: `R${round}M${match}`,
        round,
        participant1: null,
        participant2: null,
        winner: null,
        status: "pending",
        nextMatchId:
          round < rounds ? `R${round + 1}M${Math.ceil(match / 2)}` : null,
      });
    }
  }

  return tournament;
}
/**
 * Creates a knockout tournament fixture from a list of participants.
 * Ensures the bracket is filled to the next power of 2, assigns byes, and generates all rounds.
 * @param {Array} participants - List of participant objects or names.
 * @returns {Object} tournament - The generated tournament object with bracket and rounds.
 */

function createFirstRoundMatches(tournament, participants) {
  for (let i = 0; i < participants.length; i += 2) {
    const matchNumber = Math.floor(i / 2) + 1;
    const match = {
      matchId: `R1M${matchNumber}`,
      round: 1,
      participant1: participants[i],
      participant2: participants[i + 1],
      winner: null,
      nextMatchId: `R2M${Math.ceil(matchNumber / 2)}`,
      position: i + 1,
      status: "pending",
    };
    if (match.participant1 && match.participant1.bye && match.participant2) {
      match.winner = match.participant2;
      match.status = "completed";
    } else if (
      match.participant2 &&
      match.participant2.bye &&
      match.participant1
    ) {
      match.winner = match.participant1;
      match.status = "completed";
    }
    tournament.bracket.push(match);
  }
  /**
   * Creates the first round matches for the tournament bracket.
   * Assigns participants and handles automatic wins for byes.
   * @param {Object} tournament - The tournament object to update.
   * @param {Array} participants - Array of participants and byes for the first round.
   */
}

function createSubsequentRounds(tournament, rounds) {
  for (let round = 2; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    for (let match = 1; match <= matchesInRound; match++) {
      tournament.bracket.push({
        matchId: `R${round}M${match}`,
        round,
        participant1: null,
        participant2: null,
        winner: null,
        nextMatchId:
          round < rounds ? `R${round + 1}M${Math.ceil(match / 2)}` : null,
        status: "pending",
      });
    }
  }
  const firstRoundMatches = tournament.bracket.filter((m) => m.round === 1);
  firstRoundMatches.forEach((match) => {
    if (match.participant1?.bye && match.participant2) {
      const nextMatch = tournament.bracket.find(
        (m) => m.matchId === match.nextMatchId
      );
      if (nextMatch) {
        if (!nextMatch.participant1)
          nextMatch.participant1 = match.participant2;
        else nextMatch.participant2 = match.participant2;
        match.winner = match.participant2;
        match.status = "completed";
      }
    } else if (match.participant2?.bye && match.participant1) {
      const nextMatch = tournament.bracket.find(
        (m) => m.matchId === match.nextMatchId
      );
      if (nextMatch) {
        if (!nextMatch.participant1)
          nextMatch.participant1 = match.participant1;
        else nextMatch.participant2 = match.participant1;
        match.winner = match.participant1;
        match.status = "completed";
      }
    }
  });
}
/**
 * Creates all subsequent rounds for the tournament bracket after the first round.
 * Initializes empty matches and propagates automatic winners from byes.
 * @param {Object} tournament - The tournament object to update.
 * @param {number} rounds - Total number of rounds in the tournament.
 */

function calculatePositions(numTeams, bracketSize) {
  const positions = Array.from({ length: bracketSize }, (_, i) => i + 1);
  const byes = [];
  
  // Distribute BYEs in staggered positions
  for (let i = 0; i < bracketSize - numTeams; i++) {
    const pos = i * 2 + 1;
    byes.push(pos > bracketSize ? pos - 1 : pos); // Prevent overflow
  }

  const teamPositions = positions.filter(pos => !byes.includes(pos));
  return { 
    teams: teamPositions.slice(0, numTeams), 
    byes: byes.slice(0, bracketSize - numTeams) 
  };
}
/**
 * Calculates the positions for teams and byes in the bracket.
 * Ensures byes are distributed to balance the bracket.
 * @param {number} numTeams - Number of actual teams/participants.
 * @param {number} bracketSize - Total bracket size (next power of 2).
 * @returns {Object} - { teams: [positions], byes: [positions] }
 */

function generateTournamentId() {
  return (
    "tournament_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
}
/**
 * Generates a unique tournament ID using timestamp and random string.
 * @returns {string} - Unique tournament ID.
 */
