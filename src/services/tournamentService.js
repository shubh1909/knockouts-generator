export function createKnockoutFixture(participants) {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error(
      "At least 2 participants are required for a knockout tournament"
    );
  }
  const totalTeams = participants.length;
  // Find the next power of 2 for the bracket size
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
  const rounds = Math.ceil(Math.log2(totalTeams));
  const tournament = {
    id: generateTournamentId(),
    name: "Knockout Tournament",
    rounds,
    currentRound: 1,
    bracket: [],
    status: "active",
    createdAt: new Date().toISOString(),
    participants: participants,
  };
  const positions = calculatePositions(totalTeams, nextPowerOf2);
  const matchParticipants = new Array(nextPowerOf2).fill(null);
  positions.teams.forEach((pos, i) => {
    matchParticipants[pos - 1] = participants[i];
  });
  positions.byes.forEach((pos) => {
    matchParticipants[pos - 1] = { bye: true };
  });
  createFirstRoundMatches(tournament, matchParticipants);
  createSubsequentRounds(tournament, rounds);
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
  const numberOfByes = bracketSize - numTeams;
  if (numberOfByes === 0) {
    return {
      teams: Array.from({ length: numTeams }, (_, i) => i + 1),
      byes: [],
    };
  }
  let byePositions = [];
  let n = bracketSize;
  while (byePositions.length < numberOfByes) {
    if (byePositions.length === 0) {
      byePositions.push(n);
    } else {
      let sections = Math.pow(2, byePositions.length);
      let sectionSize = n / sections;
      for (let i = 1; i < sections; i += 2) {
        if (byePositions.length < numberOfByes) {
          byePositions.push(Math.floor(i * sectionSize));
        }
      }
    }
  }
  byePositions = byePositions.sort((a, b) => b - a);
  let availablePositions = Array.from(
    { length: bracketSize },
    (_, i) => i + 1
  ).filter((pos) => !byePositions.includes(pos));
  return { teams: availablePositions.slice(0, numTeams), byes: byePositions };
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
