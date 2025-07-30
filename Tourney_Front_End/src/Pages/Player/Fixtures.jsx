import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navigation from '@/Components/Navigation';
import Footer from '@/Components/Footer';
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Users, User } from "lucide-react";
import { fetchMatchFixtures } from "@/lib/api";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";



const Fixtures = () => {
  const location = useLocation();
  const eventName = location.state?.eventName || "Tournament";
  const tournamentId = location.state?.tournamentId;
  const eventId = location.state?.eventId;

  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventType, setEventType] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top on mount
    
    const loadEventData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!tournamentId || !eventId) throw new Error("Tournament or Event ID not provided");
        
        // Fetch all events for the tournament to get event type
        const eventsResponse = await fetch(`${BASE_URL}/api/player/tournaments/${tournamentId}/events`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!eventsResponse.ok) {
          throw new Error(`HTTP error! status: ${eventsResponse.status}`);
        }
        
        const eventsData = await eventsResponse.json();
        if (!eventsData.success) throw new Error(eventsData.message || 'Failed to load events');
        
        // Find the current event in the events array
        const currentEvent = eventsData.message.find(event => event._id === eventId);
        if (!currentEvent) throw new Error('Current event not found in tournament');
        
        // Set the event type (matchType in the schema)
        const eventMatchType = currentEvent.matchType || '';
        setEventType(eventMatchType);
        
        // For round-robin events, we'll calculate standings from fixtures if needed
        // The standings will be calculated when we have the fixtures data
        
        // Fetch fixtures
        const fixturesData = await fetchMatchFixtures(tournamentId, eventId);
      // Group by round (assuming backend returns flat fixture array)
      const grouped = {};
      fixturesData.forEach(fx => {
        const round = fx.roundName || `Round ${fx.round ?? 1}`;
        if (!grouped[round]) grouped[round] = [];
        grouped[round].push(fx);
      });
      // Convert to array for rendering
      const rounds = Object.entries(grouped).map(([round, matches], i) => ({
        id: i + 1,
        round,
        matches: matches.map(m => ({
          id: m._id,
          team1: m.teamA?.teamName || m.teamAName || m.teamA?._id || m.teamA || "TBD",
          team2: m.teamB?.teamName || m.teamBName || m.teamB?._id || m.teamB || "TBD",
          time: m.time || "",
          date: m.date ? m.date.split('T')[0] : "",
          ...m
        }))
      }));
      setFixtures(rounds);
    } catch (err) {
      setError(err.message || "Failed to load fixtures");
    } finally {
      setLoading(false);
    }
  };
  loadEventData();
  // eslint-disable-next-line
}, [tournamentId, eventId]);

  // Function to safely parse JSON or return default
  const safeJsonParse = (str, defaultValue = []) => {
    try {
      return JSON.parse(str) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // Calculate standings from fixtures for round-robin events
  const calculateStandings = (fixtures) => {
    const teams = new Map();
    
    // Process each match to update team stats
    fixtures.forEach(round => {
      round.matches.forEach(match => {
        // Initialize team if not exists
        if (!teams.has(match.team1)) {
          teams.set(match.team1, {
            teamName: match.team1,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0
          });
        }
        if (!teams.has(match.team2)) {
          teams.set(match.team2, {
            teamName: match.team2,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0
          });
        }
        
        const team1 = teams.get(match.team1);
        const team2 = teams.get(match.team2);
        
        // Skip if match doesn't have scores
        if (match.teamAScore === undefined || match.teamBScore === undefined) {
          return;
        }
        
        // Update played matches
        team1.played++;
        team2.played++;
        
        // Update goals
        team1.goalsFor += match.teamAScore || 0;
        team1.goalsAgainst += match.teamBScore || 0;
        team2.goalsFor += match.teamBScore || 0;
        team2.goalsAgainst += match.teamAScore || 0;
        
        // Update points based on match result
        if (match.teamAScore > match.teamBScore) {
          team1.won++;
          team1.points += 3;
          team2.lost++;
        } else if (match.teamAScore < match.teamBScore) {
          team2.won++;
          team2.points += 3;
          team1.lost++;
        } else {
          team1.drawn++;
          team1.points += 1;
          team2.drawn++;
          team2.points += 1;
        }
      });
    });
    
    // Convert map to array and sort by points (descending)
    return Array.from(teams.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      // If points are equal, sort by goal difference
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      return gdB - gdA;
    });
  };
  
  // Get standings for the current event
  const standings = (eventType === 'round-robin' || eventType === 'round-robin-knockout') 
    ? calculateStandings(fixtures)
    : [];

  // Display each match in a round
  const MatchComponent = ({ match }) => {
    // Determine winner's name if exists
    let winnerName = null;
    if (match.winner) {
      // Normalize and check various winner formats
      const winnerIdOrName = match.winner?.toString();
      const teamAId = match.teamA?._id?.toString();
      const teamBId = match.teamB?._id?.toString();
      const teamAName = match.teamA?.teamName || match.team1;
      const teamBName = match.teamB?.teamName || match.team2;
    
      if (winnerIdOrName === teamAId || winnerIdOrName === teamAName) {
        winnerName = teamAName;
      } else if (winnerIdOrName === teamBId || winnerIdOrName === teamBName) {
        winnerName = teamBName;
      } else {
        winnerName = winnerIdOrName; // fallback (if it's already a name or unmatched)
      }
    }
    let formattedDateTime = "";
    if (match.scheduledAt) {
        const dateObj = new Date(match.scheduledAt);
        // Options for a readable date (e.g., "July 11, 2025")
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        // Options for a readable time (e.g., "9:34 AM")
        const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

        const formattedDate = dateObj.toLocaleDateString(undefined, dateOptions);
        const formattedTime = dateObj.toLocaleTimeString(undefined, timeOptions);
        
        formattedDateTime = `${formattedDate} - ${formattedTime}`;
    } else if (match.date && match.time) {
        // Fallback to existing date and time if scheduledAt is not available
        formattedDateTime = `${match.date} - ${match.time}`;
    } else {
        formattedDateTime = "Date & Time TBD"; // Or any other placeholder
    }
    return (
      
      <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-500">{formattedDateTime}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex flex-col items-center w-5/12">
              <div className={`p-3 rounded-lg text-center w-full mb-2 ${winnerName === match.team1 ? 'bg-green-100 font-bold border-2 border-green-400' : 'bg-blue-50'}`}>
                <span className="font-semibold">{match.team1}</span>
              </div>
            </div>
            <div className="w-2/12 text-center">
              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-bold">
                VS
              </span>
            </div>
            <div className="flex flex-col items-center w-5/12">
              <div className={`p-3 rounded-lg text-center w-full mb-2 ${winnerName === match.team2 ? 'bg-green-100 font-bold border-2 border-green-400' : 'bg-blue-50'}`}>
                <span className="font-semibold">{match.team2}</span>
              </div>
            </div>
          </div>
          {winnerName && (
            <div className="mt-3 flex items-center justify-center">
              <span className="text-green-700 font-bold flex items-center gap-2">
                <Trophy className="inline-block w-5 h-5 text-yellow-500" />
                Winner: {winnerName}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="pt-20 pb-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">{eventName} Fixtures</h1>
            <p className="text-gray-600 mt-2">View all matches and tournament brackets</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 font-semibold py-8">{error}</div>
          ) : (
            <>
              {/* Standings Table for Round Robin - Only show if we have the data */}
              {(eventType === 'round-robin' || eventType === 'round-robin-knockout') && standings.length > 0 && (
                <div className="mb-8 bg-blue-50 rounded-xl shadow p-6">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Standings</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left border">
                      <thead className="bg-blue-100">
                        <tr>
                          <th className="px-3 py-2 border">#</th>
                          <th className="px-3 py-2 border">Team</th>
                          <th className="px-3 py-2 border">P</th>
                          <th className="px-3 py-2 border">W</th>
                          <th className="px-3 py-2 border">D</th>
                          <th className="px-3 py-2 border">L</th>
                          <th className="px-3 py-2 border">GF</th>
                          <th className="px-3 py-2 border">GA</th>
                          <th className="px-3 py-2 border">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((row, idx) => (
                          <tr key={row.teamId || idx} className="border-b">
                            <td className="px-3 py-2 border">{idx + 1}</td>
                            <td className="px-3 py-2 border font-semibold">{row.teamName}</td>
                            <td className="px-3 py-2 border">{row.played}</td>
                            <td className="px-3 py-2 border">{row.won}</td>
                            <td className="px-3 py-2 border">{row.drawn}</td>
                            <td className="px-3 py-2 border">{row.lost}</td>
                            <td className="px-3 py-2 border">{row.goalsFor}</td>
                            <td className="px-3 py-2 border">{row.goalsAgainst}</td>
                            <td className="px-3 py-2 border font-bold">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Fixtures List */}
              {fixtures.length === 0 ? (
                <div className="text-center text-gray-500 font-semibold py-8">No fixtures available.</div>
              ) : (
                <div className="flex flex-col gap-8">
                  {fixtures.map((round) => (
                    <div key={round.id} className="bg-white rounded-xl shadow p-6 mb-6">
                      <h2 className="text-xl font-bold mb-4 text-blue-600">{round.round}</h2>
                      <div className="flex flex-col gap-4">
                        {round.matches.map((match) => (
                          <MatchComponent key={match.id} match={match} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          <div className="mt-12 bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Tournament Rules</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>All matches will start at the scheduled time.</li>
              <li>Teams must report 30 minutes before their scheduled match time.</li>
              <li>Match format will be according to international standards.</li>
              <li>The referee's decision will be final and binding.</li>
              <li>Any disputes must be raised with the tournament director.</li>
            </ul>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Fixtures; 